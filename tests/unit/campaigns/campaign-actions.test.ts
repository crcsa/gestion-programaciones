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
    createdById: 'created_by_id',
  },
}))

vi.mock('@/lib/db/schema/companies', () => ({
  companies: { id: 'id', name: 'name' },
}))

import { db } from '@/lib/db'
import { requireRole } from '@/features/auth/lib/require-role'
import {
  createCampaign,
  confirmCampaign,
  cancelCampaign,
  getCampaignsList,
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

// ---- Tests ----------------------------------------------------------------

describe('createCampaign', () => {
  const validInput = {
    code: 'CAM-001',
    campaignDate: '2026-04-15',
    size: 'M' as const,
    modality: 'presencial' as const,
    municipality: 'Medellin',
    expectedDonations: 50,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza codigo duplicado', async () => {
    const existingCampaign = [{ id: 'existing-id' }]

    const selectChain = makeChain(existingCampaign)
    mockDb.select = vi.fn(() => selectChain)

    await expect(createCampaign(validInput)).rejects.toThrow(
      'Ya existe una campana con ese codigo',
    )
  })

  it('crea campana exitosamente cuando codigo no existe', async () => {
    const createdCampaign = {
      id: 'new-id',
      code: 'CAM-001',
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
      createdById: 'user-123',
      confirmedById: null,
      confirmedAt: null,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // select (code check) returns empty
    mockDb.select = vi.fn(() => makeChain([]))
    // insert returns created campaign
    mockDb.insert = vi.fn(() => makeChain([createdCampaign]))

    const result = await createCampaign(validInput)
    expect(result.code).toBe('CAM-001')
    expect(result.id).toBe('new-id')
    expect(result.status).toBe('tentativa')
  })

  it('rechaza campos invalidos', async () => {
    const invalidInput = { code: 'AB' } as never

    await expect(createCampaign(invalidInput)).rejects.toThrow()
  })
})

describe('confirmCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('confirma campana tentativa', async () => {
    const existingCampaign = [{ id: 'camp-1', status: 'tentativa' }]
    const confirmedCampaign = [{
      id: 'camp-1',
      status: 'confirmada',
      confirmedById: 'user-123',
      confirmedAt: new Date(),
    }]

    mockDb.select = vi.fn(() => makeChain(existingCampaign))
    mockDb.update = vi.fn(() => makeChain(confirmedCampaign))

    const result = await confirmCampaign('camp-1')
    expect(result.status).toBe('confirmada')
  })

  it('lanza error si ya esta confirmada', async () => {
    const existingCampaign = [{ id: 'camp-1', status: 'confirmada' }]

    mockDb.select = vi.fn(() => makeChain(existingCampaign))

    await expect(confirmCampaign('camp-1')).rejects.toThrow(
      'ya esta confirmada',
    )
  })

  it('solo permite a admin y comercial', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(confirmCampaign('camp-1')).rejects.toThrow('permiso')
  })
})

describe('cancelCampaign', () => {
  const validUuid = '00000000-0000-4000-8000-000000000001'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('cancela campana con motivo valido', async () => {
    const existingCampaign = [{ id: validUuid, status: 'confirmada' }]
    const cancelledCampaign = [{
      id: validUuid,
      status: 'cancelada',
      cancelReason: 'La empresa cancelo el evento programado',
    }]

    mockDb.select = vi.fn(() => makeChain(existingCampaign))
    mockDb.update = vi.fn(() => makeChain(cancelledCampaign))

    const result = await cancelCampaign(
      validUuid,
      'La empresa cancelo el evento programado',
    )
    expect(result.status).toBe('cancelada')
  })

  it('rechaza motivo de menos de 10 caracteres', async () => {
    await expect(
      cancelCampaign(validUuid, 'corto'),
    ).rejects.toThrow('al menos 10 caracteres')
  })

  it('lanza error si ya esta cancelada', async () => {
    const existingCampaign = [{ id: validUuid, status: 'cancelada' }]

    mockDb.select = vi.fn(() => makeChain(existingCampaign))

    await expect(
      cancelCampaign(validUuid, 'Motivo suficientemente largo para pasar'),
    ).rejects.toThrow('ya esta cancelada')
  })
})

describe('getCampaignsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('retorna lista paginada con total', async () => {
    const campaignRows = Array.from({ length: 3 }, (_, i) => ({
      id: `camp-${i}`,
      code: `CAM-00${i}`,
      municipality: 'Medellin',
      campaignDate: '2026-04-15',
      size: 'M',
      modality: 'presencial',
      status: 'tentativa',
      expectedDonations: 50,
      companyName: 'Empresa ABC',
      createdAt: new Date(),
    }))

    mockDb.select = vi.fn(() => makeChain(campaignRows))

    const result = await getCampaignsList({ page: 1, limit: 20 })

    expect(Array.isArray(result.data)).toBe(true)
    expect(typeof result.total).toBe('number')
  })

  it('filtra por status correctamente', async () => {
    const confirmedRows = [{
      id: 'camp-1',
      code: 'CAM-001',
      municipality: 'Medellin',
      campaignDate: '2026-04-15',
      size: 'M',
      modality: 'presencial',
      status: 'confirmada',
      expectedDonations: 50,
      companyName: 'Empresa ABC',
      createdAt: new Date(),
    }]

    mockDb.select = vi.fn(() => makeChain(confirmedRows))

    const result = await getCampaignsList({ status: 'confirmada' })

    expect(result.data[0].status).toBe('confirmada')
  })
})
