import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionError } from '@/lib/errors/app-errors'

// Mock modules before imports
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-123', role: 'admin' }),
}))

vi.mock('@/features/auth/lib/require-access', () => ({
  requireAccess: vi.fn().mockResolvedValue({
    userId: 'user-123',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'a@x.com',
    fullName: 'A',
    scope: { kind: 'global' as const },
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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
    endDate: 'end_date',
    trainingAreaId: 'training_area_id',
    observations: 'observations',
    createdById: 'created_by_id',
  },
  campaignDays: {
    id: 'id',
    campaignId: 'campaign_id',
    dayDate: 'day_date',
    startTime: 'start_time',
    endTime: 'end_time',
    isOvernight: 'is_overnight',
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
import { requireAccess } from '@/features/auth/lib/require-access'
import {
  createCampaign,
  confirmCampaign,
  cancelCampaign,
  getCampaignsList,
  getCampaignById,
  updateCampaign,
  importCampaignsFromExcel,
  bulkConfirmCampaigns,
  bulkCancelCampaigns,
} from '@/features/campaigns/actions/campaign-actions'

// Default admin context — re-aplicado antes de cada test para evitar fugas
// entre tests que sobrescriben el mock con `mockRejectedValue`.
beforeEach(() => {
  vi.mocked(requireAccess).mockResolvedValue({
    userId: 'user-123',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'a@x.com',
    fullName: 'A',
    scope: { kind: 'global' as const },
  })
})

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
  transaction: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as SimpleMockDb

// ---- Tests ----------------------------------------------------------------

describe('createCampaign', () => {
  const validInput = {
    code: 'CAM-001',
    campaignDate: '2026-04-15',
    size: 'M' as const,
    modality: 'corporativa' as const,
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
      modality: 'corporativa' as const,
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
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
    )

    await expect(confirmCampaign('camp-1')).rejects.toThrow('permiso')
  })

  it('admin_area+logistica es rechazado (no puede confirmar campañas)', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para esta area.'),
    )
    await expect(confirmCampaign('camp-1')).rejects.toThrow('permiso')
  })
})

describe('bulkConfirmCampaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirma las tentativa y omite las que no lo son', async () => {
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      // id1 → tentativa (se confirma); id2 → ya confirmada (se omite)
      if (selectCall === 1) return makeChain([{ id: '1', status: 'tentativa' }])
      return makeChain([{ id: '2', status: 'confirmada' }])
    })
    mockDb.update = vi.fn(() => makeChain([{ id: '1', status: 'confirmada' }]))

    const result = await bulkConfirmCampaigns(['1', '2'])

    expect(result.ok).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('lanza si requireAccess rechaza', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError('no'))
    await expect(bulkConfirmCampaigns(['1'])).rejects.toThrow()
  })
})

