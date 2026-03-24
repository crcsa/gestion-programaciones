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
    companyId: 'company_id',
    campaignDate: 'campaign_date',
    size: 'size',
    modality: 'modality',
    municipality: 'municipality',
    isDeleted: 'is_deleted',
    confirmedAt: 'confirmed_at',
    confirmedById: 'confirmed_by_id',
    cancelReason: 'cancel_reason',
    updatedAt: 'updated_at',
    expectedDonations: 'expected_donations',
    createdAt: 'created_at',
    locationId: 'location_id',
    startTime: 'start_time',
    endTime: 'end_time',
    trainingAreaId: 'training_area_id',
    observations: 'observations',
    hexabankCode: 'hexabank_code',
    createdById: 'created_by_id',
  },
}))

vi.mock('@/lib/db/schema/companies', () => ({
  companies: { id: 'id', name: 'name' },
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
    cedula: 'cedula',
    staffProfile: 'staff_profile',
    profileId: 'profile_id',
  },
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import {
  getCampaignById,
  updateCampaign,
  createCampaign,
} from '@/features/campaigns/actions/campaign-actions'

// Helper to create a chainable drizzle mock
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning', 'leftJoin',
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

const CAMPAIGN_UUID = '00000000-0000-4000-8000-000000000001'

describe('Hexabank code integration', () => {
  const baseCampaign = {
    id: CAMPAIGN_UUID,
    code: 'CMP-001',
    companyId: null,
    locationId: null,
    campaignDate: '2026-04-15',
    startTime: null,
    endTime: null,
    size: 'M' as const,
    modality: 'presencial' as const,
    status: 'tentativa' as const,
    municipality: 'Medellin',
    expectedDonations: 50,
    trainingAreaId: null,
    cancelReason: null,
    observations: null,
    hexabankCode: 'HXB-123',
    createdById: 'user-123',
    confirmedById: null,
    confirmedAt: null,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getCampaignById returns campaign with hexabankCode field', async () => {
    const row = { campaign: baseCampaign, companyName: 'Empresa ABC' }
    mockDb.select = vi.fn(() => makeChain([row]))

    const result = await getCampaignById(CAMPAIGN_UUID)

    expect(result.hexabankCode).toBe('HXB-123')
    expect(result.companyName).toBe('Empresa ABC')
    expect(result.code).toBe('CMP-001')
  })

  it('updateCampaign with hexabankCode saves correctly', async () => {
    // First select returns the existing tentativa campaign
    const currentCampaign = { id: CAMPAIGN_UUID, status: 'tentativa' }
    const updatedCampaign = { ...baseCampaign, hexabankCode: 'HXB-456' }

    mockDb.select = vi.fn(() => makeChain([currentCampaign]))

    const updateChain = makeChain([updatedCampaign])
    mockDb.update = vi.fn(() => updateChain)

    const result = await updateCampaign(CAMPAIGN_UUID, {
      campaignDate: '2026-04-15',
      size: 'M',
      modality: 'presencial',
      municipality: 'Medellin',
      hexabankCode: 'HXB-456',
    })

    expect(result.hexabankCode).toBe('HXB-456')
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('createCampaign with hexabankCode creates correctly', async () => {
    const createdCampaign = { ...baseCampaign, hexabankCode: 'HXB-789' }

    // select (code check) returns empty
    mockDb.select = vi.fn(() => makeChain([]))
    // insert returns created campaign
    mockDb.insert = vi.fn(() => makeChain([createdCampaign]))

    const result = await createCampaign({
      code: 'CMP-001',
      campaignDate: '2026-04-15',
      size: 'M',
      modality: 'presencial',
      municipality: 'Medellin',
      expectedDonations: 50,
      hexabankCode: 'HXB-789',
    })

    expect(result.hexabankCode).toBe('HXB-789')
    expect(result.code).toBe('CMP-001')
    expect(mockDb.insert).toHaveBeenCalled()
  })
})
