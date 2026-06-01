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
  bulkUpsertRangeSedeShifts,
  duplicateWeekSedeShifts,
  getWeekShiftsForDuplicate,
  getWeeksWithShifts,
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
      modality: "sede",
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
      { id: "shift-a", staffId: staffA, shiftType: "diurno_completo" },
      { id: "shift-b", staffId: staffB, shiftType: "diurno_completo" },
      { id: "shift-c", staffId: staffC, shiftType: "diurno_completo" },
    ]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    const result = await bulkUpsertDaySedeShifts({
      shiftDate: date,
      modality: "sede",
      assignments: [
        { staffId: staffB, shiftType: "diurno_completo" },
        { staffId: staffC, shiftType: "diurno_completo" },
      ],
    })

    expect(result.upserted).toBe(2)
    expect(result.removed).toBe(1)
    expect(mockDb.delete).toHaveBeenCalledTimes(1)
  })

  it("solo remueve turnos de la modalidad programada (no toca la otra)", async () => {
    // staffA tiene servicios transfusionales ese día; programamos SEDE con
    // staffB. El de servicios (staffA) NO debe contarse para remoción.
    mockDb.select = vi.fn(() => makeChain([
      { id: "shift-a", staffId: staffA, shiftType: "servicios_transfusionales" },
      { id: "shift-b", staffId: staffB, shiftType: "diurno_completo" },
    ]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    const result = await bulkUpsertDaySedeShifts({
      shiftDate: date,
      modality: "sede",
      assignments: [{ staffId: staffB, shiftType: "diurno_completo" }],
    })

    // staffB ya estaba (se mantiene), staffA es de otra modalidad → no se remueve.
    expect(result.upserted).toBe(1)
    expect(result.removed).toBe(0)
    expect(mockDb.delete).not.toHaveBeenCalled()
  })

  it("bloquea si un colaborador ya tiene turno de la otra modalidad ese día", async () => {
    // staffA tiene servicios transfusionales; intentamos programarlo en SEDE.
    mockDb.select = vi.fn(() => makeChain([
      { id: "shift-a", staffId: staffA, shiftType: "servicios_transfusionales" },
    ]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    await expect(
      bulkUpsertDaySedeShifts({
        shiftDate: date,
        modality: "sede",
        assignments: [{ staffId: staffA, shiftType: "diurno_completo" }],
      }),
    ).rejects.toThrow(/otra modalidad|Servicios transfusionales|un turno por persona/i)
  })

  it("respeta override de start/end y isOvernight cuando se proveen", async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    const insertChain = makeChain([])
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)
    mockDb.delete = vi.fn(() => makeChain([]))

    await bulkUpsertDaySedeShifts({
      shiftDate: date,
      modality: "sede",
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
        modality: "sede",
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
        modality: "sede",
        assignments: [],
      }),
    ).rejects.toThrow(/inválidos/)
  })

  it("rechaza por permisos", async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new Error("No tienes permiso para realizar esta accion."))

    await expect(
      bulkUpsertDaySedeShifts({ shiftDate: date, modality: "sede", assignments: [] }),
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

// ---------------------------------------------------------------------------
// Feature B — bulkUpsertRangeSedeShifts
// ---------------------------------------------------------------------------

describe("bulkUpsertRangeSedeShifts", () => {
  // Semana ISO de referencia: lunes 2026-05-11 → domingo 2026-05-17.
  const dateFrom = "2026-05-11" // lunes
  const dateTo = "2026-05-15"   // viernes (5 días)
  const staffA = "11111111-1111-4111-8111-111111111111"
  const staffB = "22222222-2222-4222-8222-222222222222"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rango L–V con 2 staff sin conflictos → upsertea 5×2=10 turnos", async () => {
    // `getRangeConflicts` (pre-check del server) y `upsertDayShiftsCore`
    // (1 SELECT existing por día, todos vacíos) hacen todos su SELECT contra
    // el mismo `db.select`. Devolvemos un chain "siempre vacío" para todos.
    mockDb.select = vi.fn(() => makeChain([]))
    const insertChain = makeChain([])
    mockDb.insert = vi.fn(() => insertChain)
    mockDb.delete = vi.fn(() => makeChain([]))

    const result = await bulkUpsertRangeSedeShifts({
      dateFrom,
      dateTo,
      modality: "sede",
      assignments: [
        { staffId: staffA, shiftType: "diurno_completo" },
        { staffId: staffB, shiftType: "diurno_completo" },
      ],
    })

    expect(result.daysProcessed).toBe(5)
    expect(result.upserted).toBe(10) // 5 días × 2 staff
    expect(result.removed).toBe(0)
    expect(result.conflicts).toEqual([])
  })

  it("rango con conflicto cubierto por skipDates procesa los demás días", async () => {
    // Conflicto: el miércoles 2026-05-13 staffA ya tiene servicios. El usuario
    // pasa skipDates=['2026-05-13'], así que el pre-check (call #1) ve el row
    // pero como está en skipDates NO rechaza. Los SELECT por día dentro de la
    // tx (calls #2..#5 — L,M,J,V) deben devolver vacío para que cada día sea
    // upsert limpio.
    let call = 0
    mockDb.select = vi.fn(() => {
      call += 1
      if (call === 1) {
        // Pre-check del server: devuelve un único row con conflicto el miércoles.
        return makeChain([
          { shiftDate: "2026-05-13", staffId: staffA, shiftType: "servicios_transfusionales" },
        ])
      }
      // Todos los días posteriores: sin existing.
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    const result = await bulkUpsertRangeSedeShifts({
      dateFrom,
      dateTo,
      modality: "sede",
      assignments: [{ staffId: staffA, shiftType: "diurno_completo" }],
      skipDates: ["2026-05-13"],
    })

    // 4 días procesados (L,M,J,V). El miércoles fue saltado.
    expect(result.daysProcessed).toBe(4)
    expect(result.upserted).toBe(4)
  })

  it("rango con conflicto NO cubierto por skipDates lanza ValidationError", async () => {
    // Pre-check devuelve un conflicto en el miércoles; skipDates está vacío.
    mockDb.select = vi.fn(() => makeChain([
      { shiftDate: "2026-05-13", staffId: staffA, shiftType: "servicios_transfusionales" },
    ]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    await expect(
      bulkUpsertRangeSedeShifts({
        dateFrom,
        dateTo,
        modality: "sede",
        assignments: [{ staffId: staffA, shiftType: "diurno_completo" }],
      }),
    ).rejects.toThrow(/conflictos no resueltos/i)
  })

  it("rechaza dateFrom > dateTo (schema)", async () => {
    await expect(
      bulkUpsertRangeSedeShifts({
        dateFrom: "2026-05-15",
        dateTo: "2026-05-11",
        modality: "sede",
        assignments: [{ staffId: staffA, shiftType: "diurno_completo" }],
      }),
    ).rejects.toThrow(/Datos de programación inválidos|inicio/i)
  })

  it("rechaza rango que cruza semanas (Dom→Lun) (schema)", async () => {
    await expect(
      bulkUpsertRangeSedeShifts({
        dateFrom: "2026-05-17", // Domingo de la semana del 11
        dateTo: "2026-05-18",   // Lunes de la semana del 18
        modality: "sede",
        assignments: [{ staffId: staffA, shiftType: "diurno_completo" }],
      }),
    ).rejects.toThrow(/Datos de programación inválidos|misma semana|lunes a domingo/i)
  })

  it("rango 1 día (dateFrom == dateTo) procesa correctamente", async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    const result = await bulkUpsertRangeSedeShifts({
      dateFrom: "2026-05-13",
      dateTo: "2026-05-13",
      modality: "sede",
      assignments: [{ staffId: staffA, shiftType: "diurno_completo" }],
    })

    expect(result.daysProcessed).toBe(1)
    expect(result.upserted).toBe(1)
  })

  it("rechaza por permisos", async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError("No tienes permiso para realizar esta accion."))

    await expect(
      bulkUpsertRangeSedeShifts({
        dateFrom,
        dateTo,
        modality: "sede",
        assignments: [],
      }),
    ).rejects.toThrow("permiso")
  })

  it("todos los días saltados → no abre transacción, retorna 0/0/0", async () => {
    // Sin SELECT mock — si la action abre la tx, fallará. Aquí esperamos
    // short-circuit antes de tocar la DB.
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    const result = await bulkUpsertRangeSedeShifts({
      dateFrom: "2026-05-13",
      dateTo: "2026-05-13",
      modality: "sede",
      assignments: [{ staffId: staffA, shiftType: "diurno_completo" }],
      skipDates: ["2026-05-13"],
    })

    expect(result.daysProcessed).toBe(0)
    expect(result.upserted).toBe(0)
    expect(result.removed).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Feature C — Duplicar semana
// ---------------------------------------------------------------------------

describe("getWeeksWithShifts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("devuelve lista de semanas con cuenta de turnos", async () => {
    const rows = [
      { weekStart: '2026-01-12', shiftCount: 14 },
      { weekStart: '2026-01-05', shiftCount: 10 },
    ]
    mockDb.select = vi.fn(() => makeChain(rows))

    const res = await getWeeksWithShifts()

    expect(res).toHaveLength(2)
    expect(res[0].weekStart).toBe('2026-01-12')
    expect(res[0].shiftCount).toBe(14)
  })

  it("respeta el scope de área (admin_area)", async () => {
    vi.mocked(requireAccess).mockResolvedValueOnce({
      userId: 'user-bs',
      role: 'admin_area',
      area: 'banco_sangre',
      staffId: null,
      email: 'bs@test.com',
      fullName: 'BS',
      scope: { kind: 'area' as const, area: 'banco_sangre' },
    })
    mockDb.select = vi.fn(() => makeChain([]))

    const res = await getWeeksWithShifts()

    expect(res).toEqual([])
    expect(mockDb.select).toHaveBeenCalled()
  })

  it("propaga errores de permiso", async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError("No tienes permiso para realizar esta accion."))

    await expect(getWeeksWithShifts()).rejects.toThrow('permiso')
  })

  it("envuelve errores de DB", async () => {
    mockDb.select = vi.fn(() => { throw new Error('boom') })

    await expect(getWeeksWithShifts()).rejects.toThrow(/semanas con turnos/)
  })
})

