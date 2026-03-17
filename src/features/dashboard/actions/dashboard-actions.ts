'use server'

import { eq, and, count, gte, lte } from 'drizzle-orm'
import { format, startOfWeek, addDays } from 'date-fns'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { companies } from '@/lib/db/schema/companies'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { requireRole } from '@/features/auth/lib/require-role'

// ---- Types ----------------------------------------------------------------

export interface UpcomingCampaign {
  id: string
  code: string
  municipality: string
  campaignDate: string
  size: string
  status: string
  companyName: string | null
}

export interface AdminDashboardData {
  activeStaffCount: number
  campaignsThisWeek: number
  upcomingCampaigns: UpcomingCampaign[]
  sedeToday: number
}

export interface ComercialDashboardData {
  pendingTentativeCampaigns: UpcomingCampaign[]
  upcomingConfirmedCampaigns: UpcomingCampaign[]
}

export interface OperativoDashboardData {
  myWeeklyShifts: {
    id: string
    shiftDate: string
    shiftType: string
    startTime: string
    endTime: string
    totalHours: number
  }[]
  myCampaignAssignments: {
    id: string
    campaignId: string
    campaignDate: string
    municipality: string
    code: string
    isCoordinator: boolean
  }[]
  weeklyHoursSum: number
  staffMemberId: string
}

// ---- Helpers ----------------------------------------------------------------

function getWeekRange(today: Date): { weekStart: string; weekEnd: string } {
  const start = startOfWeek(today, { weekStartsOn: 1 })
  return {
    weekStart: format(start, 'yyyy-MM-dd'),
    weekEnd: format(addDays(start, 6), 'yyyy-MM-dd'),
  }
}

// ---- Actions ----------------------------------------------------------------

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  await requireRole(['admin', 'banco_sangre'])

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const { weekStart, weekEnd } = getWeekRange(today)

  try {
    const [staffResult, weekResult, upcomingResult, sedeTodayResult] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(staffMembers)
          .where(eq(staffMembers.isActive, true)),

        db
          .select({ value: count() })
          .from(campaigns)
          .where(
            and(
              eq(campaigns.isDeleted, false),
              gte(campaigns.campaignDate, weekStart),
              lte(campaigns.campaignDate, weekEnd),
            ),
          ),

        db
          .select({
            id: campaigns.id,
            code: campaigns.code,
            municipality: campaigns.municipality,
            campaignDate: campaigns.campaignDate,
            size: campaigns.size,
            status: campaigns.status,
            companyName: companies.name,
          })
          .from(campaigns)
          .leftJoin(companies, eq(campaigns.companyId, companies.id))
          .where(
            and(
              eq(campaigns.isDeleted, false),
              eq(campaigns.status, 'confirmada'),
              gte(campaigns.campaignDate, todayStr),
            ),
          )
          .orderBy(campaigns.campaignDate)
          .limit(5),

        db
          .select({ value: count() })
          .from(sedeShifts)
          .where(eq(sedeShifts.shiftDate, todayStr)),
      ])

    return {
      activeStaffCount: staffResult[0]?.value ?? 0,
      campaignsThisWeek: weekResult[0]?.value ?? 0,
      upcomingCampaigns: upcomingResult,
      sedeToday: sedeTodayResult[0]?.value ?? 0,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener estadísticas del dashboard')
  }
}

export async function getComercialDashboardData(): Promise<ComercialDashboardData> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  try {
    const [tentativaResult, confirmadaResult] = await Promise.all([
      db
        .select({
          id: campaigns.id,
          code: campaigns.code,
          municipality: campaigns.municipality,
          campaignDate: campaigns.campaignDate,
          size: campaigns.size,
          status: campaigns.status,
          companyName: companies.name,
        })
        .from(campaigns)
        .leftJoin(companies, eq(campaigns.companyId, companies.id))
        .where(
          and(
            eq(campaigns.isDeleted, false),
            eq(campaigns.status, 'tentativa'),
          ),
        )
        .orderBy(campaigns.campaignDate)
        .limit(10),

      db
        .select({
          id: campaigns.id,
          code: campaigns.code,
          municipality: campaigns.municipality,
          campaignDate: campaigns.campaignDate,
          size: campaigns.size,
          status: campaigns.status,
          companyName: companies.name,
        })
        .from(campaigns)
        .leftJoin(companies, eq(campaigns.companyId, companies.id))
        .where(
          and(
            eq(campaigns.isDeleted, false),
            eq(campaigns.status, 'confirmada'),
            gte(campaigns.campaignDate, todayStr),
          ),
        )
        .orderBy(campaigns.campaignDate)
        .limit(10),
    ])

    return {
      pendingTentativeCampaigns: tentativaResult,
      upcomingConfirmedCampaigns: confirmadaResult,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener campañas del dashboard')
  }
}

export async function getOperativoDashboardData(
  staffMemberId: string,
): Promise<OperativoDashboardData> {
  await requireRole(['admin', 'banco_sangre', 'operativo'])

  const today = new Date()
  const { weekStart, weekEnd } = getWeekRange(today)

  try {
    const [myShifts, myAssignments] = await Promise.all([
      db
        .select({
          id: sedeShifts.id,
          shiftDate: sedeShifts.shiftDate,
          shiftType: sedeShifts.shiftType,
          startTime: sedeShifts.startTime,
          endTime: sedeShifts.endTime,
          totalHours: sedeShifts.totalHours,
        })
        .from(sedeShifts)
        .where(
          and(
            eq(sedeShifts.staffId, staffMemberId),
            gte(sedeShifts.shiftDate, weekStart),
            lte(sedeShifts.shiftDate, weekEnd),
          ),
        )
        .orderBy(sedeShifts.shiftDate),

      db
        .select({
          id: campaignAssignments.id,
          campaignId: campaignAssignments.campaignId,
          isCoordinator: campaignAssignments.isCoordinator,
          campaignDate: campaigns.campaignDate,
          municipality: campaigns.municipality,
          code: campaigns.code,
        })
        .from(campaignAssignments)
        .innerJoin(
          campaigns,
          eq(campaignAssignments.campaignId, campaigns.id),
        )
        .where(
          and(
            eq(campaignAssignments.staffId, staffMemberId),
            eq(campaignAssignments.isActive, true),
            gte(campaigns.campaignDate, weekStart),
            lte(campaigns.campaignDate, weekEnd),
          ),
        )
        .orderBy(campaigns.campaignDate),
    ])

    const weeklyHoursSum = myShifts.reduce((acc, s) => acc + s.totalHours, 0)

    return {
      myWeeklyShifts: myShifts,
      myCampaignAssignments: myAssignments,
      weeklyHoursSum,
      staffMemberId,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener datos del operativo')
  }
}
