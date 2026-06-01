import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    selectDistinctOn: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/user-context', () => ({
  requireUserContext: vi.fn().mockResolvedValue({
    userId: 'user-123',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'admin@example.com',
    fullName: 'Admin',
  }),
}))

vi.mock('@/features/dashboard/lib/dashboard-queries', () => ({
  campaignArea: vi.fn(() => undefined),
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id',
    code: 'code',
    status: 'status',
    cancelReason: 'cancel_reason',
    updatedAt: 'updated_at',
    isDeleted: 'is_deleted',
    createdAt: 'created_at',
    campaignDate: 'campaign_date',
    startTime: 'start_time',
    endTime: 'end_time',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    id: 'id',
    campaignId: 'campaign_id',
    staffId: 'staff_id',
    isCoordinator: 'is_coordinator',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/weekly-balance', () => ({
  weeklyBalance: {
    id: 'id',
    staffId: 'staff_id',
    weekStart: 'week_start',
    extraHours: 'extra_hours',
    workedHours: 'worked_hours',
    sundayCount: 'sunday_count',
    overnightCount: 'overnight_count',
    bankDelta: 'bank_delta',
    bankBalanceMonth: 'bank_balance_month',
    bankMonthKey: 'bank_month_key',
  },
}))

vi.mock('@/features/configuration/lib/runtime-config', () => ({
  loadValidationRuntimeConfig: vi.fn().mockResolvedValue({
    weeklyHours: 44,
    maxExtraHoursWeek: 12,
    maxShiftHours: 12,
    minRestHours: 12,
    maxSundaysMonth: 2,
    maxOvernightsMonth: 1,
    municipalCutoffTime: '17:00',
    sedeMunicipality: 'Medellin',
    hourBankDeficitThreshold: -8,
  }),
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    firstName: 'first_name',
    lastName: 'last_name',
    area: 'area',
  },
}))

import { db } from '@/lib/db'
import { requireUserContext } from '@/features/auth/lib/user-context'
import { campaignArea } from '@/features/dashboard/lib/dashboard-queries'
import { getNotifications } from '@/features/notifications/actions/notification-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'selectDistinctOn', 'from', 'where', 'limit', 'offset', 'orderBy',
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

