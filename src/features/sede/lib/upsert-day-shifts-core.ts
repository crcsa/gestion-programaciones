import { eq, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import type { Area } from '@/types/areas'
import type { Role } from '@/types/roles'
import type { Scope } from '@/types/scope'
import type { ValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import type { ParsedDayAssignmentItem } from '@/features/sede/schemas/sede-shift-schemas'
import {
  SEDE_SHIFT_DEFAULTS,
  SHIFT_TYPES_BY_MODALITY,
  SEDE_MODALITY_LABELS,
  MODALITY_BY_SHIFT_TYPE,
  effectiveShiftHours,
  type SedeModality,
  type ShiftType,
} from '@/features/sede/lib/shift-defaults'

export interface UpsertDayShiftsResult {
  upserted: number
  removed: number
}

/**
 * Caller context que reusa `upsertDayShiftsCore`. Permite invocar el core desde
 * una transacción ya abierta (la action de rango / duplicar) sin re-pedir
 * `requireAccess` por día.
 */
export interface UpsertDayShiftsContext {
  userId: string
  role: Role
  area: Area | null
  scope: Scope
}

export interface UpsertDayShiftsCoreInput {
  /** Transacción ya abierta (mismo `db.transaction` envolvente). */
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
  dayDate: string
  modality: SedeModality
  assignments: ParsedDayAssignmentItem[]
  ctx: UpsertDayShiftsContext
  cfg: ValidationRuntimeConfig
  /** Set que el caller debe consumir POST-commit para disparar recalc. */
  recalcQueue: Set<string>
}

/**
 * Calcula horas EFECTIVAS de un turno (con almuerzo descontado en diurnos)
 * para persistir en `sede_shifts.total_hours`, clampeando por `maxShiftHours`.
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

/**
 * Lógica core del upsert día-de-turnos sede, **scoped por área y por
 * modalidad**. Extraída de `bulkUpsertDaySedeShifts` para que las actions
 * multi-día (rango / duplicar semana) reusen exactamente el mismo
 * comportamiento por día dentro de una sola transacción envolvente.
 *
 * **Reglas críticas (defensa profunda):**
 * - Borra los turnos de la misma modalidad que NO vienen en el payload. Los
 *   de la OTRA modalidad ese día NO se tocan (un servicio transfusional
 *   permanece intacto cuando se programa sede regular ese mismo día).
 * - Bloquea con `ValidationError` si algún staff del payload ya tiene un
 *   turno de la OTRA modalidad ese día (un turno por persona por día).
 * - admin_area solo puede tocar staff de su propia área (verificación al
 *   server, no solo por UI).
 *
 * El recalc de agregados NO se hace aquí — los staffIds tocados se acumulan
 * en `recalcQueue` y se procesan POST-commit por el caller. Esto evita que
 * un fallo de recalc revierta la transacción (las horas se recalculan luego
 * por el cron) y permite agrupar el recalc cuando se tocan muchos días.
 */
export async function upsertDayShiftsCore(
  input: UpsertDayShiftsCoreInput,
): Promise<UpsertDayShiftsResult> {
  const { tx, dayDate, modality, assignments, ctx, cfg, recalcQueue } = input
  const { userId, scope } = ctx
  const modalityTypes = SHIFT_TYPES_BY_MODALITY[modality]

  const seen = new Set<string>()
  for (const a of assignments) {
    if (seen.has(a.staffId)) {
      throw new ValidationError('Hay colaboradores duplicados en la programación del día')
    }
    seen.add(a.staffId)
    if (!modalityTypes.includes(a.shiftType as ShiftType)) {
      throw new ValidationError('El tipo de turno no corresponde a la modalidad seleccionada')
    }
  }

  const ownerScope: Area | null = scope.kind === 'global' ? null : scope.area
  const existing = await tx
    .select({
      id: sedeShifts.id,
      staffId: sedeShifts.staffId,
      shiftType: sedeShifts.shiftType,
    })
    .from(sedeShifts)
    .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
    .where(
      and(
        eq(sedeShifts.shiftDate, dayDate),
        ownerScope ? eq(staffMembers.area, ownerScope) : undefined,
      ),
    )

  const incomingIds = new Set(assignments.map((a) => a.staffId))

  const sameModalityExisting = existing.filter((e) =>
    modalityTypes.includes(e.shiftType as ShiftType),
  )
  const toRemove = sameModalityExisting.filter((e) => !incomingIds.has(e.staffId))
  const removedStaffIds = toRemove.map((e) => e.staffId)

  const conflicting = existing.filter(
    (e) => incomingIds.has(e.staffId) && !modalityTypes.includes(e.shiftType as ShiftType),
  )
  if (conflicting.length > 0) {
    const otherLabels = Array.from(
      new Set(
        conflicting.map(
          (e) => SEDE_MODALITY_LABELS[MODALITY_BY_SHIFT_TYPE[e.shiftType as ShiftType]],
        ),
      ),
    ).join(', ')
    throw new ValidationError(
      `Hay colaboradores que ya tienen un turno de ${otherLabels} el ${dayDate}. ` +
        'Quítalo desde esa modalidad antes de programarlos aquí (un turno por persona por día).',
    )
  }

  if (ctx.role !== 'admin') {
    const incomingArr = Array.from(incomingIds)
    if (incomingArr.length > 0) {
      const ownerships = await tx
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

  if (toRemove.length > 0) {
    await tx
      .delete(sedeShifts)
      .where(
        and(
          eq(sedeShifts.shiftDate, dayDate),
          inArray(sedeShifts.staffId, removedStaffIds),
        ),
      )
  }

  let upserted = 0
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
        shiftDate: dayDate,
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

  for (const id of incomingIds) recalcQueue.add(id)
  for (const id of removedStaffIds) recalcQueue.add(id)

  return { upserted, removed: removedStaffIds.length }
}
