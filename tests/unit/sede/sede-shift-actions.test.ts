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

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    id: 'id',
    staffId: 'staff_id',
    shiftDate: 'shift_date',
    shiftType: 'shift_type',
    startTime: 'start_time',
    endTime: 'end_time',
    totalHours: 'total_hours',
    isOvernight: 'is_overnight',
    notes: 'notes',
    createdById: 'created_by_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
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
import { requireRole } from '@/features/auth/lib/require-role'
import {
  getWeeklySedeShifts,
  createSedeShift,
  updateSedeShift,
  deleteSedeShift,
  getActiveStaffList,
} from '@/features/sede/actions/sede-shift-actions'

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

// ---- Tests ----------------------------------------------------------------

describe('getActiveStaffList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna la lista de funcionarios activos', async () => {
    const staffRows = [
      { id: 's-1', firstName: 'Ana', lastName: 'Garcia', staffProfile: 'bacteriologo' },
      { id: 's-2', firstName: 'Luis', lastName: 'Lopez', staffProfile: 'tecnico' },
    ]
    mockDb.select = vi.fn(() => makeChain(staffRows))

    const result = await getActiveStaffList()

    expect(result).toHaveLength(2)
    expect(result[0].lastName).toBe('Garcia')
  })

  it('propaga errores de permiso', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error('No tienes permiso para realizar esta accion.'))

    await expect(getActiveStaffList()).rejects.toThrow('permiso')
  })

  it('envuelve errores de DB genéricos', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(getActiveStaffList()).rejects.toThrow('Error al obtener la lista de funcionarios')
  })
})

describe('getWeeklySedeShifts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna turnos de la semana con datos de staff', async () => {
    const shiftRows = [
      {
        id: 'shift-1',
        staffId: 's-1',
        firstName: 'Ana',
        lastName: 'Garcia',
        staffProfile: 'bacteriologo',
        shiftDate: '2026-03-16',
        shiftType: 'diurno_completo',
        startTime: '07:00',
        endTime: '19:00',
        totalHours: 12,
        isOvernight: false,
        notes: null,
      },
    ]
    mockDb.select = vi.fn(() => makeChain(shiftRows))

    const result = await getWeeklySedeShifts('2026-03-16')

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('Ana')
    expect(result[0].shiftType).toBe('diurno_completo')
  })

  it('retorna arreglo vacío cuando no hay turnos', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getWeeklySedeShifts('2026-03-16')

    expect(result).toHaveLength(0)
  })

  it('envuelve errores de DB genéricos', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(getWeeklySedeShifts('2026-03-16')).rejects.toThrow(
      'Error al obtener los turnos de la semana',
    )
  })

  it('propaga errores de permiso', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error('No tienes permiso para realizar esta accion.'))

    await expect(getWeeklySedeShifts('2026-03-16')).rejects.toThrow('permiso')
  })
})

describe('createSedeShift', () => {
  const validInput = {
    staffId: '550e8400-e29b-41d4-a716-446655440001',
    shiftDate: '2026-03-16',
    shiftType: 'diurno_completo' as const,
    startTime: '07:00',
    endTime: '19:00',
    isOvernight: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea un turno correctamente', async () => {
    const insertChain = makeChain([])
    mockDb.insert = vi.fn(() => insertChain)

    await createSedeShift(validInput)

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('lanza error de validación con datos inválidos', async () => {
    await expect(
      createSedeShift({ ...validInput, staffId: 'no-es-uuid' }),
    ).rejects.toThrow('Datos de turno inválidos')
  })

  it('envuelve errores de DB genéricos', async () => {
    mockDb.insert = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(createSedeShift(validInput)).rejects.toThrow('Error al crear el turno')
  })

  it('propaga errores de permiso', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error('No tienes permiso para realizar esta accion.'))

    await expect(createSedeShift(validInput)).rejects.toThrow('permiso')
  })
})

describe('updateSedeShift', () => {
  const shiftId = '550e8400-e29b-41d4-a716-446655440099'
  const validUpdate = {
    shiftType: 'noche' as const,
    startTime: '19:00',
    endTime: '07:00',
    isOvernight: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('actualiza un turno correctamente', async () => {
    const updateChain = makeChain([{ id: shiftId }])
    mockDb.update = vi.fn(() => updateChain)

    await updateSedeShift(shiftId, validUpdate)

    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('lanza error cuando el turno no existe', async () => {
    const updateChain = makeChain([])
    mockDb.update = vi.fn(() => updateChain)

    await expect(updateSedeShift(shiftId, validUpdate)).rejects.toThrow('Turno no encontrado')
  })

  it('envuelve errores de DB genéricos', async () => {
    mockDb.update = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(updateSedeShift(shiftId, validUpdate)).rejects.toThrow(
      'Error al actualizar el turno',
    )
  })

  it('propaga errores de permiso', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error('No tienes permiso para realizar esta accion.'))

    await expect(updateSedeShift(shiftId, validUpdate)).rejects.toThrow('permiso')
  })
})

describe('deleteSedeShift', () => {
  const shiftId = '550e8400-e29b-41d4-a716-446655440099'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('elimina un turno correctamente', async () => {
    const deleteChain = makeChain([{ id: shiftId }])
    mockDb.delete = vi.fn(() => deleteChain)

    await deleteSedeShift(shiftId)

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
  })

  it('lanza error cuando el turno no existe', async () => {
    const deleteChain = makeChain([])
    mockDb.delete = vi.fn(() => deleteChain)

    await expect(deleteSedeShift(shiftId)).rejects.toThrow('Turno no encontrado')
  })

  it('envuelve errores de DB genéricos', async () => {
    mockDb.delete = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(deleteSedeShift(shiftId)).rejects.toThrow('Error al eliminar el turno')
  })

  it('propaga errores de permiso', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error('No tienes permiso para realizar esta accion.'))

    await expect(deleteSedeShift(shiftId)).rejects.toThrow('permiso')
  })
})
