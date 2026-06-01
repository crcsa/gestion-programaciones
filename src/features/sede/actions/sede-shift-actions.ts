'use server'

import { eq, and, asc, gte, lte, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireAccess } from '@/features/auth/lib/require-access'
import { assertSameArea } from '@/features/auth/lib/assert-same-area'
import { AppError, NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import type { Area } from '@/types/areas'
import type { Role } from '@/types/roles'
import { recalcAggregatesForDate } from '@/features/hours/lib/aggregate-staff-data'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import { logAudit } from '@/lib/audit/log-audit'
import {
  createSedeShiftSchema,
  updateSedeShiftSchema,
  bulkUpsertDayShiftsSchema,
} from '@/features/sede/schemas/sede-shift-schemas'
import type {
  CreateSedeShiftInput,
  UpdateSedeShiftInput,
  BulkUpsertDayShiftsInput,
} from '@/features/sede/schemas/sede-shift-schemas'
import {
  effectiveShiftHours,
  MIN_EFFECTIVE_HOURS_DIURNO,
  type ShiftType,
} from '@/features/sede/lib/shift-defaults'
import {
  upsertDayShiftsCore,
  type UpsertDayShiftsResult,
} from '@/features/sede/lib/upsert-day-shifts-core'
// Imports adicionales para las actions de rango (Feature B). Mantener en una
// línea separada para minimizar conflictos con otros agentes que también
// extienden este archivo al final.
import { inArray } from 'drizzle-orm'
import { bulkUpsertRangeShiftsSchema } from '@/features/sede/schemas/sede-shift-schemas'
import type { BulkUpsertRangeShiftsInput } from '@/features/sede/schemas/sede-shift-schemas'
import {
  MODALITY_BY_SHIFT_TYPE,
  type SedeModality,
} from '@/features/sede/lib/shift-defaults'
// Imports adicionales para Feature C — duplicar semana. Mantenidos en líneas
// separadas para minimizar conflictos con otros agentes que extiendan este
// archivo al final.
import { duplicateWeekSedeShiftsSchema } from '@/features/sede/schemas/sede-shift-schemas'
import type { DuplicateWeekSedeShiftsInput } from '@/features/sede/schemas/sede-shift-schemas'
import {
  weekDaysFromMonday,
  findCollisions,
  type DuplicateCollision,
} from '@/features/sede/lib/week-duplicate-mapping'

// ---- Types ----------------------------------------------------------------

export interface SedeShiftRow {
  id: string
  staffId: string
  firstName: string
  lastName: string
  staffProfile: string
  shiftDate: string
  shiftType: 'diurno_completo' | 'noche' | 'posturno' | 'servicios_transfusionales'
  startTime: string
  endTime: string
  totalHours: number
  isOvernight: boolean
  extraHours: number
  notes: string | null
}

export interface StaffListItem {
  id: string
  firstName: string
  lastName: string
  staffProfile: string
}

// ---- Constants ------------------------------------------------------------

const DAYS_IN_WEEK = 6

// ---- Helpers --------------------------------------------------------------

/**
 * Calcula las horas EFECTIVAS de un turno sede para persistir en
 * `sede_shifts.total_hours`. Delega en `effectiveShiftHours` que descuenta el
 * almuerzo según `shiftType` (1h en diurno_completo, 0 en los demás).
 *
 * Se clampea por arriba con `maxShiftHours` (default 12) para coherencia con
 * la validación `TURNO_EXCESIVO` del motor de reglas. El piso (8h efectivas)
 * para diurno se valida antes en los schemas Zod.
 */
function calcHours(
  startTime: string,
  endTime: string,
  isOvernight: boolean,
  maxShiftHours: number,
  shiftType: ShiftType,
): number {
  const eff = effectiveShiftHours(startTime, endTime, isOvernight, shiftType)
  return Math.min(maxShiftHours, Math.round(eff))
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() + DAYS_IN_WEEK)
  return d.toISOString().slice(0, 10)
}

// ---- Actions --------------------------------------------------------------

/**
 * Lanza si el caller no puede tocar el shift del staff dado (distinta área).
 * Admin global pasa; banco_sangre solo si su área == staff.area.
 */
async function ensureCallerCanEditShiftStaff(
  ctx: { role: Role; area: Area | null },
  staffId: string,
): Promise<void> {
  if (ctx.role === 'admin') return
  const [staff] = await db
    .select({ area: staffMembers.area })
    .from(staffMembers)
    .where(eq(staffMembers.id, staffId))
    .limit(1)
  if (!staff) throw new NotFoundError('Colaborador no encontrado')
  assertSameArea(ctx, staff.area, 'personal')
}

export async function getActiveStaffList(): Promise<StaffListItem[]> {
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })
  const areaScope: Area | null = scope.kind === 'global' ? null : scope.area

  try {
    const where = [eq(staffMembers.isActive, true)]
    if (areaScope) where.push(eq(staffMembers.area, areaScope))
    return await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(and(...where))
      .orderBy(asc(staffMembers.lastName))
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener la lista de colaboradores')
  }
}

