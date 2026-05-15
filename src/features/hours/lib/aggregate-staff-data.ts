/**
 * Pipeline central de agregación reactiva.
 *
 * `recalcStaffAggregates(staffId, refDate)` recalcula `weekly_balance` y
 * `monthly_counters` para un colaborador en la semana y mes que contienen
 * `refDate`. Es la única puerta de entrada que deben usar los Server Actions
 * cuando programan, modifican o eliminan trabajo de un colaborador.
 *
 * Pure DB calculations — no 'use server', no auth checks.
 */
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaignVehicles } from '@/lib/db/schema/campaign-vehicles'
import { campaigns, campaignDays } from '@/lib/db/schema/campaigns'
import { monthlyCounters } from '@/lib/db/schema/monthly-counters'
import { computeAndSaveWeeklyBalance } from './balance-calculator'
import { getMondayOfIsoDate } from '@/lib/date/week'

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const DEFAULT_CAMPAIGN_DAY_HOURS = 8

interface CampaignDayPoint {
  dayDate: string
  hours: number
  isOvernight: boolean
}

function toDateString(value: Date | string): string {
  if (typeof value === 'string') return value
  // Tomamos componentes UTC para mantener el `YYYY-MM-DD` estable entre Vercel
  // (UTC) y desarrollo local (Colombia UTC-5). `value.toISOString()` también
  // sería UTC, pero por claridad lo hacemos explícito.
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, '0')
  const d = String(value.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function calcCampaignHours(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return DEFAULT_CAMPAIGN_DAY_HOURS
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let mins = eh * MINUTES_PER_HOUR + em - (sh * MINUTES_PER_HOUR + sm)
  if (mins < 0) mins += HOURS_PER_DAY * MINUTES_PER_HOUR
  return mins / MINUTES_PER_HOUR
}

/**
 * Expande las asignaciones activas del staff en un array de puntos por día,
 * considerando los `campaign_days` cuando existen y cayendo en
 * `campaigns.campaignDate` cuando no.
 *
 * Incluye:
 * - `campaign_assignments` (banco_sangre — bacteriologos, técnicos, etc.).
 * - `campaign_vehicles.driver_staff_id` (logística — conductor del vehículo).
 *
 * Filtra por status `!= cancelada`.
 */
export async function getStaffCampaignDayPoints(
  staffId: string,
): Promise<CampaignDayPoint[]> {
  // 1) Campañas donde el staff aparece como asignación regular.
  const assignmentRows = await db
    .select({
      campaignId: campaigns.id,
      campaignDate: campaigns.campaignDate,
      endDate: campaigns.endDate,
      startTime: campaigns.startTime,
      endTime: campaigns.endTime,
      status: campaigns.status,
    })
    .from(campaignAssignments)
    .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
    .where(
      and(eq(campaignAssignments.staffId, staffId), eq(campaignAssignments.isActive, true)),
    )

  // 2) Campañas donde el staff aparece como conductor (logística).
  const driverRows = await db
    .select({
      campaignId: campaigns.id,
      campaignDate: campaigns.campaignDate,
      endDate: campaigns.endDate,
      startTime: campaigns.startTime,
      endTime: campaigns.endTime,
      status: campaigns.status,
    })
    .from(campaignVehicles)
    .leftJoin(campaigns, eq(campaignVehicles.campaignId, campaigns.id))
    .where(
      and(
        eq(campaignVehicles.driverStaffId, staffId),
        eq(campaignVehicles.isActive, true),
      ),
    )

  // Deduplicamos por campaignId: si el conductor también está en
  // campaign_assignments (caso poco probable pero seguro), contamos una sola vez.
  const byCampaignId = new Map<string, (typeof assignmentRows)[number]>()
  for (const row of [...assignmentRows, ...driverRows]) {
    if (row.campaignId && !byCampaignId.has(row.campaignId)) {
      byCampaignId.set(row.campaignId, row)
    }
  }
  const assignments = Array.from(byCampaignId.values())

  const validAssignments = assignments.filter(
    (a) => a.campaignDate !== null && a.status !== 'cancelada',
  )

  if (validAssignments.length === 0) return []

  // Si todos tienen campaignId (caso producción), expandir desde campaign_days.
  // Si no (caso legacy o mock incompleto), fallback a campaignDate + startTime/endTime.
  const campaignIds = validAssignments
    .map((a) => a.campaignId)
    .filter((id): id is string => typeof id === 'string')

  const dayRows = campaignIds.length > 0
    ? await db
        .select()
        .from(campaignDays)
        .where(inArray(campaignDays.campaignId, campaignIds))
    : []

  const byCampaign = new Map<string, typeof dayRows>()
  for (const d of dayRows) {
    const arr = byCampaign.get(d.campaignId) ?? []
    arr.push(d)
    byCampaign.set(d.campaignId, arr)
  }

  const points: CampaignDayPoint[] = []
  for (const a of validAssignments) {
    const days = a.campaignId ? byCampaign.get(a.campaignId) : undefined
    if (days && days.length > 0) {
      for (const d of days) {
        points.push({
          dayDate: d.dayDate,
          hours: calcCampaignHours(d.startTime, d.endTime),
          isOvernight: d.isOvernight,
        })
      }
    } else {
      // Fallback legacy: 1 día con campaignDate + startTime/endTime de la campaña.
      points.push({
        dayDate: a.campaignDate as string,
        hours: calcCampaignHours(a.startTime, a.endTime),
        isOvernight: false,
      })
    }
  }

  return points
}

export async function recalcStaffAggregates(
  staffId: string,
  refDate: Date | string,
): Promise<void> {
  const dateStr = toDateString(refDate)
  const weekStart = getMondayOfIsoDate(dateStr)
  // Año/mes desde el string ISO (date-only) — sin Date() para evitar shifts
  // de zona horaria.
  const [yStr, mStr] = dateStr.split('-')
  const year = Number(yStr)
  const month = Number(mStr)

  await Promise.all([
    computeAndSaveWeeklyBalance(staffId, weekStart),
    computeAndSaveMonthlyCounters(staffId, year, month),
  ])
}

export async function recalcStaffAggregatesBatch(
  staffIds: string[],
  refDate: Date | string,
): Promise<void> {
  const unique = Array.from(new Set(staffIds))
  await Promise.all(unique.map((id) => recalcStaffAggregates(id, refDate)))
}

function logRecalcFailure(
  actionLabel: string,
  staffId: string,
  err: unknown,
  extra: Record<string, unknown> = {},
): void {
  const errorPayload =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { name: 'UnknownError', message: String(err) }
  console.error(
    JSON.stringify({
      errorId: 'RECALC_AGGREGATE_FAIL',
      action: actionLabel,
      staffId,
      timestamp: new Date().toISOString(),
      severity: 'warn',
      reason: 'Aggregate recalculation failed; cron will retry overnight.',
      ...extra,
      error: errorPayload,
    }),
  )
}

/**
 * Recalcula agregados para uno o más staff en una fecha concreta (típicamente
 * un `shift_date` de sede). Encapsula el patrón fire-and-forget con log
 * estructurado para que monitoring detecte inconsistencias.
 */
export async function recalcAggregatesForDate(
  staffIds: string | string[] | Iterable<string>,
  refDate: Date | string,
  actionLabel: string,
): Promise<{ success: number; failed: number }> {
  const idList = Array.from(
    typeof staffIds === 'string' ? [staffIds] : staffIds,
  ).filter((id) => typeof id === 'string' && id.length > 0)
  if (idList.length === 0) return { success: 0, failed: 0 }

  const unique = Array.from(new Set(idList))
  const results = await Promise.allSettled(
    unique.map((id) => recalcStaffAggregates(id, refDate)),
  )

  let success = 0
  let failed = 0
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      success++
    } else {
      failed++
      logRecalcFailure(actionLabel, unique[idx], result.reason, { refDate: toDateString(refDate) })
    }
  })

  return { success, failed }
}

