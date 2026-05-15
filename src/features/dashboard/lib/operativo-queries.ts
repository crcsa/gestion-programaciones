/**
 * Queries por-staff para el dashboard operativo (diferenciado por perfil).
 * Server-only — invocadas desde server components; la auth se resuelve antes
 * en `page.tsx` vía `requireUserContext()`.
 */
import { eq, and, gte, lte, asc, desc } from 'drizzle-orm'
import { format, startOfWeek, addDays, addMonths, startOfMonth } from 'date-fns'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaignVehicles } from '@/lib/db/schema/campaign-vehicles'
import { vehicles } from '@/lib/db/schema/vehicles'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { monthlyCounters } from '@/lib/db/schema/monthly-counters'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { staffAvailability } from '@/lib/db/schema/staff-availability'
import { getCurrentMondayIso, getSundayOfWeek } from '@/lib/date/week'

// ---- Types ----------------------------------------------------------------

export interface WeeklyBreakdownPoint {
  weekLabel: string
  weekStart: string
  sedeHours: number
  campaignHours: number
}

export interface MonthlyProgressionPoint {
  monthLabel: string
  monthKey: string
  totalHours: number
  extraHours: number
  campaignCount: number
  sundayCount: number
  overnightCount: number
}

export interface MyWeekSedeShift {
  id: string
  shiftDate: string
  shiftType: string
  startTime: string
  endTime: string
  totalHours: number
  isOvernight: boolean
}

export interface MyWeekAvailability {
  availabilityDate: string
  status: string
  notes: string | null
}

export interface MyUpcomingCampaign {
  campaignId: string
  assignmentId: string
  code: string
  campaignDate: string
  startTime: string | null
  endTime: string | null
  municipality: string
  status: string
  size: string
  modality: string
  isCoordinator: boolean
}

export interface MyDriverCampaign {
  campaignId: string
  campaignVehicleId: string
  code: string
  campaignDate: string
  startTime: string | null
  endTime: string | null
  municipality: string
  status: string
  plate: string
  mobileNumber: string | null
  model: string | null
}

// ---- Helpers --------------------------------------------------------------

/** "Hoy" según el huso del usuario, no UTC. */
function getTodayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getThirtyDaysFromNow(): string {
  const now = new Date()
  const epoch =
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) +
    30 * 24 * 60 * 60 * 1000
  return new Date(epoch).toISOString().slice(0, 10)
}

// ---- Weekly breakdown (sede vs campaña) -----------------------------------

/**
 * Desglose semanal de horas de sede vs campaña para las últimas `weeks`
 * semanas. Rellena con ceros las semanas sin row en `weekly_balance`.
 */
export async function getMyWeeklyBreakdown(
  staffId: string,
  weeks = 8,
): Promise<WeeklyBreakdownPoint[]> {
  const today = new Date()
  const startWeek = addDays(
    startOfWeek(today, { weekStartsOn: 1 }),
    -(weeks - 1) * 7,
  )
  const startStr = format(startWeek, 'yyyy-MM-dd')

  const rows = await db
    .select({
      weekStart: weeklyBalance.weekStart,
      sedeHours: weeklyBalance.sedeHours,
      campaignHours: weeklyBalance.campaignHours,
    })
    .from(weeklyBalance)
    .where(
      and(
        eq(weeklyBalance.staffId, staffId),
        gte(weeklyBalance.weekStart, startStr),
      ),
    )
    .orderBy(asc(weeklyBalance.weekStart))

  const map = new Map(
    rows.map((r) => [
      r.weekStart,
      { sedeHours: r.sedeHours, campaignHours: r.campaignHours },
    ]),
  )

  return Array.from({ length: weeks }, (_, i) => {
    const d = addDays(startWeek, i * 7)
    const ws = format(d, 'yyyy-MM-dd')
    const entry = map.get(ws)
    return {
      weekLabel: format(d, 'd MMM'),
      weekStart: ws,
      sedeHours: entry?.sedeHours ?? 0,
      campaignHours: entry?.campaignHours ?? 0,
    }
  })
}

