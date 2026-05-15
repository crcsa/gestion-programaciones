import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionError } from '@/lib/errors/app-errors'

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

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    id: 'id',
    staffId: 'staff_id',
    shiftDate: 'shift_date',
    shiftType: 'shift_type',
    totalHours: 'total_hours',
    isOvernight: 'is_overnight',
    startTime: 'start_time',
    endTime: 'end_time',
    updatedAt: 'updated_at',
    notes: 'notes',
    createdById: 'created_by_id',
  },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    firstName: 'first_name',
    lastName: 'last_name',
    isActive: 'is_active',
    staffProfile: 'staff_profile',
  },
}))

import { db } from '@/lib/db'
import { requireRole } from '@/features/auth/lib/require-role'
import { requireAccess } from '@/features/auth/lib/require-access'
import {
  upsertShift,
  deleteShift,
  getStaffOccupancy,
  getWeeklyShifts,
} from '@/features/sede-shifts/actions/shift-actions'

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

describe('upsertShift', () => {
  const validInput = {
    staffId: '550e8400-e29b-41d4-a716-446655440000',
    shiftDate: '2026-03-17',
    shiftType: 'diurno_completo' as const,
    startTime: '07:00',
    endTime: '19:00',
    totalHours: 12,
    isOvernight: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza turno de mas de 12 horas', async () => {
    const invalidInput = { ...validInput, totalHours: 13 }

    await expect(upsertShift(invalidInput)).rejects.toThrow('Maximo 12 horas')
  })

  it('crea turno cuando no existe previo', async () => {
    const createdShift = {
      id: 'shift-new',
      staffId: validInput.staffId,
      shiftDate: '2026-03-17',
      shiftType: 'diurno_completo',
      startTime: '07:00',
      endTime: '19:00',
      totalHours: 12,
      isOvernight: false,
      notes: null,
      createdById: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // select (existing check) returns empty
    mockDb.select = vi.fn(() => makeChain([]))
    // insert returns created shift
    mockDb.insert = vi.fn(() => makeChain([createdShift]))

    const result = await upsertShift(validInput)

    expect(result.shiftType).toBe('diurno_completo')
    expect(result.id).toBe('shift-new')
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('actualiza turno existente', async () => {
    const existingShift = { id: 'shift-existing' }
    const updatedShift = {
      id: 'shift-existing',
      staffId: validInput.staffId,
      shiftDate: '2026-03-17',
      shiftType: 'diurno_completo',
      startTime: '07:00',
      endTime: '19:00',
      totalHours: 12,
      isOvernight: false,
      notes: null,
      createdById: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // select (existing check) returns existing shift
    mockDb.select = vi.fn(() => makeChain([existingShift]))
    // update returns updated shift
    mockDb.update = vi.fn(() => makeChain([updatedShift]))

    const result = await upsertShift(validInput)

    expect(mockDb.update).toHaveBeenCalledTimes(1)
    expect(result.id).toBe('shift-existing')
  })
})

describe('deleteShift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('elimina turno por id', async () => {
    const deleteChain = makeChain([])
    mockDb.delete = vi.fn(() => deleteChain)

    await deleteShift('shift-to-delete')

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
  })

  it('elimina turno exitosamente sin lanzar errores', async () => {
    mockDb.delete = vi.fn(() => makeChain([]))

    await expect(deleteShift('shift-abc')).resolves.toBeUndefined()
  })

  it('propaga error de permiso sin envolver', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
    )

    await expect(deleteShift('shift-abc')).rejects.toThrow('permiso')
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.delete = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(deleteShift('shift-abc')).rejects.toThrow('Error al eliminar el turno')
  })
})

