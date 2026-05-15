import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionError } from '@/lib/errors/app-errors'

// Mock modules before imports
vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    // bulkUpsertDaySedeShifts envuelve borrado+upserts en una transacción.
    // En tests, ejecutamos el callback con el mismo `db` mockeado para que
    // los `mockReturnValueOnce` configurados por cada test sigan aplicando.
    transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(db)),
  }
  return { db }
})

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/hours/lib/aggregate-staff-data', () => ({
  recalcStaffAggregates: vi.fn().mockResolvedValue(undefined),
  recalcAggregatesForCampaign: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
  recalcAggregatesForDate: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
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
import { requireAccess } from '@/features/auth/lib/require-access'
import {
  getWeeklySedeShifts,
  createSedeShift,
  updateSedeShift,
  deleteSedeShift,
  getActiveStaffList,
  bulkUpsertDaySedeShifts,
} from '@/features/sede/actions/sede-shift-actions'

// Helper to create a chainable drizzle mock
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning',
    'leftJoin', 'onConflictDoUpdate', 'groupBy',
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

  it('retorna la lista de colaboradores activos', async () => {
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
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError('No tienes permiso para realizar esta accion.'))

    await expect(getActiveStaffList()).rejects.toThrow('permiso')
  })

  it('envuelve errores de DB genéricos', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(getActiveStaffList()).rejects.toThrow('Error al obtener la lista de colaboradores')
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
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError('No tienes permiso para realizar esta accion.'))

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
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError('No tienes permiso para realizar esta accion.'))

    await expect(createSedeShift(validInput)).rejects.toThrow('permiso')
  })

  it('acepta horas extras cuando hay pernocta', async () => {
    const insertChain = makeChain([])
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await createSedeShift({
      ...validInput,
      shiftType: 'noche',
      startTime: '19:00',
      endTime: '07:00',
      isOvernight: true,
      extraHours: 2,
    })

    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ extraHours: 2, isOvernight: true }),
    )
  })

  it('rechaza horas extras en turno sin pernocta', async () => {
    await expect(
      createSedeShift({ ...validInput, isOvernight: false, extraHours: 3 }),
    ).rejects.toThrow('Datos de turno inválidos')
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

  // El update ahora lee la fila existente antes de validar/recalcular para
  // soportar patches parciales (e.g. solo `extraHours`). Mockeamos ese SELECT
  // con un row que coincida con el `validUpdate` ya proporcionado.
  const existingRow = {
    staffId: '550e8400-e29b-41d4-a716-446655440001',
    startTime: '19:00',
    endTime: '07:00',
    isOvernight: true,
    shiftType: 'noche',
  }

  it('actualiza un turno correctamente', async () => {
    mockDb.select = vi.fn(() => makeChain([existingRow]))
    const updateChain = makeChain([{ id: shiftId }])
    mockDb.update = vi.fn(() => updateChain)

    await updateSedeShift(shiftId, validUpdate)

    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('lanza error cuando el turno no existe', async () => {
    // SELECT inicial no devuelve fila → NotFoundError ANTES del UPDATE.
    mockDb.select = vi.fn(() => makeChain([]))
    const updateChain = makeChain([])
    mockDb.update = vi.fn(() => updateChain)

    await expect(updateSedeShift(shiftId, validUpdate)).rejects.toThrow('Turno no encontrado')
  })

  it('envuelve errores de DB genéricos', async () => {
    mockDb.select = vi.fn(() => makeChain([existingRow]))
    mockDb.update = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(updateSedeShift(shiftId, validUpdate)).rejects.toThrow(
      'Error al actualizar el turno',
    )
  })

  it('propaga errores de permiso', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError('No tienes permiso para realizar esta accion.'))

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
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError('No tienes permiso para realizar esta accion.'))

    await expect(deleteSedeShift(shiftId)).rejects.toThrow('permiso')
  })
})


describe("bulkUpsertDaySedeShifts", () => {
  const date = "2026-05-13"
  const staffA = "11111111-1111-4111-8111-111111111111"
  const staffB = "22222222-2222-4222-8222-222222222222"
  const staffC = "33333333-3333-4333-8333-333333333333"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("upsert 3 staff nuevos con defaults aplicados", async () => {
    mockDb.select = vi.fn(() => makeChain([])) // no existing
    const insertChain = makeChain([])
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)
    mockDb.delete = vi.fn(() => makeChain([]))

    const result = await bulkUpsertDaySedeShifts({
      shiftDate: date,
      assignments: [
        { staffId: staffA, shiftType: "diurno_completo" },
        { staffId: staffB, shiftType: "noche" },
        { staffId: staffC, shiftType: "posturno" },
      ],
    })

    expect(result.upserted).toBe(3)
    expect(result.removed).toBe(0)
    expect(mockDb.insert).toHaveBeenCalledTimes(3)
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: staffA, shiftType: "diurno_completo", startTime: "07:00", endTime: "17:00", isOvernight: false }),
    )
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: staffB, shiftType: "noche", startTime: "18:00", endTime: "06:00", isOvernight: true }),
    )
  })

  it("remueve staff que ya no está en el nuevo roster y mantiene los compartidos", async () => {
    mockDb.select = vi.fn(() => makeChain([
      { id: "shift-a", staffId: staffA },
      { id: "shift-b", staffId: staffB },
      { id: "shift-c", staffId: staffC },
    ]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    const result = await bulkUpsertDaySedeShifts({
      shiftDate: date,
      assignments: [
        { staffId: staffB, shiftType: "diurno_completo" },
        { staffId: staffC, shiftType: "diurno_completo" },
      ],
    })

    expect(result.upserted).toBe(2)
    expect(result.removed).toBe(1)
    expect(mockDb.delete).toHaveBeenCalledTimes(1)
  })

  it("respeta override de start/end y isOvernight cuando se proveen", async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    const insertChain = makeChain([])
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)
    mockDb.delete = vi.fn(() => makeChain([]))

    await bulkUpsertDaySedeShifts({
      shiftDate: date,
      assignments: [
        {
          staffId: staffA,
          shiftType: "diurno_completo",
          startTime: "08:30",
          endTime: "18:30",
          isOvernight: false,
        },
      ],
    })

    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: "08:30", endTime: "18:30" }),
    )
  })

  it("rechaza staff duplicados en el payload", async () => {
    await expect(
      bulkUpsertDaySedeShifts({
        shiftDate: date,
        assignments: [
          { staffId: staffA, shiftType: "diurno_completo" },
          { staffId: staffA, shiftType: "noche" },
        ],
      }),
    ).rejects.toThrow(/duplicados/)
  })

  it("rechaza fecha inválida", async () => {
    await expect(
      bulkUpsertDaySedeShifts({
        shiftDate: "no-date",
        assignments: [],
      }),
    ).rejects.toThrow(/inválidos/)
  })

  it("rechaza por permisos", async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new Error("No tienes permiso para realizar esta accion."))

    await expect(
      bulkUpsertDaySedeShifts({ shiftDate: date, assignments: [] }),
    ).rejects.toThrow("permiso")
  })
})

describe("createSedeShift idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("usa onConflictDoUpdate al insertar", async () => {
    const insertChain = makeChain([])
    const conflictSpy = insertChain.onConflictDoUpdate as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await createSedeShift({
      staffId: "11111111-1111-4111-8111-111111111111",
      shiftDate: "2026-05-13",
      shiftType: "diurno_completo",
      startTime: "07:00",
      endTime: "17:00",
      isOvernight: false,
    })

    expect(conflictSpy).toHaveBeenCalledTimes(1)
  })
})

