import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
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
import { computeAndSaveWeeklyBalance } from '@/features/hours/lib/balance-calculator'

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

type MockDb = { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

const STAFF_ID = '11111111-1111-1111-1111-111111111111'
const WEEK_START = '2026-05-11' // monday

beforeEach(() => {
  vi.clearAllMocks()
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