export async function getWeeklySedeShifts(weekStart: string): Promise<SedeShiftRow[]> {
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })
  const areaScope: Area | null = scope.kind === 'global' ? null : scope.area

  try {
    const weekEnd = getWeekEnd(weekStart)

    const rows = await db
      .select({
        id: sedeShifts.id,
        staffId: sedeShifts.staffId,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
        shiftDate: sedeShifts.shiftDate,
        shiftType: sedeShifts.shiftType,
        startTime: sedeShifts.startTime,
        endTime: sedeShifts.endTime,
        totalHours: sedeShifts.totalHours,
        isOvernight: sedeShifts.isOvernight,
        extraHours: sedeShifts.extraHours,
        notes: sedeShifts.notes,
      })
      .from(sedeShifts)
      .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
      .where(
        and(
          gte(sedeShifts.shiftDate, weekStart),
          lte(sedeShifts.shiftDate, weekEnd),
          areaScope ? eq(staffMembers.area, areaScope) : undefined,
        ),
      )
      .orderBy(asc(sedeShifts.shiftDate), asc(staffMembers.lastName))

    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      staffProfile: r.staffProfile ?? '',
      shiftDate: r.shiftDate,
      shiftType: r.shiftType,
      startTime: r.startTime,
      endTime: r.endTime,
      totalHours: r.totalHours,
      isOvernight: r.isOvernight,
      extraHours: r.extraHours,
      notes: r.notes,
    }))
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener los turnos de la semana')
  }
}

export async function createSedeShift(data: CreateSedeShiftInput): Promise<void> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })
  const userId = ctx.userId
  if (data.staffId) {
    await ensureCallerCanEditShiftStaff(ctx, data.staffId)
  }

  try {
    const safe = createSedeShiftSchema.safeParse(data)
    if (!safe.success) {
      const issue = safe.error.issues[0]
      throw new ValidationError(`Datos de turno inválidos: ${issue?.path?.join('.') ?? ''} ${issue?.message ?? ''}`.trim())
    }
    const parsed = safe.data
    const cfg = await loadValidationRuntimeConfig()
    const totalHours = calcHours(parsed.startTime, parsed.endTime, parsed.isOvernight, cfg.maxShiftHours, parsed.shiftType)

    // Idempotente: si ya existe (staff, fecha), actualiza en vez de duplicar.
    await db
      .insert(sedeShifts)
      .values({
        staffId: parsed.staffId,
        shiftDate: parsed.shiftDate,
        shiftType: parsed.shiftType,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        totalHours,
        isOvernight: parsed.isOvernight,
        extraHours: parsed.extraHours ?? 0,
        notes: parsed.notes ?? null,
        createdById: userId,
      })
      .onConflictDoUpdate({
        target: [sedeShifts.staffId, sedeShifts.shiftDate],
        set: {
          shiftType: parsed.shiftType,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          totalHours,
          isOvernight: parsed.isOvernight,
          extraHours: parsed.extraHours ?? 0,
          notes: parsed.notes ?? null,
          updatedAt: new Date(),
        },
      })

    await recalcAggregatesForDate(parsed.staffId, parsed.shiftDate, 'createSedeShift')
  } catch (error) {
    rethrowOrLog(error, 'createSedeShift', 'Error al crear el turno')
  }
}

export async function updateSedeShift(id: string, data: UpdateSedeShiftInput): Promise<void> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })
  // Cargamos la fila existente una sola vez: la usamos para (a) verificar
  // pertenencia de área y (b) hacer merge con el patch para validar el min 8h
  // (diurno) y recalcular total_hours con el shiftType correcto.
  const [existing] = await db
    .select({
      staffId: sedeShifts.staffId,
      startTime: sedeShifts.startTime,
      endTime: sedeShifts.endTime,
      isOvernight: sedeShifts.isOvernight,
      shiftType: sedeShifts.shiftType,
    })
    .from(sedeShifts)
    .where(eq(sedeShifts.id, id))
    .limit(1)
  if (!existing) throw new NotFoundError('Turno no encontrado')
  if (ctx.role !== 'admin') {
    await ensureCallerCanEditShiftStaff(ctx, existing.staffId)
  }

  try {
    const safe = updateSedeShiftSchema.safeParse(data)
    if (!safe.success) {
      const issue = safe.error.issues[0]
      throw new ValidationError(`Datos de turno inválidos: ${issue?.path?.join('.') ?? ''} ${issue?.message ?? ''}`.trim())
    }
    const parsed = safe.data

    // Merge con la fila actual para validar/recalcular con el estado final.
    const finalStart = parsed.startTime ?? existing.startTime
    const finalEnd = parsed.endTime ?? existing.endTime
    const finalOvernight = parsed.isOvernight ?? existing.isOvernight
    const finalShiftType = (parsed.shiftType ?? existing.shiftType) as ShiftType

    // Re-validar min 8h efectivas si el resultado quedaría como un turno diurno
    // (diurno_completo o servicios_transfusionales — ambos descuentan almuerzo).
    if (finalShiftType === 'diurno_completo' || finalShiftType === 'servicios_transfusionales') {
      const eff = effectiveShiftHours(finalStart, finalEnd, finalOvernight, finalShiftType)
      if (eff < MIN_EFFECTIVE_HOURS_DIURNO) {
        throw new ValidationError(
          'Los turnos diurnos deben tener al menos 8h efectivas (descontando 1h de almuerzo).',
        )
      }
    }

    const updateValues: Record<string, unknown> = {
      ...parsed,
      updatedAt: new Date(),
    }

    // Recalcular total_hours si cambia cualquier componente que lo afecte.
    const timingChanged =
      parsed.startTime !== undefined ||
      parsed.endTime !== undefined ||
      parsed.isOvernight !== undefined ||
      parsed.shiftType !== undefined
    if (timingChanged) {
      const cfg = await loadValidationRuntimeConfig()
      updateValues.totalHours = calcHours(
        finalStart,
        finalEnd,
        finalOvernight,
        cfg.maxShiftHours,
        finalShiftType,
      )
    }

    const result = await db
      .update(sedeShifts)
      .set(updateValues)
      .where(eq(sedeShifts.id, id))
      .returning({
        id: sedeShifts.id,
        staffId: sedeShifts.staffId,
        shiftDate: sedeShifts.shiftDate,
      })

    if (result.length === 0) {
      throw new NotFoundError('Turno no encontrado')
    }

    const updatedShift = result[0]
    await recalcAggregatesForDate(updatedShift.staffId, updatedShift.shiftDate, 'updateSedeShift')
  } catch (error) {
    rethrowOrLog(error, 'updateSedeShift', 'Error al actualizar el turno')
  }
}

