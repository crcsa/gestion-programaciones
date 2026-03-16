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
      },
    },
  })),
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: { id: 'id', cedula: 'cedula', staffProfile: 'staff_profile', isActive: 'is_active' },
  staffTrainingAreas: { staffId: 'staff_id', trainingAreaId: 'training_area_id' },
}))

vi.mock('@/lib/db/schema/profiles', () => ({
  profiles: { id: 'id', email: 'email', fullName: 'full_name', role: 'role' },
}))

import { db } from '@/lib/db'
import {
  createStaff,
  updateTrainingAreas,
  getStaffList,
  toggleStaffStatus,
} from '@/features/staff/actions/staff-actions'

// Helper to create a chainable drizzle mock
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'insert', 'values', 'update', 'set', 'delete', 'returning']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

const mockDb = vi.mocked(db)

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
    mockDb.select = vi.fn(() => selectChain) as typeof mockDb.select

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
    mockDb.select = vi.fn(() => makeChain([])) as typeof mockDb.select

    // insert: first call = profiles (no returning, void), second call = staffMembers (.returning())
    let insertCallCount = 0
    mockDb.insert = vi.fn(() => {
      insertCallCount++
      // Both calls return a chain; only staffMembers insert uses .returning()
      // The chain's 'then' resolves to [createdStaff] for both, which works for destructuring
      return makeChain([createdStaff])
    }) as typeof mockDb.insert

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

    mockDb.delete = vi.fn(() => deleteChain) as typeof mockDb.delete
    mockDb.insert = vi.fn(() => insertChain) as typeof mockDb.insert

    await updateTrainingAreas(staffId, newAreaIds)

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('solo elimina cuando no hay nuevas areas', async () => {
    const staffId = 'staff-abc'
    const deleteChain = makeChain([])

    mockDb.delete = vi.fn(() => deleteChain) as typeof mockDb.delete
    mockDb.insert = vi.fn(() => makeChain([])) as typeof mockDb.insert

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

    const selectChain = makeChain(bacteriologos)
    mockDb.select = vi.fn(() => selectChain) as typeof mockDb.select

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

    const selectChain = makeChain(staffList)
    mockDb.select = vi.fn(() => selectChain) as typeof mockDb.select

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
    }) as typeof mockDb.select

    const updateChain = makeChain(updatedStaff)
    mockDb.update = vi.fn(() => updateChain) as typeof mockDb.update

    const result = await toggleStaffStatus(staffId)

    expect(mockDb.update).toHaveBeenCalledTimes(1)
    expect(result.isActive).toBe(false)
  })

  it('lanza error si el staff no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([])) as typeof mockDb.select

    await expect(toggleStaffStatus('no-existe')).rejects.toThrow(
      'Funcionario no encontrado'
    )
  })
})
