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
    companyId: 'company_id',
    campaignDate: 'campaign_date',
    size: 'size',
    modality: 'modality',
    status: 'status',
    municipality: 'municipality',
    hexabankCode: 'hexabank_code',
    isDeleted: 'is_deleted',
  },
}))

vi.mock('@/lib/db/schema/companies', () => ({
  companies: {
    id: 'id',
    name: 'name',
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

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    firstName: 'first_name',
    lastName: 'last_name',
    staffProfile: 'staff_profile',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/weekly-balance', () => ({
  weeklyBalance: {
    id: 'id',
    staffId: 'staff_id',
    weekStart: 'week_start',
    workedHours: 'worked_hours',
    sedeHours: 'sede_hours',
    campaignHours: 'campaign_hours',
    extraHours: 'extra_hours',
    sundayCount: 'sunday_count',
    overnightCount: 'overnight_count',
  },
}))

vi.mock('@/features/hours/actions/hours-actions', () => ({
  getWeeklyBalances: vi.fn().mockResolvedValue([]),
}))

import { db } from '@/lib/db'
import { requireRole } from '@/features/auth/lib/require-role'
import { getWeeklyBalances } from '@/features/hours/actions/hours-actions'
import {
  getCampaignsReport,
  getPersonalReport,
  getHoursReport,
} from '@/features/reports/actions/report-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning',
    'leftJoin', 'groupBy',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as MockDb

describe('getCampaignsReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns filtered campaign results', async () => {
    const mockCampaigns = [
      {
        id: 'c1',
        code: 'CAM-001',
        companyName: 'Empresa A',
        municipality: 'Medellin',
        campaignDate: '2026-03-15',
        size: 'M',
        modality: 'corporativa',
        status: 'confirmada',
        hexabankCode: 'HX-001',
        assignedCount: 3,
      },
    ]

    const mockCoordinators = [
      { campaignId: 'c1', firstName: 'Juan', lastName: 'Perez' },
    ]

    // First select: campaigns query
    const campaignChain = makeChain(mockCampaigns)
    // Second select: coordinators query
    const coordChain = makeChain(mockCoordinators)

    mockDb.select
      .mockReturnValueOnce(campaignChain)
      .mockReturnValueOnce(coordChain)

    const result = await getCampaignsReport({ dateFrom: '2026-03-01', dateTo: '2026-03-31' })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'c1',
      code: 'CAM-001',
      companyName: 'Empresa A',
      municipality: 'Medellin',
      campaignDate: '2026-03-15',
      size: 'M',
      modality: 'corporativa',
      status: 'confirmada',
      assignedCount: 3,
      coordinator: 'Juan Perez',
      hexabankCode: 'HX-001',
    })
  })

  it('applies dateFrom, dateTo, and status filters', async () => {
    const campaignChain = makeChain([])
    mockDb.select.mockReturnValueOnce(campaignChain)

    await getCampaignsReport({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      status: 'confirmada',
    })

    expect(mockDb.select).toHaveBeenCalledTimes(1)
    expect(campaignChain.from).toHaveBeenCalled()
    expect(campaignChain.where).toHaveBeenCalled()
  })

  it('returns empty array when no campaigns match', async () => {
    const campaignChain = makeChain([])
    mockDb.select.mockReturnValueOnce(campaignChain)

    const result = await getCampaignsReport({ status: 'cancelada' })

    expect(result).toEqual([])
  })

  it('throws permiso error when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(getCampaignsReport({})).rejects.toThrow('permiso')
  })

  it('applies companyId filter when provided', async () => {
    const campaignChain = makeChain([])
    mockDb.select.mockReturnValueOnce(campaignChain)

    await getCampaignsReport({ companyId: '00000000-0000-4000-8000-000000000001' })

    expect(campaignChain.where).toHaveBeenCalled()
  })

  it('throws generic error when DB fails', async () => {
    mockDb.select = vi.fn(() => { throw new Error('DB connection failed') })

    await expect(getCampaignsReport({})).rejects.toThrow('Error al obtener el reporte de campanas')
  })

  it('returns campaign with null coordinator when none assigned', async () => {
    const mockCampaigns = [
      {
        id: 'c2', code: 'CAM-002', companyName: null, municipality: 'Bello',
        campaignDate: '2026-03-20', size: 'S', modality: 'unidad_movil',
        status: 'tentativa', hexabankCode: null, assignedCount: 0,
      },
    ]
    const campaignChain = makeChain(mockCampaigns)
    const coordChain = makeChain([])

    mockDb.select
      .mockReturnValueOnce(campaignChain)
      .mockReturnValueOnce(coordChain)

    const result = await getCampaignsReport({})

    expect(result[0].coordinator).toBeNull()
  })
})

