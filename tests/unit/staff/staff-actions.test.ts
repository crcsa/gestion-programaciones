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

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-user-456' } },
          error: null,
        }),
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  })),
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: { id: 'id', cedula: 'cedula', staffProfile: 'staff_profile', isActive: 'is_active', profileId: 'profile_id' },
  staffTrainingAreas: { staffId: 'staff_id', trainingAreaId: 'training_area_id' },
}))

vi.mock('@/lib/db/schema/profiles', () => ({
  profiles: { id: 'id', email: 'email', fullName: 'full_name', role: 'role' },
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import { requireRole } from '@/features/auth/lib/require-role'
import {
  createStaff,
  updateTrainingAreas,
  getStaffList,
  toggleStaffStatus,
  getStaffById,
  updateStaff,
  deleteStaff,
} from '@/features/staff/actions/staff-actions'

// Helper to create a chainable drizzle mock
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'leftJoin', 'insert', 'values', 'onConflictDoUpdate', 'update', 'set', 'delete', 'returning']
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

describe('createStaff', () => {
  const validInput = {
    firstName: 'Ana',
    lastName: 'Garcia',
    cedula: '1234567890',
    email: 'ana.garcia@example.com',
    staffProfile: 'bacteriologo' as const,
    contractType: 'indefinido' as const,
    weeklyHours: 40,
    defaultShift: 'diurno_completo' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza cedula duplicada', async () => {
    const existingStaff = [{ id: 'existing-id', cedula: '1234567890' }]

    // Mock: select existing cedula → found
    const selectChain = makeChain(existingStaff)
    mockDb.select = vi.fn(() => selectChain)
    await expect(createStaff(validInput)).rejects.toThrow(
      'Ya existe un funcionario con esa cedula'
    )
  })

  it('crea staff exitosamente cuando cedula no existe', async () => {
    const createdStaff = {
      id: 'new-id',
      firstName: 'Ana',
      lastName: 'Garcia',
      cedula: '1234567890',
      email: 'ana.garcia@example.com',
      staffProfile: 'bacteriologo' as const,
      contractType: 'indefinido' as const,
      weeklyHours: 40,
      defaultShift: 'diurno_completo' as const,
      profileId: 'auth-user-456',
      isActive: true,
      hireDate: null,
      notes: null,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // select (cedula check) → empty
    mockDb.select = vi.fn(() => makeChain([]))
    // insert: first call = profiles (no returning, void), second call = staffMembers (.returning())
    let insertCallCount = 0
    mockDb.insert = vi.fn(() => {
      insertCallCount++
      // Both calls return a chain; only staffMembers insert uses .returning()
      // The chain's 'then' resolves to [createdStaff] for both, which works for destructuring
      return makeChain([createdStaff])
    })
    const result = await createStaff(validInput)
    expect(result.cedula).toBe('1234567890')
    expect(result.id).toBe('new-id')
    expect(insertCallCount).toBe(2)
  })
})

describe('updateTrainingAreas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('elimina areas existentes e inserta las nuevas', async () => {
    const staffId = 'staff-abc'
    const newAreaIds = ['area-1', 'area-2']

    const deleteChain = makeChain([])
    const insertChain = makeChain([
      { staffId, trainingAreaId: 'area-1' },
      { staffId, trainingAreaId: 'area-2' },
    ])

    mockDb.delete = vi.fn(() => deleteChain)
    mockDb.insert = vi.fn(() => insertChain)
    await updateTrainingAreas(staffId, newAreaIds)

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('solo elimina cuando no hay nuevas areas', async () => {
    const staffId = 'staff-abc'
    const deleteChain = makeChain([])

    mockDb.delete = vi.fn(() => deleteChain)
    mockDb.insert = vi.fn(() => makeChain([]))
    await updateTrainingAreas(staffId, [])

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})

describe('getStaffList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filtra por perfil correctamente', async () => {
    const bacteriologos = [
      {
        id: 'staff-1',
        firstName: 'Luis',
        lastName: 'Martinez',
        cedula: '987654321',
        staffProfile: 'bacteriologo',
        isActive: true,
        email: 'luis@example.com',
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

    // getStaffList does: Promise.all([rows, countRows]) + leftJoin area rows
    // We return: rows chain, count chain (with count prop), area rows chain
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 2) return makeChain([{ count: 1 }])
      if (selectCall === 3) return makeChain([])
      return makeChain(bacteriologos)
    })
    const result = await getStaffList({ perfil: 'bacteriologo', page: 1, limit: 20 })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].staffProfile).toBe('bacteriologo')
  })

  it('retorna lista paginada con total', async () => {
    const staffList = Array.from({ length: 5 }, (_, i) => ({
      id: `staff-${i}`,
      firstName: `Nombre${i}`,
      lastName: `Apellido${i}`,
      cedula: `100000000${i}`,
      staffProfile: 'tecnico',
      isActive: true,
      email: `staff${i}@example.com`,
      phone: null,
      contractType: 'indefinido',
      weeklyHours: 40,
      defaultShift: 'diurno_completo',
      profileId: null,
      hireDate: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    let selectCall2 = 0
    mockDb.select = vi.fn(() => {
      selectCall2++
      if (selectCall2 === 2) return makeChain([{ count: staffList.length }])
      if (selectCall2 === 3) return makeChain([])
      return makeChain(staffList)
    })
    const result = await getStaffList({ page: 1, limit: 20 })

    expect(Array.isArray(result.data)).toBe(true)
    expect(typeof result.total).toBe('number')
  })
})

describe('toggleStaffStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invierte el estado activo del staff', async () => {
    const staffId = 'staff-toggle'
    const existingStaff = [{ id: staffId, isActive: true }]
    const updatedStaff = [{ id: staffId, isActive: false }]

    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      return makeChain(existingStaff)
    })
    const updateChain = makeChain(updatedStaff)
    mockDb.update = vi.fn(() => updateChain)
    const result = await toggleStaffStatus(staffId)

    expect(mockDb.update).toHaveBeenCalledTimes(1)
    expect(result.isActive).toBe(false)
  })

  it('lanza error si el staff no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await expect(toggleStaffStatus('no-existe')).rejects.toThrow(
      'Funcionario no encontrado'
    )
  })
})