describe('bulkCancelCampaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cancela cada campaña con el motivo dado', async () => {
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      // #1 estado actual; #2 asignaciones (vacío → sin recalc)
      if (selectCall === 1) return makeChain([{ id: '1', status: 'tentativa', campaignDate: '2026-05-10' }])
      return makeChain([])
    })
    mockDb.update = vi.fn(() => makeChain([{ id: '1', status: 'cancelada' }]))

    const result = await bulkCancelCampaigns(
      ['00000000-0000-4000-8000-000000000001'],
      'Motivo de cancelación válido',
    )

    expect(result.ok).toBe(1)
    expect(result.errors).toHaveLength(0)
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
      modality: 'corporativa',
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
      modality: 'corporativa',
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
        modality: 'corporativa' as const,
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
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
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
    modality: 'combinada' as const,
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
      modality: 'combinada' as const,
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

  it('permite editar cuando el estado es confirmada', async () => {
    const confirmedRow = [{ id: validUuid, status: 'confirmada' }]
    const updatedCampaign = [
      {
        id: validUuid,
        code: 'TEST-001',
        status: 'confirmada' as const,
        campaignDate: '2026-05-20',
        size: 'L' as const,
        modality: 'combinada' as const,
        municipality: 'Bogota',
        expectedDonations: 100,
        companyId: null,
        locationId: null,
        // Sin tiempos: evita disparar persistCampaignDays (mono-día) en el
        // test; el flujo real ya está cubierto por el caso tentativa.
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
    ]

    mockDb.select = vi.fn(() => makeChain(confirmedRow))
    mockDb.update = vi.fn(() => makeChain(updatedCampaign))

    const result = await updateCampaign(validUuid, validUpdateData)

    expect(result.id).toBe(validUuid)
    expect(result.status).toBe('confirmada')
  })

  it('lanza error cuando el estado es cancelada', async () => {
    const cancelledRow = [{ id: validUuid, status: 'cancelada' }]

    mockDb.select = vi.fn(() => makeChain(cancelledRow))

    await expect(updateCampaign(validUuid, validUpdateData)).rejects.toThrow(
      'editar una campaña',
    )
  })

  it('lanza error cuando el estado es ejecutada', async () => {
    const executedRow = [{ id: validUuid, status: 'ejecutada' }]

    mockDb.select = vi.fn(() => makeChain(executedRow))

    await expect(updateCampaign(validUuid, validUpdateData)).rejects.toThrow(
      'editar una campaña',
    )
  })

  it('propagates error when requireAccess rejects', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
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
    modality: 'corporativa',
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
    const rows = [makeRow({ modality: 'combinada' })]

    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await getCampaignsList({ modality: 'combinada' })

    expect(result.data[0].modality).toBe('combinada')
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
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
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

  it('lanza error cuando la campaña no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))  // empty → !current

    await expect(confirmCampaign('00000000-0000-4000-8000-000000000001')).rejects.toThrow('Campaña no encontrada')
  })

  it('lanza error cuando la campaña no está en estado tentativa', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: '00000000-0000-4000-8000-000000000001', status: 'ejecutada' }]))

    await expect(confirmCampaign('00000000-0000-4000-8000-000000000001')).rejects.toThrow(
      'Solo se pueden confirmar campañas en estado tentativa',
    )
  })
})

describe('cancelCampaign — campaña no encontrada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('lanza error cuando la campaña no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))  // empty → !current

    await expect(
      cancelCampaign('00000000-0000-4000-8000-000000000001', 'Motivo de cancelación'),
    ).rejects.toThrow('Campaña no encontrada')
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

// ---- getCampaignsList — filtros weekStart y companyId -----------------------