describe('getPersonalReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aggregates correctly across multiple weekStarts', async () => {
    const mockStaff = [
      { id: 's1', firstName: 'Ana', lastName: 'Lopez', staffProfile: 'bacteriologo' },
    ]

    const mockBalances = [
      { staffId: 's1', workedHours: 44, extraHours: 0, sundayCount: 0, overnightCount: 1 },
      { staffId: 's1', workedHours: 48, extraHours: 4, sundayCount: 1, overnightCount: 0 },
    ]

    const mockCampaignCounts = [
      { staffId: 's1', campaignCount: 5 },
    ]

    // First select: active staff
    const staffChain = makeChain(mockStaff)
    // Second select: weekly balances
    const balanceChain = makeChain(mockBalances)
    // Third select: campaign counts
    const campaignCountChain = makeChain(mockCampaignCounts)

    mockDb.select
      .mockReturnValueOnce(staffChain)
      .mockReturnValueOnce(balanceChain)
      .mockReturnValueOnce(campaignCountChain)

    const result = await getPersonalReport({
      dateFrom: '2026-03-02',
      dateTo: '2026-03-15',
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      staffId: 's1',
      firstName: 'Ana',
      lastName: 'Lopez',
      staffProfile: 'bacteriologo',
      totalWorkedHours: 92,
      totalExtraHours: 4,
      totalSundayCount: 1,
      totalOvernightCount: 1,
      totalCampaigns: 5,
    })
  })

  it('returns empty array when no active staff', async () => {
    const staffChain = makeChain([])
    mockDb.select.mockReturnValueOnce(staffChain)

    const result = await getPersonalReport({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
    })

    expect(result).toEqual([])
  })

  it('throws permiso error when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(
      getPersonalReport({ dateFrom: '2026-03-01', dateTo: '2026-03-31' }),
    ).rejects.toThrow('permiso')
  })

  it('throws generic error when DB fails', async () => {
    mockDb.select = vi.fn(() => { throw new Error('DB connection failed') })

    await expect(
      getPersonalReport({ dateFrom: '2026-03-01', dateTo: '2026-03-31' }),
    ).rejects.toThrow('Error al obtener el reporte de personal')
  })

  it('returns staff with zero totals when no balance records exist', async () => {
    const mockStaff = [
      { id: 's2', firstName: 'Pedro', lastName: 'García', staffProfile: 'tecnico' },
    ]
    const staffChain = makeChain(mockStaff)
    const balanceChain = makeChain([])
    const countChain = makeChain([])

    mockDb.select
      .mockReturnValueOnce(staffChain)
      .mockReturnValueOnce(balanceChain)
      .mockReturnValueOnce(countChain)

    const result = await getPersonalReport({ dateFrom: '2026-03-01', dateTo: '2026-03-07' })

    expect(result[0].totalWorkedHours).toBe(0)
    expect(result[0].totalCampaigns).toBe(0)
  })

  it('handles dateFrom on a Sunday (adjusts to prior Monday)', async () => {
    // 2026-03-01 is a Sunday — should adjust back to Monday 2026-02-23
    const staffChain = makeChain([
      { id: 's1', firstName: 'Ana', lastName: 'Lopez', staffProfile: 'bacteriologo' },
    ])
    const balanceChain = makeChain([])
    const countChain = makeChain([])

    mockDb.select
      .mockReturnValueOnce(staffChain)
      .mockReturnValueOnce(balanceChain)
      .mockReturnValueOnce(countChain)

    const result = await getPersonalReport({ dateFrom: '2026-03-01', dateTo: '2026-03-01' })

    expect(result).toHaveLength(1)
  })

  it('returns empty when dateFrom is after dateTo (no weeks in range)', async () => {
    const staffChain = makeChain([
      { id: 's1', firstName: 'Ana', lastName: 'Lopez', staffProfile: 'bacteriologo' },
    ])
    // When weekStarts is empty, balances query is skipped — only 2 selects
    const countChain = makeChain([])

    mockDb.select
      .mockReturnValueOnce(staffChain)
      .mockReturnValueOnce(countChain)

    const result = await getPersonalReport({ dateFrom: '2026-04-15', dateTo: '2026-04-01' })

    // Staff returned but with zero totals (no weeks)
    expect(result[0].totalWorkedHours).toBe(0)
  })
})

describe('getHoursReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls getWeeklyBalances and returns result', async () => {
    const mockRows = [
      {
        staffId: 's1',
        firstName: 'Ana',
        lastName: 'Lopez',
        staffProfile: 'bacteriologo',
        weekStart: '2026-03-16',
        sedeHours: 20,
        campaignHours: 24,
        workedHours: 44,
        extraHours: 0,
        sundayCount: 0,
        overnightCount: 0,
        balanceState: 'cumplió' as const,
        carryOverHours: 0,
      },
    ]

    vi.mocked(getWeeklyBalances).mockResolvedValueOnce(mockRows)

    const result = await getHoursReport('2026-03-16')

    expect(getWeeklyBalances).toHaveBeenCalledWith('2026-03-16')
    expect(result).toEqual(mockRows)
  })

  it('throws permiso error when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(getHoursReport('2026-03-16')).rejects.toThrow('permiso')
  })

  it('throws generic error when getWeeklyBalances fails with non-permiso error', async () => {
    vi.mocked(getWeeklyBalances).mockRejectedValueOnce(new Error('DB timeout'))

    await expect(getHoursReport('2026-03-16')).rejects.toThrow('Error al obtener el reporte de horas')
  })
})
