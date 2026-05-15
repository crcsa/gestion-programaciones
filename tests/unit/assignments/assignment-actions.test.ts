import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    email: 'admin@test.com',
    fullName: 'Admin Test',
    scope: { kind: 'global' as const },
  }),
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

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/features/hours/lib/aggregate-staff-data', () => ({
  recalcStaffAggregates: vi.fn().mockResolvedValue(undefined),
  recalcStaffAggregatesBatch: vi.fn().mockResolvedValue(undefined),
  recalcAggregatesForCampaign: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
  recalcAggregatesForDate: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
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
    'leftJoin', 'onConflictDoUpdate', 'onConflictDoNothing',
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
  transaction: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as SimpleMockDb

function setupTransaction() {
  const txUpdate = vi.fn(() => makeChain([]))
  const tx = { update: txUpdate }
  mockDb.transaction = vi.fn(async (cb: (t: typeof tx) => Promise<void>) => {
    await cb(tx)
  })
  return { tx, txUpdate }
}

describe('assignStaff', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000'
  const staffId1 = '550e8400-e29b-41d4-a716-446655440001'
  const staffId2 = '550e8400-e29b-41d4-a716-446655440002'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('asigna personal a la campaña correctamente', async () => {
    // El nuevo flujo hace:
    //   1) select de areas para defensa profunda (debe retornar banco_sangre)
    //   2) select de asignaciones activas (empty)
    //   3) select de campaign date (puede ser empty o con row)
    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return makeChain([
          { id: staffId1, area: 'banco_sangre' },
          { id: staffId2, area: 'banco_sangre' },
        ])
      }
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
    ).rejects.toThrow('Debe seleccionar al menos un colaborador')
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
      makeChain([
        {
          staffId: '550e8400-e29b-41d4-a716-446655440099',
          isCoordinator: true,
        },
      ]),
    )

    await expect(
      setCoordinator({ campaignId, staffId }),
    ).rejects.toThrow('El colaborador no está asignado a esta campaña')
  })

  it('designa coordinador y limpia el anterior dentro de una transacción', async () => {
    const previousCoordinatorId = '550e8400-e29b-41d4-a716-446655440099'
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 1) {
        // Asignaciones activas
        return makeChain([
          { staffId: previousCoordinatorId, isCoordinator: true },
          { staffId, isCoordinator: false },
        ])
      }
      // Lookup del target staff: bacteriólogo de banco_sangre → elegible.
      return makeChain([{ area: 'banco_sangre', staffProfile: 'bacteriologo' }])
    })
    const { txUpdate } = setupTransaction()

    await setCoordinator({ campaignId, staffId })

    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    // Two updates inside the transaction: clear old + set new
    expect(txUpdate).toHaveBeenCalledTimes(2)
  })

  it('omite trabajo si el staff ya es coordinador (idempotente)', async () => {
    mockDb.select = vi.fn(() =>
      makeChain([{ staffId, isCoordinator: true }]),
    )
    const { txUpdate } = setupTransaction()

    await setCoordinator({ campaignId, staffId })

    expect(mockDb.transaction).not.toHaveBeenCalled()
    expect(txUpdate).not.toHaveBeenCalled()
  })

  it('designa coordinador cuando no había uno previamente (1 update)', async () => {
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 1) {
        return makeChain([
          { staffId, isCoordinator: false },
          { staffId: 'otro-id', isCoordinator: false },
        ])
      }
      return makeChain([{ area: 'banco_sangre', staffProfile: 'tecnico' }])
    })
    const { txUpdate } = setupTransaction()

    await setCoordinator({ campaignId, staffId })

    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(txUpdate).toHaveBeenCalledTimes(1)
  })

  it('rechaza coordinador no bacteriólogo ni técnico (médico)', async () => {
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 1) {
        return makeChain([{ staffId, isCoordinator: false }])
      }
      return makeChain([{ area: 'banco_sangre', staffProfile: 'medico' }])
    })

    await expect(setCoordinator({ campaignId, staffId })).rejects.toThrow(
      /Solo bacteriólogos o técnicos/,
    )
  })

  it('rechaza coordinador de otra área (comercial)', async () => {
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 1) {
        return makeChain([{ staffId, isCoordinator: false }])
      }
      return makeChain([{ area: 'comercial', staffProfile: 'comercial' }])
    })

    await expect(setCoordinator({ campaignId, staffId })).rejects.toThrow(
      /Solo bacteriólogos o técnicos/,
    )
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
    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        // Defensa profunda: area lookup → banco_sangre.
        return makeChain([{ id: staffId1, area: 'banco_sangre' }])
      }
      // Asignaciones activas: ya incluye al staffId.
      return makeChain([{ staffId: staffId1 }])
    })
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
