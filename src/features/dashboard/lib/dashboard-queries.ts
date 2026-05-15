/**
 * Queries agregadas para los dashboards analíticos.
 * Server-only — invocadas desde server components (no expuestas al cliente).
 */
import { eq, and, gte, lte, sql, inArray, type SQL } from 'drizzle-orm'
import { format, startOfWeek, addDays, addMonths, startOfMonth } from 'date-fns'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaignVehicles } from '@/lib/db/schema/campaign-vehicles'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { monthlyCounters } from '@/lib/db/schema/monthly-counters'
import {
  loadValidationRuntimeConfig,
  loadValidationRuntimeConfigAt,
} from '@/features/configuration/lib/runtime-config'
import {
  periodToDateRange,
  type DashboardFilters,
} from './filters'
import { getStaffProfileLabel } from '@/features/staff/lib/constants'
import type { Area } from '@/types/areas'

// ---- Types ----------------------------------------------------------------

export interface CampaignTrendPoint {
  monthLabel: string
  created: number
  ejecutadas: number
  canceladas: number
}

export interface ModalityShare {
  modality: string
  count: number
}

export interface StatusShare {
  status: string
  count: number
}

export interface OvernightSundayCell {
  staffId: string
  fullName: string
  // `profile` viene del enum Drizzle, que aún incluye 'coordinador' legacy
  // (migrado a 'tecnico' por 0025 pero el enum no se puede limpiar in-place).
  // Tipamos como `string` para no exigir cast al lado consumidor.
  profile: string
  profileLabel: string
  sundayCount: number
  overnightCount: number
  riskScore: number
}

export interface PersonalHoursPoint {
  weekLabel: string
  weekStart: string
  workedHours: number
  contractHours: number
}

// ---- Helpers --------------------------------------------------------------

function monthKey(d: Date): string {
  return format(d, 'yyyy-MM')
}

function shortMonthLabel(yyyymm: string): string {
  const [year, month] = yyyymm.split('-').map(Number)
  return format(new Date(year, month - 1, 1), 'MMM yy')
}

/**
 * Predicado SQL para acotar `campaigns` por área. Una campaña pertenece al
 * área X si tiene al menos una asignación activa de staff con `area=X`
 * (`campaign_assignments JOIN staff_members`). Para `logistica` añadimos
 * también campañas con vehículo activo (los conductores son siempre de
 * logística, así que la presencia de vehículo equivale a presencia de área).
 *
 * Para `area=null` (admin global sin filtro) retorna `undefined` y el caller
 * NO añade la cláusula.
 */
export function campaignArea(area: Area | null | undefined): SQL | undefined {
  if (!area) return undefined
  if (area === 'logistica') {
    return sql`(
      EXISTS (
        SELECT 1 FROM ${campaignAssignments} ca
        JOIN ${staffMembers} sm ON ca.staff_id = sm.id
        WHERE ca.campaign_id = ${campaigns.id}
          AND ca.is_active = true
          AND sm.area = ${area}
      )
      OR EXISTS (
        SELECT 1 FROM ${campaignVehicles} cv
        WHERE cv.campaign_id = ${campaigns.id}
          AND cv.is_active = true
      )
    )`
  }
  return sql`EXISTS (
    SELECT 1 FROM ${campaignAssignments} ca
    JOIN ${staffMembers} sm ON ca.staff_id = sm.id
    WHERE ca.campaign_id = ${campaigns.id}
      AND ca.is_active = true
      AND sm.area = ${area}
  )`
}

// ---- Queries --------------------------------------------------------------