describe('getStaffById', () => {
  const mockRequireRole = requireRole as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('retorna el funcionario con sus areas de entrenamiento cuando existe', async () => {
    const staffId = 'staff-found'
    const staffRow = {
      id: staffId,
      firstName: 'Maria',
      lastName: 'Lopez',
      cedula: '9876543210',
      isActive: true,
    }
    const areaRows = [
      { trainingAreaId: 'area-10' },
      { trainingAreaId: 'area-20' },
    ]

    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      if (selectCallCount === 1) return makeChain([staffRow])
      return makeChain(areaRows)
    })

    const result = await getStaffById(staffId)

    expect(result.id).toBe(staffId)
    expect(result.trainingAreaIds).toEqual(['area-10', 'area-20'])
    expect(selectCallCount).toBe(2)
  })

  it('lanza error cuando el funcionario no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    await expect(getStaffById('id-inexistente')).rejects.toThrow(
      'Funcionario no encontrado'
    )
  })

  it('lanza error de permiso cuando requireRole rechaza', async () => {
    mockRequireRole.mockRejectedValue(new Error('Sin permiso para acceder'))

    await expect(getStaffById('any-id')).rejects.toThrow('Sin permiso para acceder')
  })
})

describe('updateStaff', () => {
  const mockRequireRole = requireRole as ReturnType<typeof vi.fn>

  const staffId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  const validUpdateData = {
    firstName: 'Carlos',
    lastName: 'Ruiz',
    cedula: '1112223334',
    contractType: 'indefinido' as const,
    weeklyHours: 36,
    defaultShift: 'diurno_completo' as const,
    staffProfile: 'bacteriologo' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('actualiza el funcionario exitosamente cuando los datos son validos', async () => {
    const updatedRow = { id: staffId, ...validUpdateData, isActive: true }

    // select for cedula duplicate check → empty (no conflict)
    mockDb.select = vi.fn(() => makeChain([]))
    // update → returns updated row
    mockDb.update = vi.fn(() => makeChain([updatedRow]))

    const result = await updateStaff(staffId, validUpdateData)

    expect(result.id).toBe(staffId)
    expect(result.firstName).toBe('Carlos')
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('lanza error cuando la cedula ya existe en otro funcionario', async () => {
    // select for cedula duplicate check → conflict found
    mockDb.select = vi.fn(() => makeChain([{ id: 'other-staff-id' }]))

    await expect(updateStaff(staffId, validUpdateData)).rejects.toThrow(
      'Ya existe otro funcionario con esa cedula'
    )
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('lanza error cuando el funcionario no existe (update no retorna filas)', async () => {
    // select for cedula duplicate check → empty
    mockDb.select = vi.fn(() => makeChain([]))
    // update returning → empty array (not found)
    mockDb.update = vi.fn(() => makeChain([]))

    await expect(updateStaff(staffId, validUpdateData)).rejects.toThrow(
      'Funcionario no encontrado'
    )
  })

  it('lanza error de permiso cuando requireRole rechaza', async () => {
    mockRequireRole.mockRejectedValue(new Error('Sin permiso para acceder'))

    await expect(updateStaff(staffId, validUpdateData)).rejects.toThrow('Sin permiso para acceder')
  })
})

describe('updateTrainingAreas - cobertura adicional', () => {
  const mockRequireRole = requireRole as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('retorno temprano cuando areaIds es vacio (sin llamada a insert)', async () => {
    const staffId = 'staff-empty-areas'

    mockDb.delete = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([]))

    await updateTrainingAreas(staffId, [])

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('inserta multiples areas de entrenamiento correctamente', async () => {
    const staffId = 'staff-multi-areas'
    const areaIds = ['area-a', 'area-b', 'area-c']

    mockDb.delete = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([
      { staffId, trainingAreaId: 'area-a' },
      { staffId, trainingAreaId: 'area-b' },
      { staffId, trainingAreaId: 'area-c' },
    ]))

    await updateTrainingAreas(staffId, areaIds)

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('lanza error de permiso cuando requireRole rechaza', async () => {
    mockRequireRole.mockRejectedValue(new Error('Sin permiso para acceder'))

    await expect(updateTrainingAreas('staff-id', ['area-1'])).rejects.toThrow('Sin permiso para acceder')
  })
})

// ---- Cobertura de ramas adicionales ----------------------------------------

describe('updateStaff — ramas de error', () => {
  const validId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    // updateStaff without cedula skips select, goes straight to update
    mockDb.update = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(
      updateStaff(validId, { firstName: 'Test', lastName: 'User' }),
    ).rejects.toThrow('Error al actualizar el funcionario')
  })
})

describe('toggleStaffStatus — ramas de error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(
      toggleStaffStatus('staff-1'),
    ).rejects.toThrow('Error al cambiar el estado del funcionario')
  })
})

describe('createStaff — validation and auth error paths', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws when input fails schema validation', async () => {
    await expect(
      createStaff({
        firstName: '',  // too short
        lastName: 'García',
        cedula: '1234567890',
        email: 'bad-email',  // invalid email
        staffProfile: 'bacteriologo' as const,
        contractType: 'indefinido' as const,
        weeklyHours: 40,
        defaultShift: 'diurno_completo' as const,
      }),
    ).rejects.toThrow()
  })

  it('throws when supabase auth fails', async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    vi.mocked(getSupabaseAdmin).mockReturnValueOnce({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Auth service down') }),
        },
      },
    } as unknown as ReturnType<typeof getSupabaseAdmin>)

    mockDb.select = vi.fn(() => makeChain([]))  // cedula check passes

    await expect(createStaff({
      firstName: 'Ana',
      lastName: 'García',
      cedula: '9990001111',
      email: 'ana@example.com',
      staffProfile: 'bacteriologo' as const,
      contractType: 'indefinido' as const,
      weeklyHours: 40,
      defaultShift: 'diurno_completo' as const,
    })).rejects.toThrow('autenticaci')
  })

  it('wraps generic DB error with friendly message', async () => {
    mockDb.select = vi.fn(() => makeChain([]))  // cedula check
    mockDb.insert = vi.fn().mockImplementation(() => { throw new Error('DB down') })

    await expect(createStaff({
      firstName: 'Ana',
      lastName: 'García',
      cedula: '8881112222',
      email: 'ana2@example.com',
      staffProfile: 'bacteriologo' as const,
      contractType: 'indefinido' as const,
      weeklyHours: 40,
      defaultShift: 'diurno_completo' as const,
    })).rejects.toThrow('base de datos')
  })
})