export type BulkUpsertDayShiftsResult = UpsertDayShiftsResult

export async function bulkUpsertDaySedeShifts(
  input: BulkUpsertDayShiftsInput,
): Promise<BulkUpsertDayShiftsResult> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })

  const safe = bulkUpsertDayShiftsSchema.safeParse(input)
  if (!safe.success) {
    throw new ValidationError(`Datos de programación inválidos: ${safe.error.issues[0]?.message ?? ''}`)
  }
  const { shiftDate, modality, assignments } = safe.data

  const cfg = await loadValidationRuntimeConfig()

  try {
    const recalcQueue = new Set<string>()
    let result: BulkUpsertDayShiftsResult = { upserted: 0, removed: 0 }

    await db.transaction(async (tx) => {
      result = await upsertDayShiftsCore({
        tx,
        dayDate: shiftDate,
        modality,
        assignments,
        ctx,
        cfg,
        recalcQueue,
      })
    })

    // Recalcula fuera de la transacción: un fallo de recalc no debe revertir
    // los shifts ya guardados (el cron compensa). El Set asegura que cada
    // staff se recalcule una sola vez aunque sea tocado por varias acciones.
    if (recalcQueue.size > 0) {
      await recalcAggregatesForDate(recalcQueue, shiftDate, 'bulkUpsertDaySedeShifts')
    }

    await logAudit({
      profileId: ctx.userId,
      action: 'update',
      tableName: 'sede_shifts',
      recordId: shiftDate,
      newData: { upserted: result.upserted, removed: result.removed },
    })

    revalidatePath('/turnos')

    return result
  } catch (error) {
    if (error instanceof AppError) throw error
    const cause = (error as { cause?: { message?: string; code?: string } })?.cause
    const detail = cause?.message ?? (error instanceof Error ? error.message : 'desconocido')
    console.error('[bulkUpsertDaySedeShifts] error:', error, 'cause:', cause)

    if (cause?.code === '42P10' || (detail && /no unique.*constraint|on conflict/i.test(detail))) {
      throw new Error(
        'Falta aplicar la migración de turnos (UNIQUE staff_id+shift_date). Ejecuta `pnpm db:migrate`.',
      )
    }

    throw new Error('Error al guardar la programación del día. Revisa los logs para más detalles.')
  }
}


export interface DayShiftCount {
  date: string
  count: number
  types: { diurno: number; noche: number; posturno: number }
}

export async function getMonthlyShiftCounts(
  year: number,
  month: number,
): Promise<DayShiftCount[]> {
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })
  const areaScope: Area | null = scope.kind === 'global' ? null : scope.area

  if (month < 1 || month > 12) {
    throw new ValidationError('Mes inválido')
  }

  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const monthStart = `${year}-${mm}-01`
  const monthEnd = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

  try {
    const rows = await db
      .select({
        shiftDate: sedeShifts.shiftDate,
        shiftType: sedeShifts.shiftType,
        count: sql<number>`count(*)::int`,
      })
      .from(sedeShifts)
      .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
      .where(
        and(
          gte(sedeShifts.shiftDate, monthStart),
          lte(sedeShifts.shiftDate, monthEnd),
          areaScope ? eq(staffMembers.area, areaScope) : undefined,
        ),
      )
      .groupBy(sedeShifts.shiftDate, sedeShifts.shiftType)

    const byDate = new Map<string, DayShiftCount>()
    for (let d = 1; d <= lastDay; d++) {
      const date = `${year}-${mm}-${String(d).padStart(2, '0')}`
      byDate.set(date, { date, count: 0, types: { diurno: 0, noche: 0, posturno: 0 } })
    }

    for (const r of rows) {
      const entry = byDate.get(r.shiftDate)
      if (!entry) continue
      entry.count += r.count
      if (r.shiftType === 'diurno_completo' || r.shiftType === 'servicios_transfusionales') entry.types.diurno += r.count
      else if (r.shiftType === 'noche') entry.types.noche += r.count
      else if (r.shiftType === 'posturno') entry.types.posturno += r.count
    }

    return Array.from(byDate.values())
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener los turnos del mes')
  }
}