export async function getCampaignsTrendByMonth(
  months = 6,
  area: Area | null = null,
): Promise<CampaignTrendPoint[]> {
  const start = startOfMonth(addMonths(new Date(), -(months - 1)))
  const startStr = format(start, 'yyyy-MM-dd')

  const rows = await db
    .select({
      campaignDate: campaigns.campaignDate,
      status: campaigns.status,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.isDeleted, false),
        gte(campaigns.campaignDate, startStr),
        campaignArea(area),
      ),
    )

  const buckets = new Map<string, CampaignTrendPoint>()
  for (let i = 0; i < months; i++) {
    const d = addMonths(start, i)
    const key = monthKey(d)
    buckets.set(key, {
      monthLabel: shortMonthLabel(key),
      created: 0,
      ejecutadas: 0,
      canceladas: 0,
    })
  }

  for (const row of rows) {
    if (!row.campaignDate) continue
    const key = row.campaignDate.slice(0, 7)
    const point = buckets.get(key)
    if (!point) continue
    point.created++
    if (row.status === 'ejecutada') point.ejecutadas++
    if (row.status === 'cancelada') point.canceladas++
  }

  return Array.from(buckets.values())
}

export async function getCampaignsByModality(
  months = 3,
  area: Area | null = null,
): Promise<ModalityShare[]> {
  const start = startOfMonth(addMonths(new Date(), -(months - 1)))
  const startStr = format(start, 'yyyy-MM-dd')

  const rows = await db
    .select({
      modality: campaigns.modality,
      count: sql<number>`count(*)::int`,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.isDeleted, false),
        gte(campaigns.campaignDate, startStr),
        campaignArea(area),
      ),
    )
    .groupBy(campaigns.modality)

  return rows.map((r) => ({ modality: r.modality, count: r.count ?? 0 }))
}

export async function getCampaignsByStatusDistribution(
  area: Area | null = null,
): Promise<StatusShare[]> {
  const rows = await db
    .select({
      status: campaigns.status,
      count: sql<number>`count(*)::int`,
    })
    .from(campaigns)
    .where(and(eq(campaigns.isDeleted, false), campaignArea(area)))
    .groupBy(campaigns.status)

  return rows.map((r) => ({ status: r.status, count: r.count ?? 0 }))
}

export async function getOvernightSundayHeatmap(
  area?: Area | null,
): Promise<OvernightSundayCell[]> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const cfg = await loadValidationRuntimeConfig()

  const where = [eq(staffMembers.isActive, true)]
  if (area) where.push(eq(staffMembers.area, area))

  const rows = await db
    .select({
      staffId: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      profile: staffMembers.staffProfile,
      sundayCount: monthlyCounters.sundayCount,
      overnightCount: monthlyCounters.overnightCount,
    })
    .from(staffMembers)
    .leftJoin(
      monthlyCounters,
      and(
        eq(staffMembers.id, monthlyCounters.staffId),
        eq(monthlyCounters.year, year),
        eq(monthlyCounters.month, month),
      ),
    )
    .where(and(...where))
    .orderBy(staffMembers.lastName)

  return rows.map((r) => {
    const profile = r.profile
    const sundays = r.sundayCount ?? 0
    const overnights = r.overnightCount ?? 0
    const sundayPct = cfg.maxSundaysMonth > 0
      ? Math.min(1, sundays / cfg.maxSundaysMonth)
      : 0
    const overnightPct = cfg.maxOvernightsMonth > 0
      ? Math.min(1, overnights / cfg.maxOvernightsMonth)
      : 0
    const riskScore = Math.round((overnightPct * 0.6 + sundayPct * 0.4) * 100)
    return {
      staffId: r.staffId,
      fullName: `${r.lastName}, ${r.firstName}`,
      profile,
      profileLabel: getStaffProfileLabel(profile),
      sundayCount: sundays,
      overnightCount: overnights,
      riskScore,
    }
  })
}

export async function getMyHoursTrend(staffId: string, weeks = 8): Promise<PersonalHoursPoint[]> {
  const today = new Date()
  const startWeek = addDays(startOfWeek(today, { weekStartsOn: 1 }), -(weeks - 1) * 7)
  const startStr = format(startWeek, 'yyyy-MM-dd')

  const rows = await db
    .select({
      weekStart: weeklyBalance.weekStart,
      workedHours: weeklyBalance.workedHours,
    })
    .from(weeklyBalance)
    .where(
      and(
        eq(weeklyBalance.staffId, staffId),
        gte(weeklyBalance.weekStart, startStr),
      ),
    )
    .orderBy(weeklyBalance.weekStart)

  const map = new Map(rows.map((r) => [r.weekStart, r.workedHours]))

  const weekStartList = Array.from({ length: weeks }, (_, i) => {
    const d = addDays(startWeek, i * 7)
    return { d, ws: format(d, 'yyyy-MM-dd'), label: format(d, 'd MMM') }
  })

  // Each week renders with the rules active at that week's end — historical preservation.
  const cfgs = await Promise.all(
    weekStartList.map(({ ws }) =>
      loadValidationRuntimeConfigAt(format(addDays(new Date(`${ws}T00:00:00`), 6), 'yyyy-MM-dd')),
    ),
  )

  return weekStartList.map(({ ws, label }, i) => ({
    weekLabel: label,
    weekStart: ws,
    workedHours: map.get(ws) ?? 0,
    contractHours: cfgs[i].weeklyHours,
  }))
}

