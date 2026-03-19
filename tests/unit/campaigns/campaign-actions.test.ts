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
  getCampaignById,
  updateCampaign,
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
      'Ya existe una campaña con ese código',
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
      'ya está confirmada',
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
    ).rejects.toThrow('ya está cancelada')
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

// ---- getCampaignById -------------------------------------------------------

describe('getCampaignById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('retorna campana encontrada exitosamente', async () => {
    const row = {
      campaign: {
        id: 'camp-1',
        code: 'CAM-001',
        status: 'tentativa',
        municipality: 'Medellin',
        campaignDate: '2026-04-15',
        size: 'M' as const,
        modality: 'presencial' as const,
        expectedDonations: 50,
        companyId: null,
        locationId: null,
        startTime: null,
        endTime: null,
        trainingAreaId: null,
        cancelReason: null,
        observations: null,
        createdById: 'user-123',
        confirmedById: null,
        confirmedAt: null,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      companyName: 'Empresa ABC',
    }

    mockDb.select = vi.fn(() => makeChain([row]))

    const result = await getCampaignById('camp-1')

    expect(result.id).toBe('camp-1')
    expect(result.code).toBe('CAM-001')
    expect(result.companyName).toBe('Empresa ABC')
  })

  it('lanza error Campana no encontrada cuando no existe el registro', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    await expect(getCampaignById('nonexistent-id')).rejects.toThrow(
      'Campaña no encontrada',
    )
  })

  it('propagates error when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(getCampaignById('camp-1')).rejects.toThrow('permiso')
  })
})

// ---- updateCampaign --------------------------------------------------------

describe('updateCampaign', () => {
  const validUuid = '00000000-0000-4000-8000-000000000002'
  const validUpdateData = {
    campaignDate: '2026-05-20',
    size: 'L' as const,
    modality: 'virtual' as const,
    municipality: 'Bogota',
    expectedDonations: 100,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('actualiza campana en estado tentativa exitosamente', async () => {
    const currentRow = [{ id: validUuid, status: 'tentativa' }]
    const updatedCampaign = [{
      id: validUuid,
      code: 'CAM-002',
      status: 'tentativa' as const,
      campaignDate: '2026-05-20',
      size: 'L' as const,
      modality: 'virtual' as const,
      municipality: 'Bogota',
      expectedDonations: 100,
      companyId: null,
      locationId: null,
      startTime: null,
      endTime: null,
      trainingAreaId: null,
      cancelReason: null,
      observations: null,
      createdById: 'user-123',
      confirmedById: null,
      confirmedAt: null,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]

    mockDb.select = vi.fn(() => makeChain(currentRow))
    mockDb.update = vi.fn(() => makeChain(updatedCampaign))

    const result = await updateCampaign(validUuid, validUpdateData)

    expect(result.id).toBe(validUuid)
    expect(result.status).toBe('tentativa')
  })

  it('lanza error Campana no encontrada cuando no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    await expect(updateCampaign(validUuid, validUpdateData)).rejects.toThrow(
      'Campaña no encontrada',
    )
  })

  it('lanza error cuando el estado no es tentativa', async () => {
    const confirmedRow = [{ id: validUuid, status: 'confirmada' }]

    mockDb.select = vi.fn(() => makeChain(confirmedRow))

    await expect(updateCampaign(validUuid, validUpdateData)).rejects.toThrow(
      'editar una campaña',
    )
  })

  it('lanza error cuando el estado es cancelada', async () => {
    const cancelledRow = [{ id: validUuid, status: 'cancelada' }]

    mockDb.select = vi.fn(() => makeChain(cancelledRow))

    await expect(updateCampaign(validUuid, validUpdateData)).rejects.toThrow(
      'editar una campaña',
    )
  })

  it('propagates error when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(updateCampaign(validUuid, validUpdateData)).rejects.toThrow(
      'permiso',
    )
  })
})

// ---- getCampaignsList con filtros adicionales ------------------------------

describe('getCampaignsList con filtros adicionales', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  const makeRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'camp-1',
    code: 'CAM-001',
    municipality: 'Medellin',
    campaignDate: '2026-04-15',
    size: 'M',
    modality: 'presencial',
    status: 'tentativa',
    expectedDonations: 50,
    companyName: null,
    createdAt: new Date(),
    ...overrides,
  })

  it('filtra por size y retorna resultados', async () => {
    const rows = [makeRow({ size: 'L' })]

    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await getCampaignsList({ size: 'L' })

    expect(result.data[0].size).toBe('L')
  })

  it('filtra por modality y retorna resultados', async () => {
    const rows = [makeRow({ modality: 'virtual' })]

    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await getCampaignsList({ modality: 'virtual' })

    expect(result.data[0].modality).toBe('virtual')
  })

  it('filtra por dateFrom y retorna resultados', async () => {
    const rows = [makeRow({ campaignDate: '2026-06-01' })]

    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await getCampaignsList({ dateFrom: '2026-06-01' })

    expect(Array.isArray(result.data)).toBe(true)
  })

  it('filtra por dateTo y retorna resultados', async () => {
    const rows = [makeRow({ campaignDate: '2026-03-31' })]

    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await getCampaignsList({ dateTo: '2026-03-31' })

    expect(Array.isArray(result.data)).toBe(true)
  })

  it('combina filtros dateFrom y dateTo', async () => {
    const rows = [
      makeRow({ campaignDate: '2026-04-10' }),
      makeRow({ id: 'camp-2', code: 'CAM-002', campaignDate: '2026-04-20' }),
    ]

    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await getCampaignsList({
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    })

    expect(result.data.length).toBe(2)
  })

  it('retorna lista vacia cuando no hay resultados con los filtros', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getCampaignsList({
      status: 'ejecutada',
      size: 'S',
    })

    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })

  it('propagates error when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(getCampaignsList()).rejects.toThrow('permiso')
  })
})

// ---- Cobertura de ramas adicionales ----------------------------------------

describe('cancelCampaign — ramas adicionales', () => {
  const validCancelId = '00000000-0000-4000-8000-000000000099'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('lanza error cuando la campaña ya está cancelada', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: validCancelId, status: 'cancelada' }]))

    await expect(
      cancelCampaign(validCancelId, 'Motivo de prueba'),
    ).rejects.toThrow('La campaña ya está cancelada')
  })

  it('lanza error cuando la campaña está ejecutada', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: validCancelId, status: 'ejecutada' }]))

    await expect(
      cancelCampaign(validCancelId, 'Motivo de prueba'),
    ).rejects.toThrow('No se puede cancelar una campaña ejecutada')
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(
      cancelCampaign(validCancelId, 'Motivo de prueba'),
    ).rejects.toThrow('Error al cancelar la campaña')
  })
})

describe('getCampaignsList — ramas de error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(getCampaignsList()).rejects.toThrow('Error al obtener la lista de campañas')
  })
})

describe('confirmCampaign — generic error path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('wraps generic DB error with friendly message', async () => {
    mockDb.select = vi.fn(() => { throw new Error('DB down') })

    await expect(confirmCampaign('00000000-0000-4000-8000-000000000001')).rejects.toThrow('Error al confirmar')
  })
})

describe('getAssignedStaffForCommercial — error path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('wraps generic DB error with friendly message', async () => {
    mockDb.select = vi.fn(() => { throw new Error('DB down') })

    const { getAssignedStaffForCommercial } = await import('@/features/campaigns/actions/campaign-actions')
    await expect(getAssignedStaffForCommercial('00000000-0000-4000-8000-000000000001')).rejects.toThrow('Error al obtener')
  })
})
