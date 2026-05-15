'use server'

import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm'
import { AppError } from '@/lib/errors/app-errors'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { companies } from '@/lib/db/schema/companies'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { requireAccess } from '@/features/auth/lib/require-access'
import { getWeeklyBalances } from '@/features/hours/actions/hours-actions'
import type { WeeklyBalanceRow } from '@/features/hours/actions/hours-actions'
import { campaignArea } from '@/features/dashboard/lib/dashboard-queries'
import type { Area } from '@/types/areas'

// ---- Types ----------------------------------------------------------------

export interface CampaignReportRow {
  id: string
  code: string
  companyName: string | null
  municipality: string
  campaignDate: string
  size: string
  modality: string
  status: string
  assignedCount: number
  coordinator: string | null
  hexabankCode: string | null
}

export interface PersonalReportRow {
  staffId: string
  firstName: string
  lastName: string
  staffProfile: string
  totalWorkedHours: number
  totalExtraHours: number
  totalSundayCount: number
  totalOvernightCount: number
  totalCampaigns: number
}

// ---- Helpers --------------------------------------------------------------

function getMondaysInRange(dateFrom: string, dateTo: string): string[] {
  const mondays: string[] = []
  const start = new Date(`${dateFrom}T00:00:00`)
  const end = new Date(`${dateTo}T00:00:00`)

  // Move start to the Monday on or before dateFrom
  const startDay = start.getDay()
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay
  const current = new Date(start)
  current.setDate(current.getDate() + mondayOffset)

  while (current <= end) {
    mondays.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 7)
  }

  return mondays
}

// ---- Actions --------------------------------------------------------------

interface CampaignsReportParams {
  dateFrom?: string
  dateTo?: string
  status?: string
  companyId?: string
  area?: Area | null
}