/**
 * Recalcula agregados para uno o más staff afectados por un cambio en la
 * campaña `campaignId`. Encapsula el patrón fire-and-forget que aparecía
 * repetido en 12 sitios (assignment, commercial-assignment, campaign-vehicle,
 * sede-shift, campaign-actions, cron).
 *
 * - Lee `campaign_date` una sola vez (anclaje semanal/mensual).
 * - Lanza `recalcStaffAggregates` en paralelo para cada staffId.
 * - Cada fallo individual se loggea estructurado (errorId
 *   `RECALC_AGGREGATE_FAIL`) pero NO propaga: la mutación principal ya se
 *   commitó; el cron `recalc-aggregates` reintenta cada noche.
 *
 * Devuelve el conteo de éxitos/fallos para que callers (p.ej. el cron
 * finalize-campaigns) puedan reportar 207 si hay errores parciales.
 */
export async function recalcAggregatesForCampaign(
  campaignId: string,
  staffIds: string | string[] | Iterable<string>,
  actionLabel: string,
): Promise<{ success: number; failed: number }> {
  const idList = Array.from(
    typeof staffIds === 'string' ? [staffIds] : staffIds,
  ).filter((id) => typeof id === 'string' && id.length > 0)
  if (idList.length === 0) return { success: 0, failed: 0 }

  const [campaign] = await db
    .select({ campaignDate: campaigns.campaignDate })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1)
  if (!campaign?.campaignDate) return { success: 0, failed: 0 }

  const date = campaign.campaignDate
  const unique = Array.from(new Set(idList))
  const results = await Promise.allSettled(
    unique.map((id) => recalcStaffAggregates(id, date)),
  )

  let success = 0
  let failed = 0
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      success++
    } else {
      failed++
      logRecalcFailure(actionLabel, unique[idx], result.reason, { campaignId })
    }
  })

  return { success, failed }
}