describe("getWeekShiftsForDuplicate", () => {
  const src = '2026-01-12'
  const tgt = '2026-01-19'
  const staffA = '11111111-1111-4111-8111-111111111111'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna sourceShifts mapeados + collisions detectadas", async () => {
    // 1ra llamada: sourceRows (semana origen). 2da: destRows (semana destino).
    let call = 0
    mockDb.select = vi.fn(() => {
      call += 1
      if (call === 1) {
        return makeChain([
          {
            staffId: staffA,
            firstName: 'Ana',
            lastName: 'Perez',
            staffProfile: 'bacteriologo',
            shiftDate: '2026-01-12', // lunes origen
            shiftType: 'diurno_completo',
            startTime: '07:00',
            endTime: '17:00',
            isOvernight: false,
            extraHours: 0,
            notes: null,
          },
        ])
      }
      // dest: el mismo staff ya tiene un shift el lunes 19 → colisión.
      return makeChain([
        { staffId: staffA, shiftDate: '2026-01-19', shiftType: 'noche' },
      ])
    })

    const res = await getWeekShiftsForDuplicate(src, tgt)

    expect(res.sourceShifts).toHaveLength(1)
    expect(res.sourceShifts[0].shiftDate).toBe('2026-01-12')
    expect(res.destinationCollisions).toEqual([
      { targetDate: '2026-01-19', staffId: staffA, existingShiftType: 'noche' },
    ])
  })

  it("retorna vacío cuando no hay shifts en origen", async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const res = await getWeekShiftsForDuplicate(src, tgt)

    expect(res.sourceShifts).toEqual([])
    expect(res.destinationCollisions).toEqual([])
  })

  it("rechaza formato de fecha inválido", async () => {
    await expect(
      getWeekShiftsForDuplicate('no-date', tgt),
    ).rejects.toThrow(/Formato de fecha inválido/)
  })

  it("propaga errores de permiso", async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError("No tienes permiso para realizar esta accion."))

    await expect(getWeekShiftsForDuplicate(src, tgt)).rejects.toThrow('permiso')
  })
})