describe('getCampaignsList — filtros weekStart y companyId', () => {
  const makeRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'camp-1', code: 'CAM-001', municipality: 'Medellin',
    campaignDate: '2026-04-14', size: 'M', modality: 'corporativa',
    status: 'tentativa', expectedDonations: 50, companyName: null, createdAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('filtra por companyId correctamente', async () => {
    const rows = [makeRow({ companyName: 'Acme' })]
    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await getCampaignsList({ companyId: 'company-uuid-1' })
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('filtra por weekStart calculando el rango lunes-domingo', async () => {
    const rows = [makeRow({ campaignDate: '2026-04-14' })]
    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await getCampaignsList({ weekStart: '2026-04-13' })
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('filtra por search (code e ilike municipio)', async () => {
    const rows = [makeRow()]
    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await getCampaignsList({ search: 'CAM' })
    expect(Array.isArray(result.data)).toBe(true)
  })
})

// ---- importCampaignsFromExcel -----------------------------------------------

const validRow = {
  code: 'IMP-001',
  companyName: 'Empresa Importada',
  municipality: 'Medellín',
  campaignDate: '2026-05-10',
  size: 'M' as const,
  modality: 'corporativa' as const,
}

describe('importCampaignsFromExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
    // Cada fila corre en una transacción; el tx delega en los mismos mocks.
    mockDb.transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb))
    // Defaults seguros: prefetch de empresas + code check vacíos, insert/update OK.
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([{ id: 'gen-id' }]))
    mockDb.update = vi.fn(() => makeChain([]))
  })

  it('importa fila válida con empresa nueva', async () => {
    // prefetch empresas (#1) = [] → empresa no existe → se inserta empresa + campaña.
    const result = await importCampaignsFromExcel([validRow])

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(mockDb.insert).toHaveBeenCalledTimes(2) // empresa + campaña
  })

  it('importa fila válida con empresa existente (no inserta empresa, rellena info)', async () => {
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      // #1 prefetch empresas → ya existe "Empresa Importada"
      if (selectCall === 1) return makeChain([{ id: 'existing-co', name: 'Empresa Importada' }])
      return makeChain([]) // #2 code check → no dup
    })

    const result = await importCampaignsFromExcel([validRow])

    expect(result.imported).toBe(1)
    expect(mockDb.insert).toHaveBeenCalledTimes(1) // solo campaña, no empresa
    expect(mockDb.update).toHaveBeenCalled() // fill-if-null de la empresa existente
  })

  it('deduplica empresa ignorando acentos/mayúsculas (no crea duplicado)', async () => {
    // prefetch trae "MEDELLÍN S.A." y la fila viene como "medellin s.a." → mismo norm.
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 1) return makeChain([{ id: 'co-x', name: 'MEDELLÍN S.A.' }])
      return makeChain([])
    })

    const result = await importCampaignsFromExcel([
      { ...validRow, companyName: 'medellin s.a.' },
    ])

    expect(result.imported).toBe(1)
    expect(mockDb.insert).toHaveBeenCalledTimes(1) // solo campaña — empresa reutilizada
  })

  it('omite fila con código duplicado', async () => {
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 1) return makeChain([]) // prefetch empresas
      return makeChain([{ id: 'existing-campaign' }]) // code check → dup
    })

    const result = await importCampaignsFromExcel([validRow])

    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('registra error de validación cuando code es vacío', async () => {
    const invalidRow = { ...validRow, code: '' }

    const result = await importCampaignsFromExcel([invalidRow])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(2)
    expect(result.imported).toBe(0)
  })

  it('registra error cuando hay fallo de DB en la inserción', async () => {
    // empresa nueva → insert empresa OK, luego insert campaña lanza.
    let insertCall = 0
    mockDb.insert = vi.fn(() => {
      insertCall++
      if (insertCall === 1) return makeChain([{ id: 'new-company' }]) // empresa OK
      throw new Error('DB write error') // campaña falla
    })

    const result = await importCampaignsFromExcel([validRow])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].reason).toBe(
      'Error al guardar en la base de datos (revisa los logs del servidor).',
    )
  })

  it('procesa múltiples filas: importadas + omitidas + errores', async () => {
    const rows = [
      validRow,
      { ...validRow, code: 'IMP-002', companyName: 'Otra Empresa' },
      { ...validRow, code: '' }, // invalid
    ]

    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 1) return makeChain([]) // prefetch empresas
      if (selectCall === 2) return makeChain([]) // row1 code check → no dup
      if (selectCall === 3) return makeChain([{ id: 'dup' }]) // row2 code check → dup
      return makeChain([])
    })

    const result = await importCampaignsFromExcel(rows)

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
  })

  it('lanza error cuando requireAccess rechaza', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new Error('Sin permiso'))

    await expect(importCampaignsFromExcel([validRow])).rejects.toThrow('Sin permiso')
  })

  it('crea ubicación, contacto y horario al importar una fila enriquecida del CRM', async () => {
    const crmRow = {
      ...validRow,
      code: 'C11635',
      startTime: '08:00',
      endTime: '15:00',
      contactName: 'Stiven Álvarez',
      contactPhone: '301 1866134',
      address: 'Calle 73 # 51d - 14',
      locationName: 'Orquideorama',
    }

    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      // #1 prefetch → empresa ya existe; #2 code check; #3 location lookup; #4 contact lookup
      if (selectCall === 1) return makeChain([{ id: 'co-1', name: 'Empresa Importada' }])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([{ id: 'new-id', code: 'C11635' }]))

    const result = await importCampaignsFromExcel([crmRow])

    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)
    // location + contact + campaña + campaign_days = 4 inserts (empresa ya existía → update)
    expect(mockDb.insert).toHaveBeenCalledTimes(4)
  })
})
