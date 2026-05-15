'use server'

import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { campaigns, campaignDays } from '@/lib/db/schema/campaigns'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaignVehicles } from '@/lib/db/schema/campaign-vehicles'
import { staffAvailability } from '@/lib/db/schema/staff-availability'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { monthlyCounters } from '@/lib/db/schema/monthly-counters'
import { requireAccess } from '@/features/auth/lib/require-access'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import {
  runAllValidations,
  type ValidationResult,
  type CampaignDayContext,
  type ExistingActivity,
} from '@/features/assignments/lib/validation-engine'
import { getMondayOfIsoDate, getSundayOfWeek } from '@/lib/date/week'
import { effectiveShiftHours, type ShiftType } from '@/features/sede/lib/shift-defaults'

export interface ValidateSedeShiftInput {
  staffId: string
  shiftDate: string
  startTime: string
  endTime: string
  isOvernight: boolean
  /** ID del turno actual si se está editando (excluir de superposición). */
  excludeShiftId?: string
  /**
   * Si true, ignora cualquier turno existente del mismo (staff, shiftDate) en
   * la detección de superposición. Lo usa el bulk upsert: el INSERT colisiona
   * vía `onConflictDoUpdate`, así que las filas anteriores serán reemplazadas
   * y no deben contar como overlap.
   */
  isUpsert?: boolean
  /**
   * Tipo de turno propuesto. Se usa para pronosticar las horas EFECTIVAS de
   * la semana (con descuento de almuerzo en diurno_completo) y advertir si
   * el upsert llevaría al staff a exceder el contrato semanal o el máximo de
   * extras. Default `'diurno_completo'` para back-compat con callers viejos.
   */
  shiftType?: ShiftType
}

export interface SedeShiftValidationResponse {
  results: ValidationResult[]
  hasBlock: boolean
  hasWarn: boolean
}

// Helpers timezone-safe — string-only, sin mezclar local/UTC.
function getMonday(dateStr: string): string {
  return getMondayOfIsoDate(dateStr)
}

function getPrevDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const epoch = Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000
  return new Date(epoch).toISOString().slice(0, 10)
}