export async function getMonthlyAlerts(
  area?: Area | null,
): Promise<{ overSundays: number; overOvernights: number }> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const cfg = await loadValidationRuntimeConfig()

  // Si hay area, JOIN con staffMembers para filtrar.
  const baseSelect = db
    .select({
      sundayCount: monthlyCounters.sundayCount,
      overnightCount: monthlyCounters.overnightCount,
    })
    .from(monthlyCounters)

  const rows = area
    ? await baseSelect
        .innerJoin(staffMembers, eq(monthlyCounters.staffId, staffMembers.id))
        .where(
          and(
            eq(monthlyCounters.year, year),
            eq(monthlyCounters.month, month),
            eq(staffMembers.area, area),
          ),
        )
    : await baseSelect.where(
        and(eq(monthlyCounters.year, year), eq(monthlyCounters.month, month)),
      )

  return {
    overSundays: rows.filter((r) => r.sundayCount >= cfg.maxSundaysMonth).length,
    overOvernights: rows.filter((r) => r.overnightCount >= cfg.maxOvernightsMonth).length,
  }
}

// ============================================================================
// Queries para el dashboard rediseñado (con filtros globales).
// ============================================================================

export interface StaffBalanceRow {
  staffId: string
  fullName: string
  // `profile` viene del enum Drizzle, que aún incluye 'coordinador' legacy
  // (migrado a 'tecnico' por 0025 pero el enum no se puede limpiar in-place).
  // Tipamos como `string` para no exigir cast al lado consumidor.
  profile: string
  profileLabel: string
  sedeHours: number
  campaignHours: number
  workedHours: number
  contractHours: number
  extraHours: number
}

export interface ProfileHoursRow {
  // `profile` viene del enum Drizzle, que aún incluye 'coordinador' legacy
  // (migrado a 'tecnico' por 0025 pero el enum no se puede limpiar in-place).
  // Tipamos como `string` para no exigir cast al lado consumidor.
  profile: string
  profileLabel: string
  headcount: number
  avgSedeHours: number
  avgCampaignHours: number
  avgWorkedHours: number
}

export interface RadarRow {
  // `profile` viene del enum Drizzle, que aún incluye 'coordinador' legacy
  // (migrado a 'tecnico' por 0025 pero el enum no se puede limpiar in-place).
  // Tipamos como `string` para no exigir cast al lado consumidor.
  profile: string
  profileLabel: string
  extrasScore: number
  overnightScore: number
  sundayScore: number
  campaignScore: number
  absenteeismScore: number
}

export interface SparklineRow {
  staffId: string
  fullName: string
  // `profile` viene del enum Drizzle, que aún incluye 'coordinador' legacy
  // (migrado a 'tecnico' por 0025 pero el enum no se puede limpiar in-place).
  // Tipamos como `string` para no exigir cast al lado consumidor.
  profile: string
  profileLabel: string
  weeklyValues: number[]
  delta: number
  trend: 'up' | 'down' | 'stable'
  contractHours: number
}

export interface CriticalAlerts {
  overExtras: number
  nearSundayLimit: number
  nearOvernightLimit: number
  campaignsWithoutCoordinator: number
}

// ---- Helpers de filtros ---------------------------------------------------

