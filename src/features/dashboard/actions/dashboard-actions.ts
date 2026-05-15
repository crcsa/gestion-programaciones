'use server'

import { eq, and, count, gte, lte } from 'drizzle-orm'
import { AppError } from '@/lib/errors/app-errors'
import { format, startOfWeek, addDays } from 'date-fns'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { companies } from '@/lib/db/schema/companies'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { requireAccess } from '@/features/auth/lib/require-access'

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
  await requireAccess({ roles: ['admin', 'admin_area'] })

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
    if (error instanceof AppError) throw error
    console.error('[getAdminDashboardData] underlying error:', error)
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Error al obtener estadísticas del dashboard: ${detail}`)
  }
}

export async function getComercialDashboardData(): Promise<ComercialDashboardData> {
  await requireAccess({ roles: ['admin', 'admin_area', 'comercial'] })

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
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener campañas del dashboard')
  }
}