export async function getSedeShiftsForDate(shiftDate: string): Promise<SedeShiftRow[]> {
  // Filtramos por scope: admin_area de banco/logística/comercial solo ve los
  // turnos de su propia área. Sin este filtro, el modal de programación del
  // día contaba como "seleccionados" a staff de otras áreas que también
  // tenían shifts en esa fecha — apareciendo "5 seleccionados" cuando el
  // staffList del modal solo mostraba 3.
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })
  const areaScope: Area | null = scope.kind === 'global' ? null : scope.area

  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) {
    throw new ValidationError('Formato de fecha inválido')
  }

  try {
    const rows = await db
      .select({
        id: sedeShifts.id,
        staffId: sedeShifts.staffId,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
        shiftDate: sedeShifts.shiftDate,
        shiftType: sedeShifts.shiftType,
        startTime: sedeShifts.startTime,
        endTime: sedeShifts.endTime,
        totalHours: sedeShifts.totalHours,
        isOvernight: sedeShifts.isOvernight,
        extraHours: sedeShifts.extraHours,
        notes: sedeShifts.notes,
      })
      .from(sedeShifts)
      .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
      .where(
        and(
          eq(sedeShifts.shiftDate, shiftDate),
          areaScope ? eq(staffMembers.area, areaScope) : undefined,
        ),
      )
      .orderBy(asc(staffMembers.lastName))

    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      staffProfile: r.staffProfile ?? '',
      shiftDate: r.shiftDate,
      shiftType: r.shiftType,
      startTime: r.startTime,
      endTime: r.endTime,
      totalHours: r.totalHours,
      isOvernight: r.isOvernight,
      extraHours: r.extraHours,
      notes: r.notes,
    }))
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener los turnos del día')
  }
}

export async function deleteSedeShift(id: string): Promise<void> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })
  if (ctx.role !== 'admin') {
    const [shift] = await db
      .select({ staffId: sedeShifts.staffId })
      .from(sedeShifts)
      .where(eq(sedeShifts.id, id))
      .limit(1)
    if (shift) await ensureCallerCanEditShiftStaff(ctx, shift.staffId)
  }

  try {
    const result = await db
      .delete(sedeShifts)
      .where(eq(sedeShifts.id, id))
      .returning({
        id: sedeShifts.id,
        staffId: sedeShifts.staffId,
        shiftDate: sedeShifts.shiftDate,
      })

    if (result.length === 0) {
      throw new NotFoundError('Turno no encontrado')
    }

    const deletedShift = result[0]
    await recalcAggregatesForDate(deletedShift.staffId, deletedShift.shiftDate, 'deleteSedeShift')
  } catch (error) {
    if (error instanceof Error && error.message === 'Turno no encontrado') throw error
    if (error instanceof AppError) throw error
    throw new Error('Error al eliminar el turno')
  }
}

// ---------------------------------------------------------------------------
// Feature B — Asignación multi-día por rango contiguo (misma semana ISO L–D)
// ---------------------------------------------------------------------------

/**
 * Conflicto detectado por el pre-check de rango: un staff del payload ya
 * tiene un turno de la OTRA modalidad ese día.
 */
export interface RangeConflict {
  date: string
  staffId: string
  existingModality: SedeModality
}

export interface BulkUpsertRangeShiftsResult {
  upserted: number
  removed: number
  daysProcessed: number
  /** Vacío si todo fue ok. Reservado para futuras extensiones donde la action
   *  pueda emitir conflicts no-bloqueantes; hoy el flujo de rango bloquea por
   *  ValidationError y este array siempre llega vacío al cliente. */
  conflicts: RangeConflict[]
}

/**
 * Convierte un rango ISO inclusivo en la lista de días contiguos.
 * Asume que el schema ya validó dateFrom ≤ dateTo y misma semana ISO.
 */
