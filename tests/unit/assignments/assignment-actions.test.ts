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

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    id: 'id',
    campaignId: 'campaign_id',
    staffId: 'staff_id',
    isActive: 'is_active',
    isCoordinator: 'is_coordinator',
    removedAt: 'removed_at',
    assignedAt: 'assigned_at',
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

import { db } from '@/lib/db'
import {
  assignStaff,
  removeAssignment,
  setCoordinator,
  getAvailableStaff,
  getAssignedStaff,
} from '@/features/assignments/actions/assignment-actions'

// Helper to create a chainable drizzle mock
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning',
    'leftJoin',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type SimpleMockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as SimpleMockDb

describe('assignStaff', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000'
  const staffId1 = '550e8400-e29b-41d4-a716-446655440001'
  const staffId2 = '550e8400-e29b-41d4-a716-446655440002'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('asigna personal a la campaña correctamente', async () => {
    // First select: existing assignments → empty
    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      return makeChain([])
    })
    const insertChain = makeChain([])
    mockDb.insert = vi.fn(() => insertChain)

    await assignStaff({ campaignId, staffIds: [staffId1, staffId2] })

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('rechaza lista vacía de staffIds', async () => {
    await expect(
      assignStaff({ campaignId, staffIds: [] }),
    ).rejects.toThrow('Debe seleccionar al menos un funcionario')
  })
})

describe('removeAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hace soft delete del assignment', async () => {
    const updatedRow = { id: 'assign-1', isActive: false, removedAt: new Date() }
    const updateChain = makeChain([updatedRow])
    mockDb.update = vi.fn(() => updateChain)

    await removeAssignment('assign-1')

    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('lanza error si la asignación no existe', async () => {
    const updateChain = makeChain([])
    mockDb.update = vi.fn(() => updateChain)

    await expect(removeAssignment('no-existe')).rejects.toThrow(
      'Asignacion no encontrada',
    )
  })
})

describe('setCoordinator', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000'
  const staffId = '550e8400-e29b-41d4-a716-446655440001'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lanza error si el staff no está asignado', async () => {
    // select returns assignments that do NOT include the target staffId
    mockDb.select = vi.fn(() =>
      makeChain([{ staffId: '550e8400-e29b-41d4-a716-446655440099' }]),
    )

    await expect(
      setCoordinator({ campaignId, staffId }),
    ).rejects.toThrow('El funcionario no está asignado a esta campaña')
  })

  it('designa coordinador correctamente', async () => {
    // select returns assignments that include the target staffId
    mockDb.select = vi.fn(() => makeChain([{ staffId }]))
    const updateChain = makeChain([])
    mockDb.update = vi.fn(() => updateChain)

    await setCoordinator({ campaignId, staffId })

    // Two update calls: one to clear previous coordinator, one to set new
    expect(mockDb.update).toHaveBeenCalledTimes(2)
  })
})

describe('getAvailableStaff', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('excluye staff ya asignado', async () => {
    const staffId1 = 'staff-1'
    const staffId2 = 'staff-2'

    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        // First call: assigned staff IDs
        return makeChain([{ staffId: staffId1 }])
      }
      // Second call: all active staff
      return makeChain([
        { id: staffId1, firstName: 'Ana', lastName: 'Garcia', staffProfile: 'bacteriologo' },
        { id: staffId2, firstName: 'Luis', lastName: 'Lopez', staffProfile: 'tecnico' },
      ])
    })

    const result = await getAvailableStaff(campaignId)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(staffId2)
  })
})

describe('getAssignedStaff', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna el personal asignado a la campaña', async () => {
    const assignedRows = [
      {
        assignmentId: 'a-1',
        staffId: 's-1',
        firstName: 'Ana',
        lastName: 'Garcia',
        staffProfile: 'bacteriologo',
        isCoordinator: true,
        assignedAt: new Date(),
      },
      {
        assignmentId: 'a-2',
        staffId: 's-2',
        firstName: 'Luis',
        lastName: 'Lopez',
        staffProfile: 'tecnico',
        isCoordinator: false,
        assignedAt: new Date(),
      },
    ]

    mockDb.select = vi.fn(() => makeChain(assignedRows))

    const result = await getAssignedStaff(campaignId)

    expect(result).toHaveLength(2)
    expect(result[0].isCoordinator).toBe(true)
    expect(result[1].staffProfile).toBe('tecnico')
  })
})

// ---- Cobertura de ramas adicionales ----------------------------------------

describe('assignStaff — ramas de error', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000'
  const staffId1 = '550e8400-e29b-41d4-a716-446655440001'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(
      assignStaff({ campaignId, staffIds: [staffId1] }),
    ).rejects.toThrow('Error al asignar personal')
  })

  it('no inserta cuando todos los staffIds ya están asignados', async () => {
    mockDb.select = vi.fn(() => makeChain([{ staffId: staffId1 }]))
    mockDb.insert = vi.fn()

    await assignStaff({ campaignId, staffIds: [staffId1] })

    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})

describe('removeAssignment — ramas de error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.update = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(removeAssignment('assign-1')).rejects.toThrow(
      'Error al remover la asignacion',
    )
  })
})

describe('setCoordinator — ramas de error', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000'
  const staffId = '550e8400-e29b-41d4-a716-446655440001'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lanza error de validación con datos inválidos', async () => {
    await expect(
      setCoordinator({ campaignId: 'no-es-uuid', staffId: 'tampoco-uuid' }),
    ).rejects.toThrow()
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(setCoordinator({ campaignId, staffId })).rejects.toThrow(
      'Error al designar coordinador',
    )
  })
})

describe('getAssignedStaff — ramas de error', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(getAssignedStaff(campaignId)).rejects.toThrow(
      'Error al obtener el personal asignado',
    )
  })
})

describe('getAvailableStaff — ramas de error', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(getAvailableStaff(campaignId)).rejects.toThrow(
      'Error al obtener el personal disponible',
    )
  })
})
