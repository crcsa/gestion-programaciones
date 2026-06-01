import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    staffId: 'staff_id',
    totalHours: 'total_hours',
    shiftDate: 'shift_date',
    isOvernight: 'is_overnight',
    extraHours: 'extra_hours',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    staffId: 'staff_id',
    campaignId: 'campaign_id',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id',
    campaignDate: 'campaign_date',
    endDate: 'end_date',
    startTime: 'start_time',
    endTime: 'end_time',
    status: 'status',
  },
  campaignDays: {
    id: 'id',
    campaignId: 'campaign_id',
    dayDate: 'day_date',
    startTime: 'start_time',
    endTime: 'end_time',
    isOvernight: 'is_overnight',
  },
}))

vi.mock('@/lib/db/schema/weekly-balance', () => ({
  weeklyBalance: {
    staffId: 'staff_id',
    weekStart: 'week_start',
    workedHours: 'worked_hours',
    sedeHours: 'sede_hours',
    campaignHours: 'campaign_hours',
    extraHours: 'extra_hours',
    sundayCount: 'sunday_count',
    overnightCount: 'overnight_count',
    bankDelta: 'bank_delta',
    bankBalanceMonth: 'bank_balance_month',
    bankMonthKey: 'bank_month_key',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/features/configuration/lib/runtime-config', () => {
  const cfg = {
    weeklyHours: 44,
    maxExtraHoursWeek: 12,
    maxShiftHours: 12,
    minRestHours: 12,
    maxSundaysMonth: 2,
    maxOvernightsMonth: 1,
    municipalCutoffTime: '00:00',
    sedeMunicipality: 'Medellin',
  }
  return {
    loadValidationRuntimeConfig: vi.fn().mockResolvedValue(cfg),
    loadValidationRuntimeConfigAt: vi.fn().mockResolvedValue(cfg),
    invalidateRuntimeConfigCache: vi.fn(),
  }
})

import { db } from '@/lib/db'
import {
  computeAndSaveWeeklyBalance,
  computeBankDelta,
} from '@/features/hours/lib/balance-calculator'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'leftJoin', 'limit', 'orderBy',
    'insert', 'values', 'onConflictDoUpdate']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  execute: ReturnType<typeof vi.fn>
  transaction: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as MockDb

const STAFF_ID = '11111111-1111-1111-1111-111111111111'
const WEEK_START = '2026-05-11' // monday

beforeEach(() => {
  vi.clearAllMocks()
  // transaction ejecuta el callback con el mismo mockDb como tx.
  mockDb.transaction = vi.fn(async (cb: (tx: MockDb) => Promise<unknown>) =>
    cb(mockDb),
  )
  mockDb.execute = vi.fn().mockResolvedValue(undefined)
})

describe('computeAndSaveWeeklyBalance — extras de pernocta', () => {
  it('suma extras de sede al extraHours semanal incluso si worked < 40h', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) {
        // shifts: 1 noche con pernocta + 2h extras (12h) y 1 día (8h)
        return makeChain([
          {
            totalHours: 12,
            shiftDate: '2026-05-12',
            isOvernight: true,
            extraHours: 2,
          },
          {
            totalHours: 8,
            shiftDate: '2026-05-14',
            isOvernight: false,
            extraHours: 0,
          },
        ])
      }
      return makeChain([])
    })

    const insertChain = makeChain(undefined)
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await computeAndSaveWeeklyBalance(STAFF_ID, WEEK_START)

    const inserted = valuesSpy.mock.calls[0][0] as {
      workedHours: number
      sedeHours: number
      extraHours: number
    }
    // worked = 20 (sede) + 0 (sin campañas) = 20 < 40 → baseExtras = 0
    // sedeExtras = 2
    expect(inserted.workedHours).toBe(20)
    expect(inserted.sedeHours).toBe(20)
    expect(inserted.extraHours).toBe(2)
  })

  it('combina extras base (worked > contrato) + extras de sede', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) {
        // 4 días de 12h = 48h con pernocta el último (3h extras explícitas)
        return makeChain([
          { totalHours: 12, shiftDate: '2026-05-11', isOvernight: false, extraHours: 0 },
          { totalHours: 12, shiftDate: '2026-05-12', isOvernight: false, extraHours: 0 },
          { totalHours: 12, shiftDate: '2026-05-13', isOvernight: false, extraHours: 0 },
          { totalHours: 12, shiftDate: '2026-05-14', isOvernight: true, extraHours: 3 },
        ])
      }
      return makeChain([])
    })

    const insertChain = makeChain(undefined)
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await computeAndSaveWeeklyBalance(STAFF_ID, WEEK_START)

    const inserted = valuesSpy.mock.calls[0][0] as { extraHours: number }
    // baseExtras = max(0, 48 - 44) = 4; sedeExtras = 3 → 7
    expect(inserted.extraHours).toBe(7)
  })

  it('no rompe cuando extraHours es undefined (turnos antiguos)', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) {
        return makeChain([
          {
            totalHours: 8,
            shiftDate: '2026-05-12',
            isOvernight: false,
            extraHours: undefined,
          },
        ])
      }
      return makeChain([])
    })

    const insertChain = makeChain(undefined)
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await computeAndSaveWeeklyBalance(STAFF_ID, WEEK_START)

    const inserted = valuesSpy.mock.calls[0][0] as { extraHours: number }
    expect(inserted.extraHours).toBe(0)
  })
})