function expandRangeDays(dateFrom: string, dateTo: string): string[] {
  const [y, m, d] = dateFrom.split('-').map(Number)
  const startUTC = Date.UTC(y, m - 1, d)
  const [y2, m2, d2] = dateTo.split('-').map(Number)
  const endUTC = Date.UTC(y2, m2 - 1, d2)
  const out: string[] = []
  for (let t = startUTC; t <= endUTC; t += 24 * 60 * 60 * 1000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

/**
 * Pre-check de conflictos para un rango contiguo + un set de staff: devuelve
 * los días/staffs donde ya existe un turno de la OTRA modalidad. La UI lo usa
 * antes de mostrar el editor (deshabilitar staff con conflicto en TODOS los
 * días) y antes de guardar (preguntar al usuario si quiere saltar los días
 * afectados).
 *
 * Scoped por área del caller: admin_area solo ve los conflictos dentro de su
 * área (consistente con el resto de queries de sede).
 */
export async function getRangeConflicts(input: {
  dateFrom: string
  dateTo: string
  modality: SedeModality
  staffIds: string[]
}): Promise<RangeConflict[]> {
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })
  const areaScope: Area | null = scope.kind === 'global' ? null : scope.area

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateTo)) {
    throw new ValidationError('Formato de fecha inválido')
  }
  if (input.dateFrom > input.dateTo) {
    throw new ValidationError('La fecha de inicio debe ser ≤ a la fecha de fin')
  }

  // Validación de misma semana ISO. Replicamos la lógica del schema para no
  // pagar el costo de un parseo Zod en este pre-check ligero.
  const lunes = (iso: string) => {
    const dt = new Date(`${iso}T00:00:00`)
    const dow = dt.getDay()
    const offset = dow === 0 ? -6 : 1 - dow
    const lun = new Date(dt)
    lun.setDate(dt.getDate() + offset)
    return lun.toISOString().slice(0, 10)
  }
  if (lunes(input.dateFrom) !== lunes(input.dateTo)) {
    throw new ValidationError('El rango debe estar dentro de una misma semana (lunes a domingo)')
  }

  if (input.staffIds.length === 0) return []

  try {
    const rows = await db
      .select({
        shiftDate: sedeShifts.shiftDate,
        staffId: sedeShifts.staffId,
        shiftType: sedeShifts.shiftType,
      })
      .from(sedeShifts)
      .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
      .where(
        and(
          gte(sedeShifts.shiftDate, input.dateFrom),
          lte(sedeShifts.shiftDate, input.dateTo),
          inArray(sedeShifts.staffId, input.staffIds),
          areaScope ? eq(staffMembers.area, areaScope) : undefined,
        ),
      )

    const conflicts: RangeConflict[] = []
    for (const r of rows) {
      const existingModality = MODALITY_BY_SHIFT_TYPE[r.shiftType as ShiftType]
      if (existingModality !== input.modality) {
        conflicts.push({
          date: r.shiftDate,
          staffId: r.staffId,
          existingModality,
        })
      }
    }
    return conflicts
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al verificar conflictos del rango')
  }
}

/**
 * Programa el MISMO conjunto de asignaciones para TODOS los días del rango
 * contiguo `dateFrom..dateTo` (ambos inclusive), excluyendo `skipDates`. El
 * rango debe estar contenido en una sola semana ISO (L–D) — validado por el
 * schema.
 *
 * Comportamiento:
 * - Pre-flight: detecta conflictos con la otra modalidad en cualquier día NO
 *   saltado. Si hay alguno, lanza `ValidationError` con el detalle y NO toca
 *   la DB. La UI debe llamar `getRangeConflicts` antes y proponer skipDates.
 * - Transacción única envolvente: si CUALQUIER día falla, rollback total.
 * - Recalc de agregados POST-commit: una sola pasada batch con el set de
 *   staffs tocados (incluye removidos en cualquier día).
 *
 * `daysProcessed` excluye los `skipDates`. Si todo el rango quedó saltado
 * (caso degenerado), no se abre la transacción y se retorna 0/0/0.
 */