type SimpleMockDb = {
  select: ReturnType<typeof vi.fn>
  selectDistinctOn: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as SimpleMockDb

function setAdmin() {
  vi.mocked(requireUserContext).mockResolvedValue({
    userId: 'user-123',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'admin@example.com',
    fullName: 'Admin',
  })
}

describe('getNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAdmin()
    vi.mocked(campaignArea).mockReturnValue(undefined)
    // Default: selectDistinctOn devuelve [] (sin déficit).
    mockDb.selectDistinctOn = vi.fn(() => makeChain([]))
  })

  it('returns cancelled campaign notifications', async () => {
    const cancelledCampaigns = [
      {
        id: 'camp-1',
        code: 'CMP-001',
        cancelReason: 'Sin presupuesto disponible',
        updatedAt: new Date('2026-03-18T10:00:00Z'),
      },
    ]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain(cancelledCampaigns)
      if (callCount === 2) return makeChain([])
      return makeChain([])
    })

    const result = await getNotifications()

    const cancelledNotifs = result.filter((n) => n.type === 'campaign_cancelled')
    expect(cancelledNotifs).toHaveLength(1)
    expect(cancelledNotifs[0].id).toBe('cancelled-camp-1')
    expect(cancelledNotifs[0].title).toBe('Campana cancelada')
    expect(cancelledNotifs[0].message).toContain('CMP-001')
    expect(cancelledNotifs[0].campaignId).toBe('camp-1')
  })

  it('returns missing coordinator notifications', async () => {
    const confirmedCampaigns = [
      { id: 'camp-2', code: 'CMP-002', createdAt: new Date('2026-03-15T08:00:00Z') },
      { id: 'camp-3', code: 'CMP-003', createdAt: new Date('2026-03-16T08:00:00Z') },
    ]
    const coordinatorRows = [{ campaignId: 'camp-3', hasCoordinator: true }]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain([])
      if (callCount === 2) return makeChain(confirmedCampaigns)
      if (callCount === 3) return makeChain(coordinatorRows)
      return makeChain([])
    })

    const result = await getNotifications()
    const missingCoordNotifs = result.filter((n) => n.type === 'missing_coordinator')
    expect(missingCoordNotifs).toHaveLength(1)
    expect(missingCoordNotifs[0].id).toBe('no-coord-camp-2')
  })

  it('returns balance_warning when extraHours >= 10', async () => {
    const highExtraHoursStaff = [
      { staffId: 'staff-1', extraHours: 12, firstName: 'Juan', lastName: 'Perez' },
    ]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain([])
      if (callCount === 2) return makeChain([])
      return makeChain(highExtraHoursStaff)
    })

    const result = await getNotifications()
    const balanceNotifs = result.filter((n) => n.type === 'balance_warning')
    expect(balanceNotifs).toHaveLength(1)
    expect(balanceNotifs[0].message).toContain('Juan Perez')
    expect(balanceNotifs[0].message).toContain('12h extras')
  })

  it('throws when requireUserContext rejects', async () => {
    vi.mocked(requireUserContext).mockRejectedValue(
      new Error('No tiene permiso para acceder a este recurso'),
    )
    await expect(getNotifications()).rejects.toThrow('permiso')
  })

  it('returns notifications sorted by createdAt desc', async () => {
    const cancelledCampaigns = [
      {
        id: 'camp-old',
        code: 'CMP-OLD',
        cancelReason: null,
        updatedAt: new Date('2026-03-14T10:00:00Z'),
      },
    ]
    const confirmedCampaigns = [
      { id: 'camp-new', code: 'CMP-NEW', createdAt: new Date('2026-03-19T08:00:00Z') },
    ]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain(cancelledCampaigns)
      if (callCount === 2) return makeChain(confirmedCampaigns)
      if (callCount === 3) return makeChain([])
      return makeChain([])
    })

    const result = await getNotifications()
    expect(result.length).toBeGreaterThanOrEqual(2)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        result[i + 1].createdAt.getTime(),
      )
    }
  })

  it('throws generic error when DB fails', async () => {
    mockDb.select = vi.fn(() => { throw new Error('DB connection failed') })
    await expect(getNotifications()).rejects.toThrow('Error al obtener las notificaciones')
  })

  it('applies campaignArea predicate for admin_area (banco_sangre)', async () => {
    vi.mocked(requireUserContext).mockResolvedValue({
      userId: 'user-bds',
      role: 'admin_area',
      area: 'banco_sangre',
      staffId: null,
      email: 'bds@example.com',
      fullName: 'BDS Admin',
    })
    const sentinel = { __pred: true } as never
    vi.mocked(campaignArea).mockReturnValue(sentinel)

    mockDb.select = vi.fn(() => makeChain([]))

    await getNotifications()

    // campaignArea se llama una vez con el área del scope (banco_sangre);
    // el predicate se reusa para cancelled y confirmed queries.
    expect(campaignArea).toHaveBeenCalledWith('banco_sangre')
  })

  it('admin_area+comercial gets global scope (cross-area)', async () => {
    vi.mocked(requireUserContext).mockResolvedValue({
      userId: 'user-com',
      role: 'admin_area',
      area: 'comercial',
      staffId: null,
      email: 'com@example.com',
      fullName: 'Com Admin',
    })

    mockDb.select = vi.fn(() => makeChain([]))

    await getNotifications()

    // Comercial admin → cross-area → campaignArea recibe null y NO restringe.
    expect(campaignArea).toHaveBeenCalledWith(null)
  })

  it('operativo only sees notifications scoped to their staffId', async () => {
    vi.mocked(requireUserContext).mockResolvedValue({
      userId: 'user-op',
      role: 'operativo',
      area: 'logistica',
      staffId: 'staff-op-1',
      email: 'op@example.com',
      fullName: 'Op',
    })

    mockDb.select = vi.fn(() => makeChain([]))

    await getNotifications()

    // Operativos NO ven confirmedCampaigns ni coordinator query, así que
    // campaignArea solo se invoca una vez (para cancelled).
    expect(campaignArea).toHaveBeenCalledWith('logistica')
    expect(campaignArea).toHaveBeenCalledTimes(1)
  })

  it('operativo NO recibe alertas de hour_bank_deficit', async () => {
    vi.mocked(requireUserContext).mockResolvedValue({
      userId: 'user-op',
      role: 'operativo',
      area: 'banco_sangre',
      staffId: 'staff-op-1',
      email: 'op@example.com',
      fullName: 'Op',
    })
    mockDb.select = vi.fn(() => makeChain([]))
    // Aunque selectDistinctOn devuelva datos, operativo no debería pasar la rama.
    mockDb.selectDistinctOn = vi.fn(() =>
      makeChain([
        {
          staffId: 'staff-op-1',
          bankBalanceMonth: -20,
          bankMonthKey: '2026-06-01',
          firstName: 'Op',
          lastName: 'Test',
        },
      ]),
    )

    const result = await getNotifications()
    const deficit = result.filter((n) => n.type === 'hour_bank_deficit')
    expect(deficit).toHaveLength(0)
    // El query NO se debe haber invocado.
    expect(mockDb.selectDistinctOn).not.toHaveBeenCalled()
  })

  it('admin global recibe hour_bank_deficit cuando saldo <= threshold', async () => {
    setAdmin()
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.selectDistinctOn = vi.fn(() =>
      makeChain([
        {
          staffId: 'staff-1',
          bankBalanceMonth: -12,
          bankMonthKey: '2026-06-01',
          firstName: 'Juan',
          lastName: 'Perez',
        },
      ]),
    )

    const result = await getNotifications()
    const deficit = result.filter((n) => n.type === 'hour_bank_deficit')
    expect(deficit).toHaveLength(1)
    expect(deficit[0].message).toContain('Juan Perez')
    expect(deficit[0].message).toContain('12h')
    expect(deficit[0].title).toBe('Déficit en banco de horas')
  })

  it('admin_area del área del staff sí recibe hour_bank_deficit', async () => {
    vi.mocked(requireUserContext).mockResolvedValue({
      userId: 'user-bds',
      role: 'admin_area',
      area: 'banco_sangre',
      staffId: null,
      email: 'bds@example.com',
      fullName: 'BDS Admin',
    })
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.selectDistinctOn = vi.fn(() =>
      makeChain([
        {
          staffId: 'staff-2',
          bankBalanceMonth: -10,
          bankMonthKey: '2026-06-01',
          firstName: 'Ana',
          lastName: 'Gomez',
        },
      ]),
    )

    const result = await getNotifications()
    const deficit = result.filter((n) => n.type === 'hour_bank_deficit')
    expect(deficit).toHaveLength(1)
    expect(deficit[0].message).toContain('Ana Gomez')
    // Debió invocar el query.
    expect(mockDb.selectDistinctOn).toHaveBeenCalled()
  })
})