describe("duplicateWeekSedeShifts", () => {
  const src = '2026-01-12'
  const tgt = '2026-01-19'
  const staffA = '11111111-1111-4111-8111-111111111111'
  const staffB = '22222222-2222-4222-8222-222222222222'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("perDay con 7 días sin colisiones llama upsertDayShiftsCore 7 veces", async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    const perDay = Array.from({ length: 7 }, (_, i) => {
      const day = new Date('2026-01-19T00:00:00')
      day.setDate(day.getDate() + i)
      return {
        date: day.toISOString().slice(0, 10),
        modality: 'sede' as const,
        assignments: [
          { staffId: staffA, shiftType: 'diurno_completo' as const },
        ],
      }
    })

    const result = await duplicateWeekSedeShifts({
      sourceWeekStart: src,
      targetWeekStart: tgt,
      perDay,
    })

    expect(result.daysProcessed).toBe(7)
    expect(result.upserted).toBe(7)
    expect(mockDb.insert).toHaveBeenCalledTimes(7)
  })

  it("perDay con varias asignaciones en un día las upsertea todas", async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.delete = vi.fn(() => makeChain([]))

    const result = await duplicateWeekSedeShifts({
      sourceWeekStart: src,
      targetWeekStart: tgt,
      perDay: [
        {
          date: '2026-01-19',
          modality: 'sede',
          assignments: [
            { staffId: staffA, shiftType: 'diurno_completo' },
            { staffId: staffB, shiftType: 'noche' },
          ],
        },
      ],
    })

    expect(result.daysProcessed).toBe(1)
    expect(result.upserted).toBe(2)
  })

  it("perDay vacío → no-op, retorna 0/0/0 sin abrir transacción", async () => {
    // Si la action abre la tx, mockDb.transaction es invocado. Verificamos
    // que NO se llamó.
    const txSpy = (db as unknown as { transaction: ReturnType<typeof vi.fn> })
      .transaction

    const result = await duplicateWeekSedeShifts({
      sourceWeekStart: src,
      targetWeekStart: tgt,
      perDay: [],
    })

    expect(result.daysProcessed).toBe(0)
    expect(result.upserted).toBe(0)
    expect(result.removed).toBe(0)
    expect(txSpy).not.toHaveBeenCalled()
  })

  it("bloquea cuando una fecha de perDay no pertenece a la semana destino", async () => {
    await expect(
      duplicateWeekSedeShifts({
        sourceWeekStart: src,
        targetWeekStart: tgt,
        perDay: [
          {
            // 2026-01-26 es la semana SIGUIENTE a tgt (no la semana destino).
            date: '2026-01-26',
            modality: 'sede',
            assignments: [
              { staffId: staffA, shiftType: 'diurno_completo' },
            ],
          },
        ],
      }),
    ).rejects.toThrow(/no pertenece a la semana destino/)
  })

  it("rechaza payload inválido (sourceWeekStart mal formado)", async () => {
    await expect(
      duplicateWeekSedeShifts({
        sourceWeekStart: 'no-date',
        targetWeekStart: tgt,
        perDay: [],
      }),
    ).rejects.toThrow(/Datos de duplicación inválidos/)
  })

  it("propaga errores de permiso", async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError("No tienes permiso para realizar esta accion."))

    await expect(
      duplicateWeekSedeShifts({
        sourceWeekStart: src,
        targetWeekStart: tgt,
        perDay: [],
      }),
    ).rejects.toThrow('permiso')
  })
})

