'use server'

import { eq, and, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireRole } from '@/features/auth/lib/require-role'

export interface AppNotification {
  id: string
  type: 'campaign_cancelled' | 'missing_coordinator' | 'balance_warning'
  title: string
  message: string
  campaignId?: string
  createdAt: Date
}

function getWeekStartDate(): string {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(today.getFullYear(), today.getMonth(), diff)
  return weekStart.toISOString().slice(0, 10)
}

function buildCancelledNotifications(
  cancelledCampaigns: ReadonlyArray<{
    id: string
    code: string
    cancelReason: string | null
    updatedAt: Date
  }>,
): AppNotification[] {
  return cancelledCampaigns.map((c) => ({
    id: `cancelled-${c.id}`,
    type: 'campaign_cancelled' as const,
    title: 'Campana cancelada',
    message: `Campana ${c.code} fue cancelada${c.cancelReason ? `: ${c.cancelReason.slice(0, 60)}` : ''}`,
    campaignId: c.id,
    createdAt: c.updatedAt,
  }))
}

function buildMissingCoordinatorNotifications(
  confirmedCampaigns: ReadonlyArray<{ id: string; code: string; createdAt: Date }>,
  coordinatorMap: Record<string, boolean>,
): AppNotification[] {
  return confirmedCampaigns
    .filter((c) => !coordinatorMap[c.id])
    .map((c) => ({
      id: `no-coord-${c.id}`,
      type: 'missing_coordinator' as const,
      title: 'Sin coordinador',
      message: `Campana ${c.code} confirmada no tiene coordinador designado`,
      campaignId: c.id,
      createdAt: c.createdAt,
    }))
}

function buildBalanceNotifications(
  highExtraHours: ReadonlyArray<{
    staffId: string
    extraHours: number
    firstName: string | null
    lastName: string | null
  }>,
): AppNotification[] {
  const weekStart = getWeekStartDate()
  return highExtraHours
    .filter((s) => s.firstName && s.lastName)
    .map((s) => ({
      id: `balance-${s.staffId}-${weekStart}`,
      type: 'balance_warning' as const,
      title: 'Alerta de horas extras',
      message: `${s.firstName} ${s.lastName} tiene ${s.extraHours}h extras esta semana`,
      createdAt: new Date(),
    }))
}

export async function getNotifications(): Promise<AppNotification[]> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // 1. Campaigns cancelled in last 7 days
    const cancelledCampaigns = await db
      .select({
        id: campaigns.id,
        code: campaigns.code,
        cancelReason: campaigns.cancelReason,
        updatedAt: campaigns.updatedAt,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, 'cancelada'),
          gte(campaigns.updatedAt, sevenDaysAgo),
          eq(campaigns.isDeleted, false),
        ),
      )
      .orderBy(campaigns.updatedAt)

    // 2. Confirmed campaigns without a coordinator
    const confirmedCampaigns = await db
      .select({ id: campaigns.id, code: campaigns.code, createdAt: campaigns.createdAt })
      .from(campaigns)
      .where(and(eq(campaigns.status, 'confirmada'), eq(campaigns.isDeleted, false)))

    const coordinatorCounts =
      confirmedCampaigns.length > 0
        ? await db
            .select({
              campaignId: campaignAssignments.campaignId,
              hasCoordinator: sql<boolean>`bool_or(${campaignAssignments.isCoordinator})`,
            })
            .from(campaignAssignments)
            .where(
              and(
                eq(campaignAssignments.isActive, true),
                sql`${campaignAssignments.campaignId} = ANY(${sql.raw(
                  `ARRAY[${confirmedCampaigns.map((c) => `'${c.id}'`).join(',')}]::uuid[]`,
                )})`,
              ),
            )
            .groupBy(campaignAssignments.campaignId)
        : []

    const coordinatorMap = coordinatorCounts.reduce<Record<string, boolean>>(
      (acc, r) => ({ ...acc, [r.campaignId]: r.hasCoordinator }),
      {},
    )

    // 3. Staff with extra hours >= 10 this week
    const weekStart = getWeekStartDate()

    const highExtraHours = await db
      .select({
        staffId: weeklyBalance.staffId,
        extraHours: weeklyBalance.extraHours,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
      })
      .from(weeklyBalance)
      .leftJoin(staffMembers, eq(weeklyBalance.staffId, staffMembers.id))
      .where(
        and(eq(weeklyBalance.weekStart, weekStart), gte(weeklyBalance.extraHours, 10)),
      )

    // Build notification objects
    const notifications: AppNotification[] = [
      ...buildCancelledNotifications(cancelledCampaigns),
      ...buildMissingCoordinatorNotifications(confirmedCampaigns, coordinatorMap),
      ...buildBalanceNotifications(highExtraHours),
    ]

    // Sort by createdAt desc
    return [...notifications].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener las notificaciones')
  }
}
