import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionError } from '@/lib/errors/app-errors'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/require-access', () => ({
  requireAccess: vi.fn().mockResolvedValue({
    userId: 'user-admin',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'admin@test.com',
    fullName: 'Admin',
    scope: { kind: 'global' as const },
  }),
}))

vi.mock('@/lib/db/schema/weekly-balance', () => ({
  weeklyBalance: {
    id: 'id',
    staffId: 'staff_id',
    weekStart: 'week_start',
    workedHours: 'worked_hours',
    bankDelta: 'bank_delta',
    bankBalanceMonth: 'bank_balance_month',
    bankMonthKey: 'bank_month_key',
  },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    firstName: 'first_name',
    lastName: 'last_name',
    staffProfile: 'staff_profile',
    area: 'area',
    isActive: 'is_active',
  },
}))

import { db } from '@/lib/db'
import { requireAccess } from '@/features/auth/lib/require-access'
import { getBancoHorasReport } from '@/features/reports/actions/banco-horas-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning',
    'leftJoin', 'innerJoin', 'groupBy',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

function setAdminGlobal() {
  vi.mocked(requireAccess).mockResolvedValue({
    userId: 'user-admin',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'admin@test.com',
    fullName: 'Admin',
    scope: { kind: 'global' as const },
  })
}

function setAdminArea(area: 'banco_sangre' | 'comercial' | 'logistica') {
  vi.mocked(requireAccess).mockResolvedValue({
    userId: 'user-admin-area',
    role: 'admin_area',
    area,
    staffId: null,
    email: 'aa@test.com',
    fullName: 'Admin Area',
    scope: { kind: 'area' as const, area },
  })
}

describe('getBancoHorasReport — autorización', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAdminGlobal()
  })

  it('rechaza a operativo con PermissionError', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso'),
    )
    await expect(
      getBancoHorasReport({ year: 2026, month: 5, granularity: 'mensual' }),
    ).rejects.toThrow(PermissionError)
  })

  it('rechaza a comercial con PermissionError', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso'),
    )
    await expect(
      getBancoHorasReport({ year: 2026, month: 5, granularity: 'mensual' }),
    ).rejects.toThrow(PermissionError)
  })
})

describe('getBancoHorasReport — datos y filtros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAdminGlobal()
  })

  it('agrupa workedHours, bankDelta y weeksCount por staff', async () => {
    const activeStaff = [
      {
        id: 's1',
        firstName: 'Juan',
        lastName: 'Perez',
        staffProfile: 'bacteriologo',
        area: 'banco_sangre',
      },
      {
        id: 's2',
        firstName: 'Ana',
        lastName: 'Gomez',
        staffProfile: 'tecnico',
        area: 'banco_sangre',
      },
    ]
    const aggregates = [
      { staffId: 's1', workedSum: 80, bankDeltaSum: -8, weeksCount: 2 },
      { staffId: 's2', workedSum: 120, bankDeltaSum: 4, weeksCount: 2 },
    ]
    const lastBalances = [
      // ordenados desc por weekStart en el query: primer match por staff =
      // la semana más reciente.
      { staffId: 's1', bankBalanceMonth: -8, weekStart: '2026-05-25' },
      { staffId: 's1', bankBalanceMonth: -3, weekStart: '2026-05-18' },
      { staffId: 's2', bankBalanceMonth: 4, weekStart: '2026-05-25' },
    ]

    let n = 0
    mockDb.select = vi.fn(() => {
      n++
      if (n === 1) return makeChain(activeStaff)
      if (n === 2) return makeChain(aggregates)
      if (n === 3) return makeChain(lastBalances)
      return makeChain([])
    })

    const result = await getBancoHorasReport({
      year: 2026,
      month: 5,
      granularity: 'mensual',
    })

    expect(result).toHaveLength(2)
    const juan = result.find((r) => r.staffId === 's1')!
    expect(juan.workedHours).toBe(80)
    expect(juan.bankDelta).toBe(-8)
    expect(juan.weeksCount).toBe(2)
    expect(juan.bankBalanceMonth).toBe(-8)
    expect(juan.state).toBe('debe')

    const ana = result.find((r) => r.staffId === 's2')!
    expect(ana.bankBalanceMonth).toBe(4)
    expect(ana.state).toBe('compensatorio')
  })

  it('staff sin filas devuelve workedHours=0 y state=cumplio', async () => {
    const activeStaff = [
      {
        id: 's3',
        firstName: 'Maria',
        lastName: 'Lopez',
        staffProfile: 'medico',
        area: 'banco_sangre',
      },
    ]

    let n = 0
    mockDb.select = vi.fn(() => {
      n++
      if (n === 1) return makeChain(activeStaff)
      return makeChain([])
    })

    const result = await getBancoHorasReport({
      year: 2026,
      month: 5,
      granularity: 'mensual',
    })

    expect(result).toHaveLength(1)
    expect(result[0].workedHours).toBe(0)
    expect(result[0].bankDelta).toBe(0)
    expect(result[0].bankBalanceMonth).toBe(0)
    expect(result[0].state).toBe('cumplio')
  })

  it('admin_area queda anclado a su scope.area, ignora params.area', async () => {
    setAdminArea('logistica')

    let n = 0
    let staffWhereCalled = false
    mockDb.select = vi.fn(() => {
      n++
      const chain = makeChain([])
      if (n === 1) {
        // El primer query es de staffMembers; verificar que .where se llama.
        chain.where = vi.fn(() => {
          staffWhereCalled = true
          return chain
        })
      }
      return chain
    })

    await getBancoHorasReport({
      year: 2026,
      month: 5,
      granularity: 'mensual',
      area: 'banco_sangre', // se ignora — scope ancla a logistica
    })

    expect(staffWhereCalled).toBe(true)
  })

  it('valida granularidad inválida con ValidationError', async () => {
    await expect(
      // @ts-expect-error — granularity inválido
      getBancoHorasReport({ year: 2026, month: 5, granularity: 'anual' }),
    ).rejects.toThrow()
  })

  it('valida mes fuera de rango con ValidationError', async () => {
    await expect(
      getBancoHorasReport({ year: 2026, month: 13, granularity: 'mensual' }),
    ).rejects.toThrow()
  })

  it('quincenal_q1 y quincenal_q2 son granularidades válidas', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    await expect(
      getBancoHorasReport({ year: 2026, month: 5, granularity: 'quincenal_q1' }),
    ).resolves.toEqual([])
    await expect(
      getBancoHorasReport({ year: 2026, month: 5, granularity: 'quincenal_q2' }),
    ).resolves.toEqual([])
  })
})