describe('getStaffOccupancy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna staff con status sede cuando tiene turno', async () => {
    const staffList = [
      {
        id: 'staff-1',
        firstName: 'Ana',
        lastName: 'Garcia',
        staffProfile: 'bacteriologo',
        isActive: true,
        cedula: '123',
        email: 'ana@test.com',
        phone: null,
        contractType: 'indefinido',
        weeklyHours: 40,
        defaultShift: 'diurno_completo',
        profileId: null,
        hireDate: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    const shiftRows = [{ staffId: 'staff-1' }]

    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      if (selectCallCount === 1) return makeChain(staffList)
      return makeChain(shiftRows)
    })

    const result = await getStaffOccupancy('2026-03-17')

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('sede')
    expect(result[0].firstName).toBe('Ana')
  })

  it('retorna staff con status libre cuando no tiene turno', async () => {
    const staffList = [
      {
        id: 'staff-2',
        firstName: 'Luis',
        lastName: 'Perez',
        staffProfile: 'tecnico',
        isActive: true,
        cedula: '456',
        email: 'luis@test.com',
        phone: null,
        contractType: 'indefinido',
        weeklyHours: 40,
        defaultShift: 'diurno_completo',
        profileId: null,
        hireDate: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    const shiftRows: { staffId: string }[] = []

    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      if (selectCallCount === 1) return makeChain(staffList)
      return makeChain(shiftRows)
    })

    const result = await getStaffOccupancy('2026-03-17')

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('libre')
    expect(result[0].firstName).toBe('Luis')
  })

  it('retorna arreglo vacío cuando no hay personal activo', async () => {
    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      if (selectCallCount === 1) return makeChain([])
      return makeChain([])
    })

    const result = await getStaffOccupancy('2026-03-17')

    expect(result).toHaveLength(0)
  })

  it('propaga error de permiso sin envolver', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
    )

    await expect(getStaffOccupancy('2026-03-17')).rejects.toThrow('permiso')
  })
})

// ---- Cobertura de ramas adicionales ----------------------------------------

describe('upsertShift — ramas de error', () => {
  const validInput = {
    staffId: '550e8400-e29b-41d4-a716-446655440000',
    shiftDate: '2026-03-17',
    shiftType: 'diurno_completo' as const,
    startTime: '07:00',
    endTime: '19:00',
    totalHours: 8,
    isOvernight: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envuelve errores de DB genéricos como "Error al guardar el turno"', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(upsertShift(validInput)).rejects.toThrow('Error al guardar el turno')
  })
})

describe('getStaffOccupancy — ramas de error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(getStaffOccupancy('2026-03-17')).rejects.toThrow(
      'Error al obtener la ocupacion del personal',
    )
  })
})

describe('getWeeklyShifts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('retorna staff activo y turnos agrupados por staffId', async () => {
    const staffList = [
      { id: 'staff-1', firstName: 'Ana', lastName: 'Garcia', isActive: true },
      { id: 'staff-2', firstName: 'Luis', lastName: 'Perez', isActive: true },
    ]
    const shifts = [
      { id: 'shift-1', staffId: 'staff-1', shiftDate: '2026-03-17', shiftType: 'diurno_completo', startTime: '07:00', endTime: '19:00', totalHours: 12, isOvernight: false },
      { id: 'shift-2', staffId: 'staff-1', shiftDate: '2026-03-18', shiftType: 'noche', startTime: '19:00', endTime: '07:00', totalHours: 10, isOvernight: true },
    ]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      return makeChain(callCount === 1 ? staffList : shifts)
    })

    const result = await getWeeklyShifts('2026-03-17')

    expect(result.staff).toHaveLength(2)
    expect(result.shifts['staff-1']).toHaveLength(2)
    expect(result.shifts['staff-2']).toBeUndefined()
  })

  it('retorna objeto vacío de shifts cuando no hay turnos', async () => {
    const staffList = [
      { id: 'staff-1', firstName: 'Ana', lastName: 'Garcia', isActive: true },
    ]

    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      return makeChain(callCount === 1 ? staffList : [])
    })

    const result = await getWeeklyShifts('2026-03-17')

    expect(result.staff).toHaveLength(1)
    expect(Object.keys(result.shifts)).toHaveLength(0)
  })

  it('lanza error cuando requireRole rechaza', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
    )

    await expect(getWeeklyShifts('2026-03-17')).rejects.toThrow('permiso')
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(getWeeklyShifts('2026-03-17')).rejects.toThrow(
      'Error al obtener los turnos semanales',
    )
  })
})
