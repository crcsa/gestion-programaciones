'use server'

import { eq, and, asc, gte, lte, inArray, sql } from 'drizzle-orm'
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
  SEDE_SHIFT_DEFAULTS,
  SHIFT_TYPES_BY_MODALITY,
  SEDE_MODALITY_LABELS,
  MODALITY_BY_SHIFT_TYPE,
  effectiveShiftHours,
  MIN_EFFECTIVE_HOURS_DIURNO,
  type ShiftType,
} from '@/features/sede/lib/shift-defaults'

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

export interface BulkUpsertDayShiftsResult {
  upserted: number
  removed: number
}

export async function bulkUpsertDaySedeShifts(
  input: BulkUpsertDayShiftsInput,
): Promise<BulkUpsertDayShiftsResult> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })
  const { userId, scope } = ctx

  const safe = bulkUpsertDayShiftsSchema.safeParse(input)
  if (!safe.success) {
    throw new ValidationError(`Datos de programación inválidos: ${safe.error.issues[0]?.message ?? ''}`)
  }
  const { shiftDate, modality, assignments } = safe.data
  const modalityTypes = SHIFT_TYPES_BY_MODALITY[modality]

  // Detección temprana de duplicados de staff en el payload
  const seen = new Set<string>()
  for (const a of assignments) {
    if (seen.has(a.staffId)) {
      throw new ValidationError('Hay colaboradores duplicados en la programación del día')
    }
    seen.add(a.staffId)
    // Defensa profunda: el tipo de cada turno debe pertenecer a la modalidad
    // que se está programando (la UI lo garantiza, pero blindamos el server).
    if (!modalityTypes.includes(a.shiftType as ShiftType)) {
      throw new ValidationError('El tipo de turno no corresponde a la modalidad seleccionada')
    }
  }

  const cfg = await loadValidationRuntimeConfig()

  try {
    // `existing` se usa para (a) calcular qué turnos hay que borrar (los que
    // NO vienen en el payload) y (b) saber qué staff fue tocado para el
    // recálculo de horas. CRÍTICO: para admin_area, debe estar scoped al
    // área del caller — si no, un admin_area de comercial vería un shift de
    // banco_sangre que existe en esa fecha, lo marcaría como `toRemove`, e
    // intentaría borrarlo (con la consecuente verificación de área que
    // bloquea con "No puedes programar turnos para personal de otra área",
    // aunque el caller no tocó conscientemente a ese staff).
    const ownerScope: Area | null = scope.kind === 'global' ? null : scope.area
    const existing = await db
      .select({
        id: sedeShifts.id,
        staffId: sedeShifts.staffId,
        shiftType: sedeShifts.shiftType,
      })
      .from(sedeShifts)
      .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
      .where(
        and(
          eq(sedeShifts.shiftDate, shiftDate),
          ownerScope ? eq(staffMembers.area, ownerScope) : undefined,
        ),
      )

    const incomingIds = new Set(assignments.map((a) => a.staffId))

    // El guardado afecta SOLO la modalidad seleccionada. Los turnos de esa
    // modalidad que ya no vienen en el payload se eliminan; los de la OTRA
    // modalidad ese día no se tocan.
    const sameModalityExisting = existing.filter((e) =>
      modalityTypes.includes(e.shiftType as ShiftType),
    )
    const toRemove = sameModalityExisting.filter((e) => !incomingIds.has(e.staffId))
    const removedStaffIds = toRemove.map((e) => e.staffId)

    // Un colaborador tiene a lo sumo un turno por día. Si alguien del payload
    // ya tiene un turno de la OTRA modalidad ese día, bloqueamos: el upsert
    // (onConflict staffId+shiftDate) sobrescribiría ese turno, violando la
    // separación entre modalidades. El admin debe quitarlo primero.
    const conflicting = existing.filter(
      (e) => incomingIds.has(e.staffId) && !modalityTypes.includes(e.shiftType as ShiftType),
    )
    if (conflicting.length > 0) {
      const otherLabels = Array.from(
        new Set(conflicting.map((e) => SEDE_MODALITY_LABELS[MODALITY_BY_SHIFT_TYPE[e.shiftType as ShiftType]])),
      ).join(', ')
      throw new ValidationError(
        `Hay colaboradores que ya tienen un turno de ${otherLabels} ese día. ` +
          'Quítalo desde esa modalidad antes de programarlos aquí (un turno por persona por día).',
      )
    }

    // Verificación de área para admins no globales: cada staffId del payload
    // (creación/upsert) debe pertenecer al área del caller. `removedStaffIds`
    // ya está scoped por el filtro de `existing`, así que solo validamos los
    // incomingIds.
    if (ctx.role !== 'admin') {
      const incomingArr = Array.from(incomingIds)
      if (incomingArr.length > 0) {
        const ownerships = await db
          .select({ id: staffMembers.id, area: staffMembers.area })
          .from(staffMembers)
          .where(inArray(staffMembers.id, incomingArr))
        const areaById = new Map(ownerships.map((r) => [r.id, r.area]))
        for (const id of incomingArr) {
          const area = areaById.get(id)
          if (!area) throw new NotFoundError('Colaborador no encontrado')
          if (area !== ctx.area) {
            throw new ValidationError('No puedes programar turnos para personal de otra área.')
          }
        }
      }
    }

    let upserted = 0
    await db.transaction(async (tx) => {
      if (toRemove.length > 0) {
        // CRÍTICO: borramos POR staffId explícito (los que estaban en
        // `existing` scoped y no vienen en el payload). El patrón anterior
        // `notInArray(assignments)` borraba TODOS los shifts del día no
        // listados, incluidos los de otras áreas — un admin_area de comercial
        // habría wipeado los turnos de banco_sangre en esa fecha.
        await tx
          .delete(sedeShifts)
          .where(
            and(
              eq(sedeShifts.shiftDate, shiftDate),
              inArray(sedeShifts.staffId, removedStaffIds),
            ),
          )
      }

      for (const a of assignments) {
        const defaults = SEDE_SHIFT_DEFAULTS[a.shiftType]
        const startTime = a.startTime ?? defaults.startTime
        const endTime = a.endTime ?? defaults.endTime
        const isOvernight = a.isOvernight ?? defaults.isOvernight
        const totalHours = calcHours(startTime, endTime, isOvernight, cfg.maxShiftHours, a.shiftType)
        const extraHours = a.extraHours ?? 0

        await tx
          .insert(sedeShifts)
          .values({
            staffId: a.staffId,
            shiftDate,
            shiftType: a.shiftType,
            startTime,
            endTime,
            totalHours,
            isOvernight,
            extraHours,
            notes: a.notes ?? null,
            createdById: userId,
          })
          .onConflictDoUpdate({
            target: [sedeShifts.staffId, sedeShifts.shiftDate],
            set: {
              shiftType: a.shiftType,
              startTime,
              endTime,
              totalHours,
              isOvernight,
              extraHours,
              notes: a.notes ?? null,
              updatedAt: new Date(),
            },
          })
        upserted++
      }
    })

    // Recalcula horas para todos los staff tocados (incluidos los removidos).
    // Fuera de la transacción: si recalc falla no debe revertir los shifts.
    const touchedIds = new Set<string>([...incomingIds, ...removedStaffIds])
    await recalcAggregatesForDate(touchedIds, shiftDate, 'bulkUpsertDaySedeShifts')

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'sede_shifts',
      recordId: shiftDate,
      newData: { upserted, removed: removedStaffIds.length },
    })

    revalidatePath('/turnos')

    return { upserted, removed: removedStaffIds.length }
  } catch (error) {
    if (error instanceof AppError) throw error
    // Surface más contexto del error de DB (Drizzle adjunta `cause` con el error de Postgres).
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