// ---- Monthly progression --------------------------------------------------

/**
 * Progresión mensual (horas totales, extras y nº de campañas) para los
 * últimos `months` meses. Rellena con ceros los meses sin row en
 * `monthly_counters`.
 */
export async function getMyMonthlyProgression(
  staffId: string,
  months = 6,
): Promise<MonthlyProgressionPoint[]> {
  const today = new Date()
  const firstMonth = startOfMonth(addMonths(today, -(months - 1)))

  const rows = await db
    .select({
      year: monthlyCounters.year,
      month: monthlyCounters.month,
      totalHours: monthlyCounters.totalHours,
      extraHours: monthlyCounters.extraHours,
      campaignCount: monthlyCounters.campaignCount,
      sundayCount: monthlyCounters.sundayCount,
      overnightCount: monthlyCounters.overnightCount,
    })
    .from(monthlyCounters)
    .where(eq(monthlyCounters.staffId, staffId))

  const map = new Map(
    rows.map((r) => [
      `${r.year}-${String(r.month).padStart(2, '0')}`,
      r,
    ]),
  )

  return Array.from({ length: months }, (_, i) => {
    const d = addMonths(firstMonth, i)
    const key = format(d, 'yyyy-MM')
    const entry = map.get(key)
    return {
      monthLabel: format(d, 'MMM yy'),
      monthKey: key,
      totalHours: entry?.totalHours ?? 0,
      extraHours: entry?.extraHours ?? 0,
      campaignCount: entry?.campaignCount ?? 0,
      sundayCount: entry?.sundayCount ?? 0,
      overnightCount: entry?.overnightCount ?? 0,
    }
  })
}

// ---- Sede shifts (current week) -------------------------------------------

/** Turnos de sede del staff en la semana actual (lunes..domingo). */
export async function getMyWeekSedeShifts(
  staffId: string,
): Promise<MyWeekSedeShift[]> {
  const weekStart = getCurrentMondayIso()
  const weekEnd = getSundayOfWeek(weekStart)

  return db
    .select({
      id: sedeShifts.id,
      shiftDate: sedeShifts.shiftDate,
      shiftType: sedeShifts.shiftType,
      startTime: sedeShifts.startTime,
      endTime: sedeShifts.endTime,
      totalHours: sedeShifts.totalHours,
      isOvernight: sedeShifts.isOvernight,
    })
    .from(sedeShifts)
    .where(
      and(
        eq(sedeShifts.staffId, staffId),
        gte(sedeShifts.shiftDate, weekStart),
        lte(sedeShifts.shiftDate, weekEnd),
      ),
    )
    .orderBy(asc(sedeShifts.shiftDate))
}

/**
 * Overrides de disponibilidad del staff en la semana actual
 * (vacaciones, incapacidad, licencia, disponible).
 */
export async function getMyWeekAvailability(
  staffId: string,
): Promise<MyWeekAvailability[]> {
  const weekStart = getCurrentMondayIso()
  const weekEnd = getSundayOfWeek(weekStart)

  return db
    .select({
      availabilityDate: staffAvailability.availabilityDate,
      status: staffAvailability.status,
      notes: staffAvailability.notes,
    })
    .from(staffAvailability)
    .where(
      and(
        eq(staffAvailability.staffId, staffId),
        gte(staffAvailability.availabilityDate, weekStart),
        lte(staffAvailability.availabilityDate, weekEnd),
      ),
    )
    .orderBy(asc(staffAvailability.availabilityDate))
}

// ---- Upcoming campaigns (banco_sangre / comercial — campaign_assignments) --

/**
 * Próximas campañas (hoy..+30d) de un staff vía `campaign_assignments`.
 * Fuente única reusada por el dashboard operativo y por mi-agenda.
 */
