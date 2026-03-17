import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-123', role: 'admin' }),
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id',
    code: 'code',
    status: 'status',
    companyId: 'company_id',
    campaignDate: 'campaign_date',
    size: 'size',
    municipality: 'municipality',
    isDeleted: 'is_deleted',
  },
}))

vi.mock('@/lib/db/schema/companies', () => ({
  companies: { id: 'id', name: 'name' },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: { id: 'id', isActive: 'is_active' },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    id: 'id',
    staffId: 'staff_id',
    shiftDate: 'shift_date',
    shiftType: 'shift_type',
    startTime: 'start_time',
    endTime: 'end_time',
    totalHours: 'total_hours',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    id: 'id',
    staffId: 'staff_id',
    campaignId: 'campaign_id',
    isCoordinator: 'is_coordinator',
    isActive: 'is_active',
  },
}))

import { db } from '@/lib/db'
import { requireRole } from '@/features/auth/lib/require-role'
import {
  getAdminDashboardData,
  getComercialDashboardData,
  getOperativoDashboardData,
} from '@/features/dashboard/actions/dashboard-actions'

// Helper to create a chainable drizzle mock
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning',
    'leftJoin', 'innerJoin',
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
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as SimpleMockDb

// ---- getAdminDashboardData ------------------------------------------------

describe('getAdminDashboardData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve estructura correcta con datos reales', async () => {
    // Promise.all calls select 4 times; return different values per call
    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      const values = [
        [{ value: 5 }],          // active staff
        [{ value: 3 }],          // campaigns this week
        [{ id: 'c1', code: 'CAM-001', municipality: 'Medellín', campaignDate: '2026-04-10', size: 'M', status: 'confirmada', companyName: 'ACME' }],
        [{ value: 2 }],          // sede today
      ]
      return makeChain(values[callCount - 1])
    })

    const result = await getAdminDashboardData()

    expect(result.activeStaffCount).toBe(5)
    expect(result.campaignsThisWeek).toBe(3)
    expect(result.upcomingCampaigns).toHaveLength(1)
    expect(result.upcomingCampaigns[0].code).toBe('CAM-001')
    expect(result.sedeToday).toBe(2)
  })

  it('lanza error cuando requireRole rechaza', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(getAdminDashboardData()).rejects.toThrow('permiso')
  })

  it('devuelve ceros cuando no hay datos', async () => {
    mockDb.select = vi.fn(() => makeChain([{ value: 0 }]))

    const result = await getAdminDashboardData()

    expect(result.activeStaffCount).toBe(0)
    expect(result.campaignsThisWeek).toBe(0)
    expect(result.sedeToday).toBe(0)
  })
})

// ---- getComercialDashboardData --------------------------------------------

describe('getComercialDashboardData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve tentativas y confirmadas separadas', async () => {
    let callCount = 0
    const tentativa = [{ id: 't1', code: 'CAM-T1', municipality: 'Bello', campaignDate: '2026-04-05', size: 'S', status: 'tentativa', companyName: null }]
    const confirmada = [{ id: 'c1', code: 'CAM-C1', municipality: 'Medellín', campaignDate: '2026-04-10', size: 'M', status: 'confirmada', companyName: 'ACME' }]

    mockDb.select = vi.fn(() => {
      callCount++
      return makeChain(callCount === 1 ? tentativa : confirmada)
    })

    const result = await getComercialDashboardData()

    expect(result.pendingTentativeCampaigns).toHaveLength(1)
    expect(result.pendingTentativeCampaigns[0].status).toBe('tentativa')
    expect(result.upcomingConfirmedCampaigns).toHaveLength(1)
    expect(result.upcomingConfirmedCampaigns[0].status).toBe('confirmada')
  })

  it('lanza error cuando requireRole rechaza', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(getComercialDashboardData()).rejects.toThrow('permiso')
  })

  it('devuelve arrays vacíos cuando no hay campañas', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getComercialDashboardData()

    expect(result.pendingTentativeCampaigns).toHaveLength(0)
    expect(result.upcomingConfirmedCampaigns).toHaveLength(0)
  })
})

// ---- getOperativoDashboardData -------------------------------------------

describe('getOperativoDashboardData', () => {
  const STAFF_ID = 'staff-abc'

  beforeEach(() => vi.clearAllMocks())

  it('devuelve turnos y asignaciones del operativo', async () => {
    const shifts = [
      { id: 's1', shiftDate: '2026-03-17', shiftType: 'diurno_completo', startTime: '07:00', endTime: '19:00', totalHours: 12 },
    ]
    const assignments = [
      { id: 'a1', campaignId: 'c1', campaignDate: '2026-03-18', municipality: 'Medellín', code: 'CAM-001', isCoordinator: false },
    ]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      return makeChain(callCount === 1 ? shifts : assignments)
    })

    const result = await getOperativoDashboardData(STAFF_ID)

    expect(result.myWeeklyShifts).toHaveLength(1)
    expect(result.myWeeklyShifts[0].shiftType).toBe('diurno_completo')
    expect(result.myCampaignAssignments).toHaveLength(1)
    expect(result.myCampaignAssignments[0].code).toBe('CAM-001')
    expect(result.staffMemberId).toBe(STAFF_ID)
  })

  it('calcula weeklyHoursSum correctamente', async () => {
    const shifts = [
      { id: 's1', shiftDate: '2026-03-17', shiftType: 'diurno_completo', startTime: '07:00', endTime: '19:00', totalHours: 8 },
      { id: 's2', shiftDate: '2026-03-18', shiftType: 'noche', startTime: '19:00', endTime: '07:00', totalHours: 10 },
    ]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      return makeChain(callCount === 1 ? shifts : [])
    })

    const result = await getOperativoDashboardData(STAFF_ID)

    expect(result.weeklyHoursSum).toBe(18)
  })

  it('devuelve arrays vacíos cuando no hay actividad', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getOperativoDashboardData(STAFF_ID)

    expect(result.myWeeklyShifts).toHaveLength(0)
    expect(result.myCampaignAssignments).toHaveLength(0)
    expect(result.weeklyHoursSum).toBe(0)
  })

  it('lanza error cuando requireRole rechaza', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(getOperativoDashboardData(STAFF_ID)).rejects.toThrow('permiso')
  })
})
