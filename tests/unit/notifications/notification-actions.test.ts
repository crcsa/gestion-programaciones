import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before imports
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
  },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    firstName: 'first_name',
    lastName: 'last_name',
  },
}))

import { db } from '@/lib/db'
import { requireRole } from '@/features/auth/lib/require-role'
import { getNotifications } from '@/features/notifications/actions/notification-actions'

// Helper to create a chainable drizzle mock
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

describe('getNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
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
      if (callCount === 1) return makeChain(cancelledCampaigns) // cancelled campaigns
      if (callCount === 2) return makeChain([]) // confirmed campaigns (empty)
      return makeChain([]) // high extra hours (empty)
    })

    const result = await getNotifications()

    const cancelledNotifs = result.filter((n) => n.type === 'campaign_cancelled')
    expect(cancelledNotifs).toHaveLength(1)
    expect(cancelledNotifs[0].id).toBe('cancelled-camp-1')
    expect(cancelledNotifs[0].title).toBe('Campana cancelada')
    expect(cancelledNotifs[0].message).toContain('CMP-001')
    expect(cancelledNotifs[0].message).toContain('Sin presupuesto disponible')
    expect(cancelledNotifs[0].campaignId).toBe('camp-1')
  })

  it('returns missing coordinator notifications', async () => {
    const confirmedCampaigns = [
      { id: 'camp-2', code: 'CMP-002', createdAt: new Date('2026-03-15T08:00:00Z') },
      { id: 'camp-3', code: 'CMP-003', createdAt: new Date('2026-03-16T08:00:00Z') },
    ]

    // camp-3 has a coordinator, camp-2 does not
    const coordinatorRows = [
      { campaignId: 'camp-3', hasCoordinator: true },
    ]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain([]) // cancelled (empty)
      if (callCount === 2) return makeChain(confirmedCampaigns) // confirmed campaigns
      if (callCount === 3) return makeChain(coordinatorRows) // coordinator query
      return makeChain([]) // high extra hours (empty)
    })

    const result = await getNotifications()

    const missingCoordNotifs = result.filter((n) => n.type === 'missing_coordinator')
    expect(missingCoordNotifs).toHaveLength(1)
    expect(missingCoordNotifs[0].id).toBe('no-coord-camp-2')
    expect(missingCoordNotifs[0].message).toContain('CMP-002')
    expect(missingCoordNotifs[0].campaignId).toBe('camp-2')
  })

  it('returns balance_warning when extraHours >= 10', async () => {
    const highExtraHoursStaff = [
      { staffId: 'staff-1', extraHours: 12, firstName: 'Juan', lastName: 'Perez' },
    ]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain([]) // cancelled (empty)
      if (callCount === 2) return makeChain([]) // confirmed (empty)
      // no coordinator query since confirmed is empty
      return makeChain(highExtraHoursStaff) // high extra hours
    })

    const result = await getNotifications()

    const balanceNotifs = result.filter((n) => n.type === 'balance_warning')
    expect(balanceNotifs).toHaveLength(1)
    expect(balanceNotifs[0].title).toBe('Alerta de horas extras')
    expect(balanceNotifs[0].message).toContain('Juan Perez')
    expect(balanceNotifs[0].message).toContain('12h extras')
  })

  it('throws when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValue(
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
      if (callCount === 1) return makeChain(cancelledCampaigns) // cancelled
      if (callCount === 2) return makeChain(confirmedCampaigns) // confirmed
      if (callCount === 3) return makeChain([]) // coordinator query (none)
      return makeChain([]) // high extra hours
    })

    const result = await getNotifications()

    expect(result.length).toBeGreaterThanOrEqual(2)
    // Most recent first
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        result[i + 1].createdAt.getTime(),
      )
    }
  })

  it('throws generic error when DB fails with non-permiso error', async () => {
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
    mockDb.select = vi.fn(() => { throw new Error('DB connection failed') })

    await expect(getNotifications()).rejects.toThrow('Error al obtener las notificaciones')
  })
})
