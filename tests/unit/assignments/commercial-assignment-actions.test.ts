import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  NotFoundError,
  PermissionError,
  ValidationError,
} from '@/lib/errors/app-errors'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/hours/lib/aggregate-staff-data', () => ({
  recalcStaffAggregates: vi.fn().mockResolvedValue(undefined),
  recalcAggregatesForCampaign: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
  recalcAggregatesForDate: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
  recalcStaffAggregatesBatch: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/auth/lib/require-access', () => ({
  requireAccess: vi.fn().mockResolvedValue({
    userId: 'user-comercial',
    role: 'admin_area',
    area: 'comercial',
    staffId: null,
    email: 'comercial@x.com',
    fullName: 'Admin Comercial',
    scope: { kind: 'area' as const, area: 'comercial' as const },
  }),
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    firstName: 'first_name',
    lastName: 'last_name',
    area: 'area',
    staffProfile: 'staff_profile',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    id: 'id',
    campaignId: 'campaign_id',
    staffId: 'staff_id',
    isCoordinator: 'is_coordinator',
    isActive: 'is_active',
    assignedAt: 'assigned_at',
    removedAt: 'removed_at',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: { id: 'id', campaignDate: 'campaign_date' },
}))

import { db } from '@/lib/db'
import {
  getAvailableCommercialStaff,
  getAssignedCommercialStaff,
  assignCommercialStaff,
  removeCommercialAssignment,
} from '@/features/assignments/actions/commercial-assignment-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'insert',
    'values',
    'update',
    'set',
    'delete',
    'returning',
    'leftJoin',
    'innerJoin',
    'onConflictDoUpdate',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as MockDb

const campaignId = '11111111-1111-4111-8111-111111111111'
const staffId = '22222222-2222-4222-8222-222222222222'

describe('getAvailableCommercialStaff', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna operativos comerciales no asignados', async () => {
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) return makeChain([{ staffId: 'already-assigned' }])
      return makeChain([
        { id: staffId, firstName: 'Ana', lastName: 'Pérez' },
        { id: 'already-assigned', firstName: 'Otro', lastName: 'X' },
      ])
    })

    const result = await getAvailableCommercialStaff(campaignId)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(staffId)
  })
})

describe('getAssignedCommercialStaff', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna asignaciones activas del área comercial', async () => {
    mockDb.select = vi.fn(() =>
      makeChain([
        {
          assignmentId: 'a1',
          staffId,
          firstName: 'Ana',
          lastName: 'Pérez',
          assignedAt: new Date(),
        },
      ]),
    )

    const result = await getAssignedCommercialStaff(campaignId)
    expect(result).toHaveLength(1)
    expect(result[0].staffId).toBe(staffId)
  })
})

describe('assignCommercialStaff', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asigna correctamente un operativo comercial válido', async () => {
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) {
        return makeChain([{ id: staffId, area: 'comercial', staffProfile: 'comercial' }])
      }
      if (call === 2) {
        return makeChain([]) // ningún assignment activo previo
      }
      return makeChain([{ campaignDate: '2026-04-15' }])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    await assignCommercialStaff({ campaignId, staffIds: [staffId] })

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('rechaza staff que no es del área comercial', async () => {
    mockDb.select = vi.fn(() =>
      makeChain([{ id: staffId, area: 'banco_sangre', staffProfile: 'bacteriologo' }]),
    )

    await expect(
      assignCommercialStaff({ campaignId, staffIds: [staffId] }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rechaza staff inexistente con NotFoundError', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    await expect(
      assignCommercialStaff({ campaignId, staffIds: [staffId] }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('lanza ValidationError si staffIds está vacío', async () => {
    await expect(
      assignCommercialStaff({ campaignId, staffIds: [] }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('propaga PermissionError si requireAccess rechaza', async () => {
    const { requireAccess } = await import('@/features/auth/lib/require-access')
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para esta area.'),
    )

    await expect(
      assignCommercialStaff({ campaignId, staffIds: [staffId] }),
    ).rejects.toBeInstanceOf(PermissionError)
  })
})

describe('removeCommercialAssignment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-delete + recalc del balance del operativo', async () => {
    mockDb.update = vi.fn(() =>
      makeChain([{ id: 'a1', campaignId, staffId, isActive: false, removedAt: new Date() }]),
    )
    mockDb.select = vi.fn(() => makeChain([{ campaignDate: '2026-04-15' }]))

    await removeCommercialAssignment('a1')

    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('lanza NotFoundError si la asignación no existe', async () => {
    mockDb.update = vi.fn(() => makeChain([]))

    await expect(removeCommercialAssignment('does-not-exist')).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })
})
