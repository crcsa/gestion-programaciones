import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'admin' }),
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    staffId: 'staff_id', campaignId: 'campaign_id', isActive: 'is_active', isCoordinator: 'is_coordinator',
    assignedAt: 'assigned_at',
  },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id', firstName: 'first_name', lastName: 'last_name',
    cedula: 'cedula', staffProfile: 'staff_profile',
  },
}))

vi.mock('@/lib/db/schema/companies', () => ({
  companies: { id: 'id', name: 'name' },
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import { requireRole } from '@/features/auth/lib/require-role'
import { getAssignedStaffForCommercial } from '@/features/campaigns/actions/campaign-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'orderBy', 'leftJoin']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

const campaignId = '550e8400-e29b-41d4-a716-446655440000'

const mockStaffRows = [
  {
    staffId: 'staff-1',
    firstName: 'María',
    lastName: 'González',
    cedula: '1023456789',
    staffProfile: 'bacteriologo',
    isCoordinator: true,
  },
  {
    staffId: 'staff-2',
    firstName: 'Carlos',
    lastName: 'Rodríguez',
    cedula: '9876543210',
    staffProfile: 'tecnico',
    isCoordinator: false,
  },
]

describe('getAssignedStaffForCommercial', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns staff with cedula field included', async () => {
    mockDb.select = vi.fn(() => makeChain(mockStaffRows))

    const result = await getAssignedStaffForCommercial(campaignId)
    expect(result).toHaveLength(2)
    expect(result[0].cedula).toBe('1023456789')
    expect(result[1].cedula).toBe('9876543210')
  })

  it('includes isCoordinator flag', async () => {
    mockDb.select = vi.fn(() => makeChain(mockStaffRows))

    const result = await getAssignedStaffForCommercial(campaignId)
    expect(result[0].isCoordinator).toBe(true)
    expect(result[1].isCoordinator).toBe(false)
  })

  it('requires admin or comercial role', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(getAssignedStaffForCommercial(campaignId)).rejects.toThrow('permiso')
  })

  it('returns empty array when no staff assigned', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getAssignedStaffForCommercial(campaignId)
    expect(result).toHaveLength(0)
  })
})
