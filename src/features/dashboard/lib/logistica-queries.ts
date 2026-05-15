/**
 * Queries específicas del dashboard de logística.
 * Server-only.
 */
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { format, addDays } from 'date-fns'
import { db } from '@/lib/db'
import { vehicles } from '@/lib/db/schema/vehicles'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { campaigns } from '@/lib/db/schema/campaigns'
import { campaignVehicles } from '@/lib/db/schema/campaign-vehicles'

export interface LogisticaKpis {
  activeVehicles: number
  activeDrivers: number
  campaignsWithoutVehicleNextWeek: number
  upcomingCampaignsNextWeek: number
}

export async function getLogisticaKpis(): Promise<LogisticaKpis> {
  const today = new Date()
  const start = format(today, 'yyyy-MM-dd')
  const end = format(addDays(today, 7), 'yyyy-MM-dd')

  const [vehicleCount, driverCount, upcomingCampaigns] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicles)
      .where(eq(vehicles.isActive, true)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.isActive, true),
          eq(staffMembers.area, 'logistica'),
          eq(staffMembers.staffProfile, 'conductor'),
        ),
      ),
    db
      .select({
        id: campaigns.id,
        assignedVehicles: sql<number>`
          (SELECT count(*)::int FROM ${campaignVehicles}
           WHERE ${campaignVehicles.campaignId} = ${campaigns.id}
             AND ${campaignVehicles.isActive} = TRUE)
        `,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.isDeleted, false),
          gte(campaigns.campaignDate, start),
          lte(campaigns.campaignDate, end),
          sql`${campaigns.status} IN ('confirmada', 'ejecutada')`,
        ),
      ),
  ])

  const upcoming = upcomingCampaigns.length
  const withoutVehicle = upcomingCampaigns.filter((c) => c.assignedVehicles === 0).length

  return {
    activeVehicles: vehicleCount[0]?.count ?? 0,
    activeDrivers: driverCount[0]?.count ?? 0,
    campaignsWithoutVehicleNextWeek: withoutVehicle,
    upcomingCampaignsNextWeek: upcoming,
  }
}