export async function bulkUpsertRangeSedeShifts(
  input: BulkUpsertRangeShiftsInput,
): Promise<BulkUpsertRangeShiftsResult> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })

  const safe = bulkUpsertRangeShiftsSchema.safeParse(input)
  if (!safe.success) {
    throw new ValidationError(`Datos de programación inválidos: ${safe.error.issues[0]?.message ?? ''}`)
  }
  const { dateFrom, dateTo, modality, assignments, skipDates } = safe.data

  const skipSet = new Set(skipDates)
  const days = expandRangeDays(dateFrom, dateTo).filter((d) => !skipSet.has(d))

  // Limite duro defensivo: una semana ISO no debería exceder 7 días.
  if (days.length > 7) {
    throw new ValidationError('El rango excede el máximo permitido (7 días).')
  }

  // Caso degenerado: el usuario saltó todos los días del rango → nada que hacer.
  if (days.length === 0) {
    return { upserted: 0, removed: 0, daysProcessed: 0, conflicts: [] }
  }

  // Pre-flight de conflictos (defensa profunda — la UI ya hizo su pre-check vía
  // `getRangeConflicts`, pero el server NO confía en eso). Si encontramos
  // conflictos en los días NO saltados, rechazamos todo el batch sin tocar la
  // DB y le pasamos al usuario el detalle para que decida saltar o resolver.
  const incomingStaffIds = Array.from(new Set(assignments.map((a) => a.staffId)))
  if (incomingStaffIds.length > 0) {
    const conflicts = await getRangeConflicts({
      dateFrom,
      dateTo,
      modality,
      staffIds: incomingStaffIds,
    })
    const unresolved = conflicts.filter((c) => !skipSet.has(c.date))
    if (unresolved.length > 0) {
      // Listamos hasta 5 conflictos en el mensaje para no inundar la UI. La UI
      // ya tiene el detalle completo desde el pre-check separado.
      const sample = unresolved
        .slice(0, 5)
        .map((c) => `${c.date} (staff ${c.staffId.slice(0, 8)}…)`)
        .join(', ')
      const more = unresolved.length > 5 ? ` y ${unresolved.length - 5} más` : ''
      throw new ValidationError(
        `Hay conflictos no resueltos con la otra modalidad en: ${sample}${more}. ` +
          'Quítalos desde esa modalidad o sáltalos al guardar.',
      )
    }
  }

  const cfg = await loadValidationRuntimeConfig()

  try {
    const recalcQueue = new Set<string>()
    let totalUpserted = 0
    let totalRemoved = 0

    await db.transaction(async (tx) => {
      for (const dayDate of days) {
        const partial = await upsertDayShiftsCore({
          tx,
          dayDate,
          modality,
          assignments,
          ctx,
          cfg,
          recalcQueue,
        })
        totalUpserted += partial.upserted
        totalRemoved += partial.removed
      }
    })

    if (recalcQueue.size > 0) {
      // Recalc fuera de la transacción y en una sola pasada batch. Usamos el
      // primer día del rango como referencia: `recalcAggregatesForDate`
      // recalcula la semana ISO completa de esa fecha, que en este flujo es la
      // misma para todos los días del rango (refine del schema).
      await recalcAggregatesForDate(recalcQueue, dateFrom, 'bulkUpsertRangeSedeShifts')
    }

    await logAudit({
      profileId: ctx.userId,
      action: 'update',
      tableName: 'sede_shifts',
      recordId: `${dateFrom}..${dateTo}`,
      newData: {
        upserted: totalUpserted,
        removed: totalRemoved,
        daysProcessed: days.length,
        modality,
        skipDates,
      },
    })

    revalidatePath('/turnos')

    return {
      upserted: totalUpserted,
      removed: totalRemoved,
      daysProcessed: days.length,
      conflicts: [],
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    const cause = (error as { cause?: { message?: string; code?: string } })?.cause
    const detail = cause?.message ?? (error instanceof Error ? error.message : 'desconocido')
    console.error('[bulkUpsertRangeSedeShifts] error:', error, 'cause:', cause)

    if (cause?.code === '42P10' || (detail && /no unique.*constraint|on conflict/i.test(detail))) {
      throw new Error(
        'Falta aplicar la migración de turnos (UNIQUE staff_id+shift_date). Ejecuta `pnpm db:migrate`.',
      )
    }

    throw new Error('Error al guardar la programación del rango. Revisa los logs para más detalles.')
  }
}

// ---- Banco de horas (badges en programación) -------------------------------

import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { desc } from 'drizzle-orm'

/**
 * Devuelve, para cada staff de la lista, el saldo del banco de horas
 * acumulado al cierre del último `weekStart` conocido dentro del mes
 * `monthDate` (`YYYY-MM-01`).
 *
 * Retorna `Record<string, number>` (serializable cliente↔servidor — Map no
 * lo es). Si un staff no tiene filas para ese mes, no aparece en el record.
 *
 * Permisos: admin global o admin_area. Cuando admin_area, restringe staffIds
 * a su scope.area (defensa profunda — el caller suele filtrar antes).
 */
export async function getBankBalanceForStaffAtMonth(
  staffIds: string[],
  monthDate: string,
): Promise<Record<string, number>> {
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })
  const areaScope: Area | null = scope.kind === 'global' ? null : scope.area

  if (staffIds.length === 0) return {}
  if (!/^\d{4}-\d{2}-01$/.test(monthDate)) {
    throw new ValidationError('monthDate debe tener formato YYYY-MM-01')
  }

  try {
    // Si admin_area, restringir a staff de su área para evitar leakage.
    const filteredIds = areaScope
      ? (
          await db
            .select({ id: staffMembers.id })
            .from(staffMembers)
            .where(
              and(
                inArray(staffMembers.id, staffIds),
                eq(staffMembers.area, areaScope),
              ),
            )
        ).map((s) => s.id)
      : staffIds

    if (filteredIds.length === 0) return {}

    // Para cada staff, traer el row más reciente del mes y quedarse con el
    // bank_balance_month de ese cierre.
    const rows = await db
      .select({
        staffId: weeklyBalance.staffId,
        bankBalanceMonth: weeklyBalance.bankBalanceMonth,
        weekStart: weeklyBalance.weekStart,
      })
      .from(weeklyBalance)
      .where(
        and(
          inArray(weeklyBalance.staffId, filteredIds),
          eq(weeklyBalance.bankMonthKey, monthDate),
        ),
      )
      .orderBy(desc(weeklyBalance.weekStart))

    const byStaff: Record<string, number> = {}
    for (const r of rows) {
      // primer row por staffId = más reciente (por orderBy desc).
      if (byStaff[r.staffId] === undefined) {
        byStaff[r.staffId] = r.bankBalanceMonth
      }
    }
    return byStaff
  } catch (error) {
    rethrowOrLog(
      error,
      'getBankBalanceForStaffAtMonth',
      'Error al obtener el saldo del banco de horas',
    )
  }
}