async function filterStaffIdsByMunicipality(
  municipality: string,
  range: { start: string; end: string },
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ staffId: campaignAssignments.staffId })
    .from(campaignAssignments)
    .innerJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
    .where(
      and(
        eq(campaignAssignments.isActive, true),
        eq(campaigns.isDeleted, false),
        eq(campaigns.municipality, municipality),
        gte(campaigns.campaignDate, range.start),
        lte(campaigns.campaignDate, range.end),
      ),
    )
  return rows.map((r) => r.staffId)
}

// ---- F1 HERO: balance por persona -----------------------------------------

export async function getStaffWeeklyBalance(
  filters: DashboardFilters,
): Promise<StaffBalanceRow[]> {
  const range = periodToDateRange(filters.period)
  const cfg = await loadValidationRuntimeConfig()

  const staffWhere = [eq(staffMembers.isActive, true)]
  if (filters.profile) {
    staffWhere.push(eq(staffMembers.staffProfile, filters.profile))
  }
  if (filters.area) {
    staffWhere.push(eq(staffMembers.area, filters.area))
  }
  if (filters.municipality) {
    const ids = await filterStaffIdsByMunicipality(filters.municipality, range)
    if (ids.length === 0) return []
    staffWhere.push(inArray(staffMembers.id, ids))
  }

  // weekly_balance se agrega en SQL por staff: suma de todas las semanas dentro del rango.
  const rows = await db
    .select({
      staffId: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      profile: staffMembers.staffProfile,
      weeklyHours: staffMembers.weeklyHours,
      sedeHours: sql<number>`COALESCE(SUM(${weeklyBalance.sedeHours}), 0)::int`,
      campaignHours: sql<number>`COALESCE(SUM(${weeklyBalance.campaignHours}), 0)::int`,
      workedHours: sql<number>`COALESCE(SUM(${weeklyBalance.workedHours}), 0)::int`,
      extraHours: sql<number>`COALESCE(SUM(${weeklyBalance.extraHours}), 0)::int`,
    })
    .from(staffMembers)
    .leftJoin(
      weeklyBalance,
      and(
        eq(staffMembers.id, weeklyBalance.staffId),
        gte(weeklyBalance.weekStart, range.start),
        lte(weeklyBalance.weekStart, range.end),
      ),
    )
    .where(and(...staffWhere))
    .groupBy(
      staffMembers.id,
      staffMembers.firstName,
      staffMembers.lastName,
      staffMembers.staffProfile,
      staffMembers.weeklyHours,
    )

  return rows
    .map((r): StaffBalanceRow => {
      const profile = r.profile
      return {
        staffId: r.staffId,
        fullName: `${r.lastName}, ${r.firstName}`,
        profile,
        profileLabel: getStaffProfileLabel(profile),
        sedeHours: r.sedeHours ?? 0,
        campaignHours: r.campaignHours ?? 0,
        workedHours: r.workedHours ?? 0,
        contractHours: r.weeklyHours ?? cfg.weeklyHours,
        extraHours: r.extraHours ?? 0,
      }
    })
    .sort((a, b) => {
      if (b.workedHours !== a.workedHours) return b.workedHours - a.workedHours
      return a.fullName.localeCompare(b.fullName)
    })
}

// ---- F1 V1: horas por perfil ---------------------------------------------