describe('computeBankDelta — reglas del banco de horas', () => {
  // weeklyHours=44, maxExtraHoursWeek=12 → cap=56h
  it('worked=40 → bankDelta=-4 (deuda)', () => {
    expect(computeBankDelta(40, 44, 12)).toBe(-4)
  })

  it('worked=44 → bankDelta=0 (cumple meta exacta)', () => {
    expect(computeBankDelta(44, 44, 12)).toBe(0)
  })

  it('worked=50 → bankDelta=0 (extras normales, NO van al banco)', () => {
    expect(computeBankDelta(50, 44, 12)).toBe(0)
  })

  it('worked=56 → bankDelta=0 (tope de extras normales)', () => {
    expect(computeBankDelta(56, 44, 12)).toBe(0)
  })

  it('worked=57 → bankDelta=+1 (crédito mínimo)', () => {
    expect(computeBankDelta(57, 44, 12)).toBe(1)
  })

  it('worked=60 → bankDelta=+4 (crédito)', () => {
    expect(computeBankDelta(60, 44, 12)).toBe(4)
  })
})

describe('computeAndSaveWeeklyBalance — banco de horas', () => {
  it('asigna bank_month_key = mes del lunes (weekStart)', async () => {
    // Lunes 2026-02-23 (semana cruza al mes de marzo). bankMonthKey debe
    // ser 2026-02-01 (mes del lunes).
    mockDb.select = vi.fn(() => makeChain([]))

    const insertChain = makeChain(undefined)
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await computeAndSaveWeeklyBalance(STAFF_ID, '2026-02-23')

    const inserted = valuesSpy.mock.calls[0][0] as {
      bankMonthKey: string
      bankDelta: number
      bankBalanceMonth: number
    }
    expect(inserted.bankMonthKey).toBe('2026-02-01')
    // Sin horas → bankDelta = 0 - 44 = -44.
    expect(inserted.bankDelta).toBe(-44)
    // Sin filas previas en el mes → bankBalanceMonth = bankDelta.
    expect(inserted.bankBalanceMonth).toBe(-44)
  })

  it('acumula bankBalanceMonth en mes con 2 semanas (deuda + crédito → 0)', async () => {
    // Semana 1: worked=40 → bankDelta=-4
    // Semana 2: worked=60 → bankDelta=+4 (60 > 56) y prevSum = -4 (semana 1)
    // bankBalanceMonth final = -4 + 4 = 0
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      // select 1: sedeShifts → 60h sin extras → bankDelta=+4
      if (selectCount === 1) {
        return makeChain([
          { totalHours: 60, shiftDate: '2026-05-18', isOvernight: false, extraHours: 0 },
        ])
      }
      // select 2/3: getStaffCampaignDayPoints → vacío
      if (selectCount === 2 || selectCount === 3) {
        return makeChain([])
      }
      // select 4 (dentro de la tx): prev sum del mes → -4 (semana anterior)
      if (selectCount === 4) {
        return makeChain([{ total: -4 }])
      }
      return makeChain([])
    })

    const insertChain = makeChain(undefined)
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await computeAndSaveWeeklyBalance(STAFF_ID, '2026-05-18')

    const inserted = valuesSpy.mock.calls[0][0] as {
      bankDelta: number
      bankBalanceMonth: number
      bankMonthKey: string
    }
    expect(inserted.bankDelta).toBe(4)
    expect(inserted.bankBalanceMonth).toBe(0) // -4 (prev) + 4 (esta) = 0
    expect(inserted.bankMonthKey).toBe('2026-05-01')
  })

  it('es idempotente: dos llamadas con mismo input producen el mismo bankBalanceMonth', async () => {
    // Mismas filas en cada invocación; prev sum simula que la fila ya existe
    // y se actualiza (no se duplica), por lo que prev = 0 en ambas pasadas.
    mockDb.select = vi.fn(() => makeChain([]))
    const insertChain = makeChain(undefined)
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await computeAndSaveWeeklyBalance(STAFF_ID, WEEK_START)
    await computeAndSaveWeeklyBalance(STAFF_ID, WEEK_START)

    const first = valuesSpy.mock.calls[0][0] as { bankBalanceMonth: number }
    const second = valuesSpy.mock.calls[1][0] as { bankBalanceMonth: number }
    expect(second.bankBalanceMonth).toBe(first.bankBalanceMonth)
  })
})