export async function getMyUpcomingCampaigns(
  staffId: string,
): Promise<MyUpcomingCampaign[]> {
  const today = getTodayISO()
  const endDate = getThirtyDaysFromNow()

  const rows = await db
    .select({
      campaignId: campaigns.id,
      assignmentId: campaignAssignments.id,
      code: campaigns.code,
      campaignDate: campaigns.campaignDate,
      startTime: campaigns.startTime,
      endTime: campaigns.endTime,
      municipality: campaigns.municipality,
      status: campaigns.status,
      size: campaigns.size,
      modality: campaigns.modality,
      isCoordinator: campaignAssignments.isCoordinator,
    })
    .from(campaignAssignments)
    .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
    .where(
      and(
        eq(campaignAssignments.staffId, staffId),
        eq(campaignAssignments.isActive, true),
      ),
    )
    .orderBy(asc(campaigns.campaignDate))

  return rows
    .filter(
      (r) =>
        r.campaignId !== null &&
        r.campaignDate !== null &&
        r.campaignDate >= today &&
        r.campaignDate <= endDate,
    )
    .map((r) => ({
      campaignId: r.campaignId!,
      assignmentId: r.assignmentId,
      code: r.code ?? '',
      campaignDate: r.campaignDate ?? '',
      startTime: r.startTime,
      endTime: r.endTime,
      municipality: r.municipality ?? '',
      status: r.status ?? '',
      size: r.size ?? '',
      modality: r.modality ?? '',
      isCoordinator: r.isCoordinator,
    }))
}

// ---- Driver campaigns (logística — campaign_vehicles.driver_staff_id) ------

/**
 * Próximas campañas (hoy..+30d) de un conductor vía
 * `campaign_vehicles.driver_staff_id`. Las asignaciones de conductores NO
 * viven en `campaign_assignments`, así que esta es la única fuente para su
 * dashboard.
 */
export async function getMyDriverCampaigns(
  staffId: string,
): Promise<MyDriverCampaign[]> {
  const today = getTodayISO()
  const endDate = getThirtyDaysFromNow()

  const rows = await db
    .select({
      campaignId: campaigns.id,
      campaignVehicleId: campaignVehicles.id,
      code: campaigns.code,
      campaignDate: campaigns.campaignDate,
      startTime: campaigns.startTime,
      endTime: campaigns.endTime,
      municipality: campaigns.municipality,
      status: campaigns.status,
      plate: vehicles.plate,
      mobileNumber: vehicles.mobileNumber,
      model: vehicles.model,
    })
    .from(campaignVehicles)
    .innerJoin(campaigns, eq(campaignVehicles.campaignId, campaigns.id))
    .innerJoin(vehicles, eq(campaignVehicles.vehicleId, vehicles.id))
    .where(
      and(
        eq(campaignVehicles.driverStaffId, staffId),
        eq(campaignVehicles.isActive, true),
        eq(campaigns.isDeleted, false),
        gte(campaigns.campaignDate, today),
        lte(campaigns.campaignDate, endDate),
      ),
    )
    .orderBy(asc(campaigns.campaignDate))

  return rows.map((r) => ({
    campaignId: r.campaignId,
    campaignVehicleId: r.campaignVehicleId,
    code: r.code,
    campaignDate: r.campaignDate,
    startTime: r.startTime,
    endTime: r.endTime,
    municipality: r.municipality,
    status: r.status,
    plate: r.plate,
    mobileNumber: r.mobileNumber,
    model: r.model,
  }))
}

/**
 * Vehículo asignado al conductor más recientemente (activo). Para el KPI
 * "mi vehículo" del dashboard del conductor.
 */
export async function getMyLatestVehicle(staffId: string): Promise<{
  plate: string
  mobileNumber: string | null
  model: string | null
} | null> {
  const [row] = await db
    .select({
      plate: vehicles.plate,
      mobileNumber: vehicles.mobileNumber,
      model: vehicles.model,
    })
    .from(campaignVehicles)
    .innerJoin(vehicles, eq(campaignVehicles.vehicleId, vehicles.id))
    .where(
      and(
        eq(campaignVehicles.driverStaffId, staffId),
        eq(campaignVehicles.isActive, true),
      ),
    )
    .orderBy(desc(campaignVehicles.assignedAt))
    .limit(1)

  return row ?? null
}