describe('updateStaff — schema validation failure', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws when id is not valid UUID', async () => {
    await expect(
      updateStaff('not-a-uuid', { firstName: 'Test' }),
    ).rejects.toThrow()
  })
})

describe('updateTrainingAreas — ramas de error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.delete = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(
      updateTrainingAreas('staff-1', ['area-1']),
    ).rejects.toThrow('Error al actualizar las areas de entrenamiento')
  })
})

// ---- updateStaff con trainingAreaIds ----------------------------------------

describe('updateStaff — con trainingAreaIds', () => {
  const staffId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  const areaUuid1 = '00000000-0000-4000-8000-000000000a01'
  const areaUuid2 = '00000000-0000-4000-8000-000000000a02'

  it('elimina y reinserta areas cuando trainingAreaIds es provisto', async () => {
    const updated = { id: staffId, firstName: 'Test', lastName: 'User', isActive: true }
    mockDb.select = vi.fn(() => makeChain([]))   // cedula check
    mockDb.update = vi.fn(() => makeChain([updated]))
    mockDb.delete = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([]))

    const result = await updateStaff(staffId, {
      firstName: 'Test',
      lastName: 'User',
      trainingAreaIds: [areaUuid1, areaUuid2],
    })

    expect(result.id).toBe(staffId)
    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('solo elimina areas cuando trainingAreaIds es array vacío', async () => {
    const updated = { id: staffId, firstName: 'Test', lastName: 'User', isActive: true }
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.update = vi.fn(() => makeChain([updated]))
    mockDb.delete = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([]))

    await updateStaff(staffId, { firstName: 'Test', lastName: 'User', trainingAreaIds: [] })

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('no toca areas cuando trainingAreaIds es undefined', async () => {
    const updated = { id: staffId, firstName: 'Test', lastName: 'User', isActive: true }
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.update = vi.fn(() => makeChain([updated]))
    mockDb.delete = vi.fn(() => makeChain([]))

    await updateStaff(staffId, { firstName: 'Test', lastName: 'User' })

    expect(mockDb.delete).not.toHaveBeenCalled()
  })
})

describe('createStaff — generic outer error (línea 273)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('wraps unknown error with Error al crear el funcionario', async () => {
    // Throwing in cedula-check with a message that matches none of the re-throw keywords
    mockDb.select = vi.fn(() => { throw new Error('connection refused') })

    await expect(createStaff({
      firstName: 'Ana',
      lastName: 'García',
      cedula: '1112223334',
      email: 'ana3@example.com',
      staffProfile: 'bacteriologo' as const,
      contractType: 'indefinido' as const,
      weeklyHours: 40,
      defaultShift: 'diurno_completo' as const,
    })).rejects.toThrow('Error al crear el funcionario')
  })
})