export async function getCampaignsReport(
  params: CampaignsReportParams,
): Promise<CampaignReportRow[]> {
  const { scope } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    allowCrossArea: true,
  })
  // Admin global y comercial (cross-área) respetan params.area; admin_area
  // queda anclado a su scope.area.
  const areaScope: Area | null =
    scope.kind === 'global' ? params.area ?? null : scope.area

  try {
    const conditions: (ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof lte> | ReturnType<typeof sql>)[] = [
      eq(campaigns.isDeleted, false),
    ]

    if (params.dateFrom) {
      conditions.push(gte(campaigns.campaignDate, params.dateFrom))
    }
    if (params.dateTo) {
      conditions.push(lte(campaigns.campaignDate, params.dateTo))
    }
    if (params.status) {
      conditions.push(eq(campaigns.status, params.status as 'tentativa' | 'confirmada' | 'cancelada' | 'ejecutada'))
    }
    if (params.companyId) {
      conditions.push(eq(campaigns.companyId, params.companyId))
    }

    // Filtro por área: reusa el helper compartido `campaignArea` para que el
    // criterio sea idéntico al resto de queries del dashboard / notificaciones.
    if (areaScope) {
      const areaPredicate = campaignArea(areaScope)
      if (areaPredicate) conditions.push(areaPredicate)
    }

    const campaignRows = await db
      .select({
        id: campaigns.id,
        code: campaigns.code,
        companyName: companies.name,
        municipality: campaigns.municipality,
        campaignDate: campaigns.campaignDate,
        size: campaigns.size,
        modality: campaigns.modality,
        status: campaigns.status,
        hexabankCode: campaigns.hexabankCode,
        assignedCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM campaign_assignments
          WHERE campaign_id = ${campaigns.id}
            AND is_active = true
        )`,
      })
      .from(campaigns)
      .leftJoin(companies, eq(campaigns.companyId, companies.id))
      .where(and(...conditions))
      .orderBy(campaigns.campaignDate)

    if (campaignRows.length === 0) {
      return []
    }

    const campaignIds = campaignRows.map((c) => c.id)

    // Fetch coordinators in bulk
    const coordinatorRows = await db
      .select({
        campaignId: campaignAssignments.campaignId,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
      })
      .from(campaignAssignments)
      .leftJoin(staffMembers, eq(campaignAssignments.staffId, staffMembers.id))
      .where(
        and(
          inArray(campaignAssignments.campaignId, campaignIds),
          eq(campaignAssignments.isCoordinator, true),
          eq(campaignAssignments.isActive, true),
        ),
      )

    const coordinatorMap = coordinatorRows.reduce<Record<string, string>>(
      (acc, row) => ({
        ...acc,
        [row.campaignId]: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
      }),
      {},
    )

    return campaignRows.map((row) => ({
      id: row.id,
      code: row.code,
      companyName: row.companyName ?? null,
      municipality: row.municipality,
      campaignDate: row.campaignDate,
      size: row.size,
      modality: row.modality,
      status: row.status,
      assignedCount: row.assignedCount,
      coordinator: coordinatorMap[row.id] ?? null,
      hexabankCode: row.hexabankCode ?? null,
    }))
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener el reporte de campanas')
  }
}

export async function getPersonalReport(params: {
  dateFrom: string
  dateTo: string
  area?: Area | null
}): Promise<PersonalReportRow[]> {
  const { scope } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    allowCrossArea: true,
  })
  // Admin global y comercial (cross-área) eligen libre; banco_sangre queda
  // anclado a su área.
  const areaScope: Area | null =
    scope.kind === 'global' ? params.area ?? null : scope.area

  try {
    const weekStarts = getMondaysInRange(params.dateFrom, params.dateTo)

    const staffWhere = [eq(staffMembers.isActive, true)]
    if (areaScope) staffWhere.push(eq(staffMembers.area, areaScope))

    const activeStaff = await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(and(...staffWhere))

    if (activeStaff.length === 0) {
      return []
    }

    // Fetch weekly balances for the date range
    const balances =
      weekStarts.length > 0
        ? await db
            .select({
              staffId: weeklyBalance.staffId,
              workedHours: weeklyBalance.workedHours,
              extraHours: weeklyBalance.extraHours,
              sundayCount: weeklyBalance.sundayCount,
              overnightCount: weeklyBalance.overnightCount,
            })
            .from(weeklyBalance)
            .where(inArray(weeklyBalance.weekStart, weekStarts))
        : []

    // Fetch campaign assignments in the date range (non-cancelled)
    const campaignCounts = await db
      .select({
        staffId: campaignAssignments.staffId,
        campaignCount: sql<number>`COUNT(*)::int`,
      })
      .from(campaignAssignments)
      .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
      .where(
        and(
          eq(campaignAssignments.isActive, true),
          gte(campaigns.campaignDate, params.dateFrom),
          lte(campaigns.campaignDate, params.dateTo),
          sql`${campaigns.status} != 'cancelada'`,
        ),
      )
      .groupBy(campaignAssignments.staffId)

    // Aggregate balances per staff
    const balanceByStaff = balances.reduce<
      Record<string, { workedHours: number; extraHours: number; sundayCount: number; overnightCount: number }>
    >((acc, b) => {
      const prev = acc[b.staffId] ?? {
        workedHours: 0,
        extraHours: 0,
        sundayCount: 0,
        overnightCount: 0,
      }
      return {
        ...acc,
        [b.staffId]: {
          workedHours: prev.workedHours + b.workedHours,
          extraHours: prev.extraHours + b.extraHours,
          sundayCount: prev.sundayCount + b.sundayCount,
          overnightCount: prev.overnightCount + b.overnightCount,
        },
      }
    }, {})

    const campaignCountMap = campaignCounts.reduce<Record<string, number>>(
      (acc, row) => ({ ...acc, [row.staffId]: row.campaignCount }),
      {},
    )

    return activeStaff.map((staff) => {
      const balance = balanceByStaff[staff.id]
      return {
        staffId: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        staffProfile: staff.staffProfile,
        totalWorkedHours: balance?.workedHours ?? 0,
        totalExtraHours: balance?.extraHours ?? 0,
        totalSundayCount: balance?.sundayCount ?? 0,
        totalOvernightCount: balance?.overnightCount ?? 0,
        totalCampaigns: campaignCountMap[staff.id] ?? 0,
      }
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener el reporte de personal')
  }
}

export async function getHoursReport(
  weekStart: string,
  area?: Area | null,
): Promise<WeeklyBalanceRow[]> {
  // requireAccess se invoca dentro de getWeeklyBalances, que ya respeta el
  // scoping de área.
  try {
    return await getWeeklyBalances(weekStart, area)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener el reporte de horas')
  }
}