// ---------------------------------------------------------------------------
// Feature C — Duplicar asignaciones de una semana origen a una semana destino
// ---------------------------------------------------------------------------

/**
 * Resumen de una semana ISO con turnos: lunes de la semana + cuántos turnos
 * sumó (todas las modalidades, dentro del scope de área del caller).
 */
export interface WeekWithShifts {
  weekStart: string
  shiftCount: number
}

/**
 * Lista las semanas con turnos del último año (scoped por área del caller).
 * Pensada para que la UI de "Duplicar semana" muestre las semanas origen
 * disponibles. La semana se trunca por `date_trunc('week', date)` de Postgres
 * que asume lunes como inicio (ISO 8601) — consistente con `weekStart` que
 * usamos en el resto del módulo.
 *
 * Default `limit = 12` (≈3 meses de semanas). Máximo 52.
 */
export async function getWeeksWithShifts(limit = 12): Promise<WeekWithShifts[]> {
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })
  const areaScope: Area | null = scope.kind === 'global' ? null : scope.area

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 52)

  try {
    const rows = await db
      .select({
        weekStart: sql<string>`to_char(date_trunc('week', ${sedeShifts.shiftDate}::date), 'YYYY-MM-DD')`,
        shiftCount: sql<number>`count(*)::int`,
      })
      .from(sedeShifts)
      .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
      .where(
        and(
          gte(sedeShifts.shiftDate, sql`(now() - interval '1 year')::date`),
          areaScope ? eq(staffMembers.area, areaScope) : undefined,
        ),
      )
      .groupBy(sql`date_trunc('week', ${sedeShifts.shiftDate}::date)`)
      .orderBy(sql`date_trunc('week', ${sedeShifts.shiftDate}::date) desc`)
      .limit(safeLimit)

    return rows.map((r) => ({
      weekStart: r.weekStart,
      shiftCount: r.shiftCount,
    }))
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener las semanas con turnos')
  }
}

/**
 * Snapshot del origen + destino para la preview del modal de duplicar:
 * - `sourceShifts`: todos los shifts de la semana origen (ambas modalidades),
 *   con datos del staff para mostrar nombre/perfil en la preview.
 * - `destinationCollisions`: celdas `(staffId, targetDate)` donde el destino
 *   ya tiene un shift y el origen mapeará encima. La UI muestra estos como
 *   conflictos que el usuario debe resolver (skip|overwrite) celda a celda.
 */
export interface WeekShiftsForDuplicate {
  sourceShifts: Array<{
    staffId: string
    firstName: string
    lastName: string
    staffProfile: string
    shiftDate: string
    shiftType: ShiftType
    startTime: string
    endTime: string
    isOvernight: boolean
    extraHours: number
    notes: string | null
  }>
  destinationCollisions: DuplicateCollision[]
}

export async function getWeekShiftsForDuplicate(
  sourceWeekStart: string,
  targetWeekStart: string,
): Promise<WeekShiftsForDuplicate> {
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })
  const areaScope: Area | null = scope.kind === 'global' ? null : scope.area

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(sourceWeekStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(targetWeekStart)
  ) {
    throw new ValidationError('Formato de fecha inválido (esperado YYYY-MM-DD)')
  }

  try {
    const sourceDays = weekDaysFromMonday(sourceWeekStart)
    const targetDays = weekDaysFromMonday(targetWeekStart)
    const sourceFrom = sourceDays[0]
    const sourceTo = sourceDays[sourceDays.length - 1]
    const targetFrom = targetDays[0]
    const targetTo = targetDays[targetDays.length - 1]

    // Cargamos ambos sets en paralelo. Mismo patrón de JOIN+scope que el resto
    // del módulo (filtrado por área del caller).
    const [sourceRows, destRows] = await Promise.all([
      db
        .select({
          staffId: sedeShifts.staffId,
          firstName: staffMembers.firstName,
          lastName: staffMembers.lastName,
          staffProfile: staffMembers.staffProfile,
          shiftDate: sedeShifts.shiftDate,
          shiftType: sedeShifts.shiftType,
          startTime: sedeShifts.startTime,
          endTime: sedeShifts.endTime,
          isOvernight: sedeShifts.isOvernight,
          extraHours: sedeShifts.extraHours,
          notes: sedeShifts.notes,
        })
        .from(sedeShifts)
        .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
        .where(
          and(
            gte(sedeShifts.shiftDate, sourceFrom),
            lte(sedeShifts.shiftDate, sourceTo),
            areaScope ? eq(staffMembers.area, areaScope) : undefined,
          ),
        )
        .orderBy(asc(sedeShifts.shiftDate), asc(staffMembers.lastName)),
      db
        .select({
          staffId: sedeShifts.staffId,
          shiftDate: sedeShifts.shiftDate,
          shiftType: sedeShifts.shiftType,
        })
        .from(sedeShifts)
        .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
        .where(
          and(
            gte(sedeShifts.shiftDate, targetFrom),
            lte(sedeShifts.shiftDate, targetTo),
            areaScope ? eq(staffMembers.area, areaScope) : undefined,
          ),
        ),
    ])

    const sourceShifts = sourceRows.map((r) => ({
      staffId: r.staffId,
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      staffProfile: r.staffProfile ?? '',
      shiftDate: r.shiftDate,
      shiftType: r.shiftType as ShiftType,
      startTime: r.startTime,
      endTime: r.endTime,
      isOvernight: r.isOvernight,
      extraHours: r.extraHours,
      notes: r.notes,
    }))

    const destinationCollisions = findCollisions(
      sourceShifts.map((s) => ({ staffId: s.staffId, shiftDate: s.shiftDate })),
      destRows.map((d) => ({
        staffId: d.staffId,
        shiftDate: d.shiftDate,
        shiftType: d.shiftType,
      })),
      sourceWeekStart,
      targetWeekStart,
    )

    return { sourceShifts, destinationCollisions }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al cargar la programación para duplicar')
  }
}