// ---- deleteStaff ------------------------------------------------------------

describe('deleteStaff', () => {
  const staffId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('elimina funcionario con profileId (llama supabase deleteUser)', async () => {
    const staffRow = { id: staffId, profileId: 'auth-user-abc' }
    mockDb.select = vi.fn(() => makeChain([staffRow]))
    mockDb.delete = vi.fn(() => makeChain([]))

    await expect(deleteStaff(staffId)).resolves.toBeUndefined()
    expect(mockDb.delete).toHaveBeenCalledTimes(2) // training areas + staff
  })

  it('elimina funcionario sin profileId (no llama supabase)', async () => {
    const staffRow = { id: staffId, profileId: null }
    mockDb.select = vi.fn(() => makeChain([staffRow]))
    mockDb.delete = vi.fn(() => makeChain([]))

    await expect(deleteStaff(staffId)).resolves.toBeUndefined()
    expect(mockDb.delete).toHaveBeenCalledTimes(2)
  })

  it('lanza error cuando el funcionario no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    await expect(deleteStaff(staffId)).rejects.toThrow('Funcionario no encontrado')
  })

  it('envuelve errores de DB genéricos con mensaje descriptivo', async () => {
    mockDb.select = vi.fn(() => { throw new Error('DB down') })

    await expect(deleteStaff(staffId)).rejects.toThrow('Error al eliminar el funcionario')
  })

  it('lanza error de permiso cuando requireRole rechaza', async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error('Sin permiso'))

    await expect(deleteStaff(staffId)).rejects.toThrow('Sin permiso')
  })
})