export async function getHoursByProfile(
  filters: DashboardFilters,
): Promise<ProfileHoursRow[]> {
  const range = periodToDateRange(filters.period)

  const staffWhere = [eq(staffMembers.isActive, true)]
  if (filters.profile) {
    staffWhere.push(eq(staffMembers.staffProfile, filters.profile))
  }
  if (filters.area) {
    staffWhere.push(eq(staffMembers.area, filters.area))
  }
  if (filters.municipality) {
    const ids = await filterStaffIdsByMunicipality(filters.municipality, range)
    if (ids.length === 0) return []
    staffWhere.push(inArray(staffMembers.id, ids))
  }

  const rows = await db
    .select({
      profile: staffMembers.staffProfile,
      headcount: sql<number>`COUNT(DISTINCT ${staffMembers.id})::int`,
      totalSede: sql<number>`COALESCE(SUM(${weeklyBalance.sedeHours}), 0)::int`,
      totalCampaign: sql<number>`COALESCE(SUM(${weeklyBalance.campaignHours}), 0)::int`,
      totalWorked: sql<number>`COALESCE(SUM(${weeklyBalance.workedHours}), 0)::int`,
    })
    .from(staffMembers)
    .leftJoin(
      weeklyBalance,
      and(
        eq(staffMembers.id, weeklyBalance.staffId),
        gte(weeklyBalance.weekStart, range.start),
        lte(weeklyBalance.weekStart, range.end),
      ),
    )
    .where(and(...staffWhere))
    .groupBy(staffMembers.staffProfile)

  return rows.map((r) => {
    const profile = r.profile
    const headcount = r.headcount ?? 0
    const safeDivide = (n: number) => (headcount > 0 ? Math.round(n / headcount) : 0)
    return {
      profile,
      profileLabel: getStaffProfileLabel(profile),
      headcount,
      avgSedeHours: safeDivide(r.totalSede ?? 0),
      avgCampaignHours: safeDivide(r.totalCampaign ?? 0),
      avgWorkedHours: safeDivide(r.totalWorked ?? 0),
    }
  })
}

// ---- F1 V3: radar de condiciones por perfil ------------------------------

export async function getConditionsRadarByProfile(
  filters: DashboardFilters,
): Promise<RadarRow[]> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const cfg = await loadValidationRuntimeConfig()
  // Heurística: un colaborador con 8 campañas/mes está al 100% (~2 por semana).
  const CAMPAIGN_REF = 8

  const staffWhere = [eq(staffMembers.isActive, true)]
  if (filters.profile) {
    staffWhere.push(eq(staffMembers.staffProfile, filters.profile))
  }
  if (filters.area) {
    staffWhere.push(eq(staffMembers.area, filters.area))
  }
  if (filters.municipality) {
    const range = periodToDateRange(filters.period)
    const ids = await filterStaffIdsByMunicipality(filters.municipality, range)
    if (ids.length === 0) return []
    staffWhere.push(inArray(staffMembers.id, ids))
  }

  const rows = await db
    .select({
      profile: staffMembers.staffProfile,
      weeklyHours: staffMembers.weeklyHours,
      headcount: sql<number>`COUNT(DISTINCT ${staffMembers.id})::int`,
      avgExtras: sql<number>`COALESCE(AVG(${monthlyCounters.extraHours}), 0)`,
      avgOvernights: sql<number>`COALESCE(AVG(${monthlyCounters.overnightCount}), 0)`,
      avgSundays: sql<number>`COALESCE(AVG(${monthlyCounters.sundayCount}), 0)`,
      avgCampaigns: sql<number>`COALESCE(AVG(${monthlyCounters.campaignCount}), 0)`,
      avgTotalHours: sql<number>`COALESCE(AVG(${monthlyCounters.totalHours}), 0)`,
    })
    .from(staffMembers)
    .leftJoin(
      monthlyCounters,
      and(
        eq(staffMembers.id, monthlyCounters.staffId),
        eq(monthlyCounters.year, year),
        eq(monthlyCounters.month, month),
      ),
    )
    .where(and(...staffWhere))
    .groupBy(staffMembers.staffProfile, staffMembers.weeklyHours)

  // Si un perfil aparece con múltiples weeklyHours diferentes, los colapsamos.
  const byProfile = new Map<string, RadarRow>()
  for (const r of rows) {
    const profile = r.profile
    const expectedMonthHours = (r.weeklyHours ?? cfg.weeklyHours) * 4
    const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

    const extrasScore = cfg.maxExtraHoursWeek > 0
      ? clamp100((Number(r.avgExtras) / (cfg.maxExtraHoursWeek * 4)) * 100)
      : 0
    const overnightScore = cfg.maxOvernightsMonth > 0
      ? clamp100((Number(r.avgOvernights) / cfg.maxOvernightsMonth) * 100)
      : 0
    const sundayScore = cfg.maxSundaysMonth > 0
      ? clamp100((Number(r.avgSundays) / cfg.maxSundaysMonth) * 100)
      : 0
    const campaignScore = clamp100((Number(r.avgCampaigns) / CAMPAIGN_REF) * 100)
    const absenteeismScore = expectedMonthHours > 0
      ? clamp100(((expectedMonthHours - Number(r.avgTotalHours)) / expectedMonthHours) * 100)
      : 0

    byProfile.set(profile, {
      profile,
      profileLabel: getStaffProfileLabel(profile),
      extrasScore,
      overnightScore,
      sundayScore,
      campaignScore,
      absenteeismScore,
    })
  }

  return Array.from(byProfile.values())
}