/**
 * Resultado de `duplicateWeekSedeShifts`.
 */
export interface DuplicateWeekResult {
  upserted: number
  removed: number
  daysProcessed: number
}

/**
 * Aplica las asignaciones agrupadas por (día, modalidad) sobre la semana
 * destino en una única transacción envolvente. Si CUALQUIER bucket falla,
 * rollback total. El recalc de agregados ocurre POST-commit, una sola pasada
 * batch con todos los staffs tocados.
 *
 * El cliente es responsable de:
 * - Filtrar las asignaciones de skip (no incluir esa celda en `perDay`).
 * - Incluir todas las asignaciones cuando es overwrite (la modalidad destino
 *   se reemplaza completa por la nueva lista; comportamiento de
 *   `upsertDayShiftsCore`).
 *
 * Si `perDay` viene vacío (caso degenerado: el usuario deseleccionó todo o
 * mantuvo todo el destino), no se abre transacción y se retorna 0/0/0.
 */
export async function duplicateWeekSedeShifts(
  input: DuplicateWeekSedeShiftsInput,
): Promise<DuplicateWeekResult> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })

  const safe = duplicateWeekSedeShiftsSchema.safeParse(input)
  if (!safe.success) {
    throw new ValidationError(
      `Datos de duplicación inválidos: ${safe.error.issues[0]?.message ?? ''}`,
    )
  }
  const { sourceWeekStart, targetWeekStart, perDay } = safe.data

  // Caso degenerado: nada que persistir.
  if (perDay.length === 0) {
    return { upserted: 0, removed: 0, daysProcessed: 0 }
  }

  // Defensa profunda: garantizar que las fechas de cada bucket caen dentro de
  // los 7 días de la semana destino. Esto bloquea payloads mal armados desde
  // un cliente comprometido.
  const validTargetDays = new Set(weekDaysFromMonday(targetWeekStart))
  for (const entry of perDay) {
    if (!validTargetDays.has(entry.date)) {
      throw new ValidationError(
        `La fecha ${entry.date} no pertenece a la semana destino (${targetWeekStart}).`,
      )
    }
  }

  const cfg = await loadValidationRuntimeConfig()

  try {
    const recalcQueue = new Set<string>()
    let totalUpserted = 0
    let totalRemoved = 0

    await db.transaction(async (tx) => {
      for (const entry of perDay) {
        const partial = await upsertDayShiftsCore({
          tx,
          dayDate: entry.date,
          modality: entry.modality,
          assignments: entry.assignments,
          ctx,
          cfg,
          recalcQueue,
        })
        totalUpserted += partial.upserted
        totalRemoved += partial.removed
      }
    })

    if (recalcQueue.size > 0) {
      // Recalc fuera de la transacción. Usamos el targetWeekStart como
      // referencia: `recalcAggregatesForDate` recalcula la semana ISO completa
      // y como todos los buckets están en esa misma semana, una sola pasada
      // cubre el destino.
      await recalcAggregatesForDate(
        recalcQueue,
        targetWeekStart,
        'duplicateWeekSedeShifts',
      )
    }

    await logAudit({
      profileId: ctx.userId,
      action: 'update',
      tableName: 'sede_shifts',
      recordId: `dup:${sourceWeekStart}->${targetWeekStart}`,
      newData: {
        sourceWeekStart,
        targetWeekStart,
        upserted: totalUpserted,
        removed: totalRemoved,
        daysProcessed: perDay.length,
      },
    })

    revalidatePath('/turnos')

    return {
      upserted: totalUpserted,
      removed: totalRemoved,
      daysProcessed: perDay.length,
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    const cause = (error as { cause?: { message?: string; code?: string } })?.cause
    console.error('[duplicateWeekSedeShifts] error:', error, 'cause:', cause)
    throw new Error(
      'Error al duplicar la programación de la semana. Revisa los logs para más detalles.',
    )
  }
}

// Re-exportamos el tipo de colisiones para que la UI lo consuma sin importar
// del módulo lib.
export type { DuplicateCollision } from '@/features/sede/lib/week-duplicate-mapping'