// ---- Branch coverage gaps ---------------------------------------------------

describe('getStaffList — empty result skips DB area query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-1', role: 'admin' })
  })

  it('returns empty data when no staff members found (covers ternary [] branch)', async () => {
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 2) return makeChain([{ count: 0 }])
      return makeChain([])  // rows = [] → staffIds = [] → areaRows = []
    })

    const result = await getStaffList({})
    expect(result.data).toHaveLength(0)
    expect(result.total).toBe(0)
    // Should NOT call select a third time (no area query needed when empty)
    expect(selectCall).toBe(2)
  })
})

describe('createStaff — email already taken branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-1', role: 'admin' })
  })

  it('throws Ya existe una cuenta when auth returns already been registered error', async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    vi.mocked(getSupabaseAdmin).mockReturnValueOnce({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'User already been registered' },
          }),
        },
      },
    } as unknown as ReturnType<typeof getSupabaseAdmin>)

    mockDb.select = vi.fn(() => makeChain([]))  // cedula check passes

    await expect(createStaff({
      firstName: 'María',
      lastName: 'Pérez',
      cedula: '5556667778',
      email: 'maria@example.com',
      staffProfile: 'bacteriologo' as const,
      contractType: 'indefinido' as const,
      weeklyHours: 40,
      defaultShift: 'diurno_completo' as const,
    })).rejects.toThrow('Ya existe una cuenta de acceso con ese correo')
  })
})

describe('createStaff — with trainingAreaIds inserts area rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-1', role: 'admin' })
  })

  it('inserts training area rows when trainingAreaIds provided', async () => {
    const createdStaff = {
      id: 'new-id-2', firstName: 'Pedro', lastName: 'Ruiz', cedula: '7778889990',
      email: 'pedro@example.com', staffProfile: 'tecnico' as const,
      contractType: 'indefinido' as const, weeklyHours: 40,
      defaultShift: 'diurno_completo' as const, profileId: 'auth-id-2',
      isActive: true, hireDate: null, notes: null, phone: null,
      createdAt: new Date(), updatedAt: new Date(),
    }

    mockDb.select = vi.fn(() => makeChain([]))
    let insertCount = 0
    mockDb.insert = vi.fn(() => { insertCount++; return makeChain([createdStaff]) })

    const areaId = '00000000-0000-4000-8000-000000000011'
    await createStaff({
      firstName: 'Pedro', lastName: 'Ruiz', cedula: '7778889990',
      email: 'pedro@example.com', staffProfile: 'tecnico',
      contractType: 'indefinido', weeklyHours: 40, defaultShift: 'diurno_completo',
      trainingAreaIds: [areaId],
    })

    // 3 inserts: profiles + staffMembers + staffTrainingAreas
    expect(insertCount).toBe(3)
  })
})