export async function validateSedeShift(
  input: ValidateSedeShiftInput,
): Promise<SedeShiftValidationResponse> {
  await requireAccess({ roles: ['admin', 'admin_area'] })

  const { staffId, shiftDate, startTime, endTime, isOvernight, excludeShiftId, isUpsert } = input
  const shiftType: ShiftType = input.shiftType ?? 'diurno_completo'
  const weekStart = getMonday(shiftDate)
  const weekEnd = getSundayOfWeek(weekStart)
  const prevDay = getPrevDay(shiftDate)
  // Year/month derivados del string para evitar timezone shifts.
  const [yStr, mStr] = shiftDate.split('-')
  const year = Number(yStr)
  const month = Number(mStr)

  const runtimeConfig = await loadValidationRuntimeConfig()

  // Actividades existentes ese día. Cubrimos las 3 fuentes posibles:
  //   1. `sede_shifts`         — turnos sede previos del mismo staff/fecha.
  //   2. `campaign_assignments` + `campaign_days` — banco_sangre / comercial
  //      asignados a una campaña cuyo día coincide con shiftDate.
  //   3. `campaign_vehicles.driver_staff_id` — logística: el conductor está
  //      "ocupado" cualquier día que la campaña abarque (campaign_days). Sin
  //      este check podíamos programar a un conductor en sede el mismo día
  //      que arrancaba su campaña multi-día.
  // Adicionalmente fallback legacy: campañas sin filas en campaign_days
  // (datos viejos) usan `campaigns.campaignDate` y `campaigns.startTime/endTime`.
  const [
    existingShifts,
    sameDayCampaignDays,
    sameDayLegacyCampaigns,
    sameDayDriverDays,
    sameDayLegacyDriver,
    prevDayShifts,
    weeklyRow,
    monthlyRow,
    availabilityRow,
    weekSedeShifts,
  ] = await Promise.all([
      db
        .select({
          id: sedeShifts.id,
          startTime: sedeShifts.startTime,
          endTime: sedeShifts.endTime,
        })
        .from(sedeShifts)
        .where(and(eq(sedeShifts.staffId, staffId), eq(sedeShifts.shiftDate, shiftDate))),
      db
        .select({
          startTime: campaignDays.startTime,
          endTime: campaignDays.endTime,
        })
        .from(campaignAssignments)
        .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
        .leftJoin(campaignDays, eq(campaignDays.campaignId, campaigns.id))
        .where(
          and(
            eq(campaignAssignments.staffId, staffId),
            eq(campaignAssignments.isActive, true),
            eq(campaignDays.dayDate, shiftDate),
          ),
        ),
      db
        .select({
          startTime: campaigns.startTime,
          endTime: campaigns.endTime,
        })
        .from(campaignAssignments)
        .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
        .where(
          and(
            eq(campaignAssignments.staffId, staffId),
            eq(campaignAssignments.isActive, true),
            eq(campaigns.campaignDate, shiftDate),
          ),
        ),
      // (3) Conductor de campaña multi-día: ocupa cada día en campaign_days.
      db
        .select({
          startTime: campaignDays.startTime,
          endTime: campaignDays.endTime,
        })
        .from(campaignVehicles)
        .innerJoin(campaigns, eq(campaignVehicles.campaignId, campaigns.id))
        .innerJoin(campaignDays, eq(campaignDays.campaignId, campaigns.id))
        .where(
          and(
            eq(campaignVehicles.driverStaffId, staffId),
            eq(campaignVehicles.isActive, true),
            eq(campaignDays.dayDate, shiftDate),
          ),
        ),
      // Fallback legacy: campañas sin filas en campaign_days donde la
      // campaign_date sea el shiftDate (modo mono-día implícito).
      db
        .select({
          startTime: campaigns.startTime,
          endTime: campaigns.endTime,
        })
        .from(campaignVehicles)
        .innerJoin(campaigns, eq(campaignVehicles.campaignId, campaigns.id))
        .where(
          and(
            eq(campaignVehicles.driverStaffId, staffId),
            eq(campaignVehicles.isActive, true),
            eq(campaigns.campaignDate, shiftDate),
          ),
        ),
      db
        .select({ endTime: sedeShifts.endTime })
        .from(sedeShifts)
        .where(and(eq(sedeShifts.staffId, staffId), eq(sedeShifts.shiftDate, prevDay))),
      db
        .select({ extraHours: weeklyBalance.extraHours })
        .from(weeklyBalance)
        .where(and(eq(weeklyBalance.staffId, staffId), eq(weeklyBalance.weekStart, weekStart)))
        .limit(1),
      db
        .select({
          sundayCount: monthlyCounters.sundayCount,
          overnightCount: monthlyCounters.overnightCount,
        })
        .from(monthlyCounters)
        .where(
          and(
            eq(monthlyCounters.staffId, staffId),
            eq(monthlyCounters.year, year),
            eq(monthlyCounters.month, month),
          ),
        )
        .limit(1),
      db
        .select({ status: staffAvailability.status })
        .from(staffAvailability)
        .where(
          and(
            eq(staffAvailability.staffId, staffId),
            eq(staffAvailability.availabilityDate, shiftDate),
          ),
        )
        .limit(1),
      // Sede shifts del staff en TODA la semana (lun-dom). Lo usamos para
      // pronosticar las horas semanales tras el upsert sin depender de
      // weekly_balance — útil cuando el recalc todavía no corrió o cuando se
      // están programando varios turnos en la misma sesión.
      db
        .select({
          shiftDate: sedeShifts.shiftDate,
          totalHours: sedeShifts.totalHours,
        })
        .from(sedeShifts)
        .where(
          and(
            eq(sedeShifts.staffId, staffId),
            gte(sedeShifts.shiftDate, weekStart),
            lte(sedeShifts.shiftDate, weekEnd),
          ),
        ),
    ])

  const existingActivities: ExistingActivity[] = [
    ...existingShifts
      // En modo upsert (bulk del modal de turnos del día), TODO turno previo de
      // este staff/fecha será reemplazado por el INSERT con onConflictDoUpdate.
      // Por eso lo excluimos del overlap: si no lo hacemos, validar el guardado
      // de un turno ya existente bloquea con "se superpone consigo mismo".
      .filter((s) => (isUpsert ? false : !excludeShiftId || s.id !== excludeShiftId))
      .map((s) => ({ date: shiftDate, startTime: s.startTime, endTime: s.endTime })),
    ...sameDayCampaignDays
      .filter((c) => c.startTime && c.endTime)
      .map((c) => ({ date: shiftDate, startTime: c.startTime!, endTime: c.endTime! })),
    ...sameDayLegacyCampaigns
      .filter((c) => c.startTime && c.endTime)
      .map((c) => ({ date: shiftDate, startTime: c.startTime!, endTime: c.endTime! })),
    ...sameDayDriverDays
      .filter((c) => c.startTime && c.endTime)
      .map((c) => ({ date: shiftDate, startTime: c.startTime!, endTime: c.endTime! })),
    ...sameDayLegacyDriver
      .filter((c) => c.startTime && c.endTime)
      .map((c) => ({ date: shiftDate, startTime: c.startTime!, endTime: c.endTime! })),
  ]

  const prevDayEnd =
    prevDayShifts.length > 0
      ? prevDayShifts.reduce((latest, s) => (s.endTime > latest ? s.endTime : latest), prevDayShifts[0].endTime)
      : null

  const day: CampaignDayContext = {
    dayDate: shiftDate,
    startTime,
    endTime,
    isOvernight,
  }

  const { results } = runAllValidations(
    {
      staffId,
      campaignDays: [day],
      // Legacy back-compat fields
      campaignDate: shiftDate,
      campaignStartTime: startTime,
      campaignEndTime: endTime,
      campaignMunicipality: runtimeConfig.sedeMunicipality,
      campaignTrainingAreaId: null,
      staffTrainingAreaIds: [],
      staffAvailabilityStatus: availabilityRow[0]?.status ?? null,
      existingActivities,
      weeklyExtraHours: weeklyRow[0]?.extraHours ?? 0,
      monthlyCounters: monthlyRow[0] ?? { sundayCount: 0, overnightCount: 0 },
      previousDayLastEndTime: prevDayEnd,
    },
    runtimeConfig,
  )

  // ---- Pronóstico semanal en vivo ----
  // Computamos cuánto trabajaría el staff esta semana si guardamos este turno,
  // a partir de los sede_shifts ya existentes (descontando el upsert del
  // mismo día) + las horas EFECTIVAS del turno propuesto. Esto NO depende de
  // weekly_balance, así que advierte aun cuando el recalc no ha corrido o se
  // están programando varios turnos en la misma sesión.
  const newShiftHours = effectiveShiftHours(startTime, endTime, isOvernight, shiftType)
  const weekTotalBefore = weekSedeShifts
    .filter((s) => {
      // Excluimos el shift que se reemplaza vía upsert para no contar dos veces.
      if (s.shiftDate !== shiftDate) return true
      return false
    })
    .reduce((sum, s) => sum + s.totalHours, 0)
  const projectedWeekTotal = weekTotalBefore + newShiftHours
  const contractWeekly = runtimeConfig.weeklyHours
  const maxExtras = runtimeConfig.maxExtraHoursWeek
  const projectedExtras = Math.max(0, projectedWeekTotal - contractWeekly)

  const liveResults: ValidationResult[] = []
  if (projectedExtras > maxExtras) {
    liveResults.push({
      code: 'EXCESO_HORAS_EXTRAS',
      severity: 'block',
      message:
        `Este turno llevaría las horas extras de la semana a ${projectedExtras.toFixed(1)}h ` +
        `(${weekTotalBefore.toFixed(1)}h previos + ${newShiftHours}h del turno = ${projectedWeekTotal.toFixed(1)}h). ` +
        `Máx. permitido: ${contractWeekly}h contrato + ${maxExtras}h extras.`,
    })
  } else if (projectedWeekTotal > contractWeekly) {
    liveResults.push({
      code: 'EXCESO_HORAS_EXTRAS',
      severity: 'warn',
      message:
        `Este turno llevaría a ${projectedWeekTotal.toFixed(1)}h en la semana, ` +
        `${projectedExtras.toFixed(1)}h por encima del contrato (${contractWeekly}h). ` +
        `Quedan ${(maxExtras - projectedExtras).toFixed(1)}h de extras disponibles antes del bloqueo.`,
    })
  }

  // Fusionamos los resultados del engine con los live. El engine puede haber
  // emitido un EXCESO_HORAS_EXTRAS de severidad menor; nos quedamos con el
  // más severo cuando ambos hablan del mismo código.
  const mergedResults: ValidationResult[] = [
    ...results.filter((r) => !liveResults.some((l) => l.code === r.code && severityRank(l.severity) >= severityRank(r.severity))),
    ...liveResults,
  ]

  const hasBlock = mergedResults.some((r) => r.severity === 'block')
  const hasWarn = mergedResults.some((r) => r.severity === 'warn')

  return { results: mergedResults, hasBlock, hasWarn }
}

