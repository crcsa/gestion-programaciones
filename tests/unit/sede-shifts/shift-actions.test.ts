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
import {
  upsertShift,
  deleteShift,
  getStaffOccupancy,
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
})