// ---- F2 V4: sparkline de horas semanales (últimas N semanas) ------------

export async function getHoursSparkline(
  filters: DashboardFilters,
  weeks = 8,
): Promise<SparklineRow[]> {
  const today = new Date()
  const cfg = await loadValidationRuntimeConfig()
  const startWeek = addDays(startOfWeek(today, { weekStartsOn: 1 }), -(weeks - 1) * 7)
  const startStr = format(startWeek, 'yyyy-MM-dd')

  const weekKeys = Array.from({ length: weeks }, (_, i) =>
    format(addDays(startWeek, i * 7), 'yyyy-MM-dd'),
  )

  const staffWhere = [eq(staffMembers.isActive, true)]
  if (filters.profile) {
    staffWhere.push(eq(staffMembers.staffProfile, filters.profile))
  }
  if (filters.area) {
    staffWhere.push(eq(staffMembers.area, filters.area))
  }
  if (filters.municipality) {
    const range = periodToDateRange(filters.period)
    const ids = await filterStaffIdsByMunicipality(filters.municipality, range)
    if (ids.length === 0) return []
    staffWhere.push(inArray(staffMembers.id, ids))
  }

  const rows = await db
    .select({
      staffId: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      profile: staffMembers.staffProfile,
      weeklyHours: staffMembers.weeklyHours,
      weekStart: weeklyBalance.weekStart,
      workedHours: weeklyBalance.workedHours,
    })
    .from(staffMembers)
    .leftJoin(
      weeklyBalance,
      and(
        eq(staffMembers.id, weeklyBalance.staffId),
        gte(weeklyBalance.weekStart, startStr),
      ),
    )
    .where(and(...staffWhere))

  type Acc = {
    staffId: string
    fullName: string
    profile: string
    contractHours: number
    weekMap: Map<string, number>
  }
  const byStaff = new Map<string, Acc>()
  for (const r of rows) {
    const acc = byStaff.get(r.staffId) ?? {
      staffId: r.staffId,
      fullName: `${r.lastName}, ${r.firstName}`,
      profile: r.profile,
      contractHours: r.weeklyHours ?? cfg.weeklyHours,
      weekMap: new Map<string, number>(),
    }
    if (r.weekStart) {
      acc.weekMap.set(r.weekStart, r.workedHours ?? 0)
    }
    byStaff.set(r.staffId, acc)
  }

  return Array.from(byStaff.values())
    .map((acc): SparklineRow => {
      const weeklyValues = weekKeys.map((k) => acc.weekMap.get(k) ?? 0)
      const last = weeklyValues[weeklyValues.length - 1]
      const prev = weeklyValues[weeklyValues.length - 2] ?? 0
      const delta = last - prev
      const trend = computeTrend(weeklyValues)
      return {
        staffId: acc.staffId,
        fullName: acc.fullName,
        profile: acc.profile,
        profileLabel: getStaffProfileLabel(acc.profile),
        weeklyValues,
        delta,
        trend,
        contractHours: acc.contractHours,
      }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

/**
 * Pendiente normalizada de regresión lineal simple sobre N puntos.
 * Si la pendiente excede ±5% del contrato semanal (asumiendo 44h ≈ ±2h/sem),
 * marcamos tendencia; sino, estable.
 */
function computeTrend(values: number[]): 'up' | 'down' | 'stable' {
  const n = values.length
  if (n < 2) return 'stable'
  const xMean = (n - 1) / 2
  const yMean = values.reduce((acc, v) => acc + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean)
    den += (i - xMean) ** 2
  }
  if (den === 0) return 'stable'
  const slope = num / den
  if (slope > 2) return 'up'
  if (slope < -2) return 'down'
  return 'stable'
}

// ---- F0: alertas críticas para alert bar ---------------------------------

export async function getCriticalAlerts(
  filters: DashboardFilters,
): Promise<CriticalAlerts> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const range = periodToDateRange(filters.period)
  const cfg = await loadValidationRuntimeConfig()

  const staffWhere = [eq(staffMembers.isActive, true)]
  if (filters.profile) {
    staffWhere.push(eq(staffMembers.staffProfile, filters.profile))
  }
  if (filters.area) {
    staffWhere.push(eq(staffMembers.area, filters.area))
  }
  let municipalityStaffIds: string[] | null = null
  if (filters.municipality) {
    municipalityStaffIds = await filterStaffIdsByMunicipality(
      filters.municipality,
      range,
    )
    if (municipalityStaffIds.length === 0) {
      return {
        overExtras: 0,
        nearSundayLimit: 0,
        nearOvernightLimit: 0,
        campaignsWithoutCoordinator: 0,
      }
    }
    staffWhere.push(inArray(staffMembers.id, municipalityStaffIds))
  }

  const [extrasRows, monthlyRows, orphanCampaignRows] = await Promise.all([
    db
      .select({
        staffId: staffMembers.id,
        extras: sql<number>`COALESCE(SUM(${weeklyBalance.extraHours}), 0)::int`,
      })
      .from(staffMembers)
      .leftJoin(
        weeklyBalance,
        and(
          eq(staffMembers.id, weeklyBalance.staffId),
          gte(weeklyBalance.weekStart, range.start),
          lte(weeklyBalance.weekStart, range.end),
        ),
      )
      .where(and(...staffWhere))
      .groupBy(staffMembers.id),

    db
      .select({
        staffId: staffMembers.id,
        sundayCount: monthlyCounters.sundayCount,
        overnightCount: monthlyCounters.overnightCount,
      })
      .from(staffMembers)
      .leftJoin(
        monthlyCounters,
        and(
          eq(staffMembers.id, monthlyCounters.staffId),
          eq(monthlyCounters.year, year),
          eq(monthlyCounters.month, month),
        ),
      )
      .where(and(...staffWhere)),

    db
      .select({
        campaignId: campaigns.id,
        coordinatorCount: sql<number>`COUNT(${campaignAssignments.id}) FILTER (WHERE ${campaignAssignments.isCoordinator} = TRUE AND ${campaignAssignments.isActive} = TRUE)::int`,
      })
      .from(campaigns)
      .leftJoin(
        campaignAssignments,
        eq(campaigns.id, campaignAssignments.campaignId),
      )
      .where(
        and(
          eq(campaigns.isDeleted, false),
          gte(campaigns.campaignDate, format(now, 'yyyy-MM-dd')),
          lte(
            campaigns.campaignDate,
            format(addDays(now, 7), 'yyyy-MM-dd'),
          ),
          filters.municipality
            ? eq(campaigns.municipality, filters.municipality)
            : undefined,
        ),
      )
      .groupBy(campaigns.id),
  ])

  const overExtras = extrasRows.filter((r) => (r.extras ?? 0) > 0).length
  const nearSundayLimit = monthlyRows.filter(
    (r) => (r.sundayCount ?? 0) >= Math.max(1, cfg.maxSundaysMonth - 0),
  ).length
  const nearOvernightLimit = monthlyRows.filter(
    (r) => (r.overnightCount ?? 0) >= Math.max(1, cfg.maxOvernightsMonth - 0),
  ).length
  const campaignsWithoutCoordinator = orphanCampaignRows.filter(
    (r) => (r.coordinatorCount ?? 0) === 0,
  ).length

  return {
    overExtras,
    nearSundayLimit,
    nearOvernightLimit,
    campaignsWithoutCoordinator,
  }
}

// ---- Lista de municipios para el filtro toolbar --------------------------

export async function getCampaignMunicipalities(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ municipality: campaigns.municipality })
    .from(campaigns)
    .where(eq(campaigns.isDeleted, false))
    .orderBy(campaigns.municipality)
  return rows.map((r) => r.municipality).filter((m): m is string => Boolean(m))
}