export async function computeAndSaveMonthlyCounters(
  staffId: string,
  year: number,
  month: number,
): Promise<void> {
  const monthStr = String(month).padStart(2, '0')
  const monthStart = `${year}-${monthStr}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`

  const [shifts, points] = await Promise.all([
    db
      .select({
        shiftDate: sedeShifts.shiftDate,
        totalHours: sedeShifts.totalHours,
        isOvernight: sedeShifts.isOvernight,
      })
      .from(sedeShifts)
      .where(
        and(
          eq(sedeShifts.staffId, staffId),
          gte(sedeShifts.shiftDate, monthStart),
          lte(sedeShifts.shiftDate, monthEnd),
        ),
      ),
    getStaffCampaignDayPoints(staffId),
  ])

  const monthPoints = points.filter((p) => p.dayDate >= monthStart && p.dayDate <= monthEnd)

  // Domingos: cualquier día (sede o campaña) que cae en domingo.
  const sundayShifts = shifts.filter(
    (s) => new Date(`${s.shiftDate}T00:00:00`).getDay() === 0,
  ).length
  const sundayCampaignDays = monthPoints.filter(
    (p) => new Date(`${p.dayDate}T00:00:00`).getDay() === 0,
  ).length
  const sundayCount = sundayShifts + sundayCampaignDays

  // Pernoctas: sede.isOvernight + campaign_days.isOvernight.
  const overnightShifts = shifts.filter((s) => s.isOvernight).length
  const overnightCampaignDays = monthPoints.filter((p) => p.isOvernight).length
  const overnightCount = overnightShifts + overnightCampaignDays

  const sedeHours = shifts.reduce((acc, s) => acc + s.totalHours, 0)
  const campaignHoursFloat = monthPoints.reduce((acc, p) => acc + p.hours, 0)
  const totalHours = Math.round(sedeHours + campaignHoursFloat)
  const campaignCount = monthPoints.length

  await db
    .insert(monthlyCounters)
    .values({
      staffId,
      year,
      month,
      totalHours,
      extraHours: 0,
      sundayCount,
      overnightCount,
      campaignCount,
    })
    .onConflictDoUpdate({
      target: [monthlyCounters.staffId, monthlyCounters.year, monthlyCounters.month],
      set: {
        totalHours,
        sundayCount,
        overnightCount,
        campaignCount,
        updatedAt: new Date(),
      },
    })
}