function severityRank(s: ValidationResult['severity']): number {
  return s === 'block' ? 2 : s === 'warn' ? 1 : 0
}

export async function validateBulkSedeShifts(input: {
  shiftDate: string
  assignments: Array<{
    staffId: string
    startTime: string
    endTime: string
    isOvernight: boolean
    /** Opcional: tipo de turno para que el pronóstico semanal descuente
     * almuerzo correctamente en `diurno_completo`. Default si no se pasa. */
    shiftType?: ShiftType
  }>
}): Promise<
  Array<{
    staffId: string
    results: ValidationResult[]
    hasBlock: boolean
    hasWarn: boolean
  }>
> {
  await requireAccess({ roles: ['admin', 'admin_area'] })
  if (input.assignments.length === 0) return []

  const results = await Promise.all(
    input.assignments.map(async (a) => {
      const r = await validateSedeShift({
        staffId: a.staffId,
        shiftDate: input.shiftDate,
        startTime: a.startTime,
        endTime: a.endTime,
        isOvernight: a.isOvernight,
        shiftType: a.shiftType,
        // El bulk del modal hace upsert: cualquier turno previo del mismo
        // staff/fecha será reemplazado, así que no debe contar como overlap.
        isUpsert: true,
      })
      return { staffId: a.staffId, ...r }
    }),
  )

  return results
}

