'use server'

import { eq, and, gte, sql, inArray } from 'drizzle-orm'
import { AppError } from '@/lib/errors/app-errors'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireUserContext } from '@/features/auth/lib/user-context'
import { campaignArea } from '@/features/dashboard/lib/dashboard-queries'
import { isCommercialAdmin } from '@/lib/auth/area-gates'
import { getCurrentMondayIso } from '@/lib/date/week'
import type { Area } from '@/types/areas'

export interface AppNotification {
  id: string
  type: 'campaign_cancelled' | 'missing_coordinator' | 'balance_warning'
  title: string
  message: string
  campaignId?: string
  createdAt: Date
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
  const weekStart = getCurrentMondayIso()
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

/**
 * Resuelve qué área usar para filtrar notificaciones. Reglas:
 * - super-admin (role='admin'): ve todo, sin filtro de área.
 * - comercial / admin_area+comercial: cross-área (sin filtro), igual que en dashboards.
 * - admin_area+banco_sangre o +logistica: solo su propia área.
 * - operativo: solo sus propias alertas (vía staffId).
 */
interface NotificationScope {
  campaignAreaFilter: Area | null  // null = sin filtro (admin/comercial)
  staffAreaFilter: Area | null     // null = sin filtro
  ownStaffId: string | null        // si !=null, restringir balance a este staff
}

function resolveScope(ctx: {
  role: string
  area: Area | null
  staffId: string | null
}): NotificationScope {
  if (ctx.role === 'admin') {
    return { campaignAreaFilter: null, staffAreaFilter: null, ownStaffId: null }
  }
  if (isCommercialAdmin(ctx.role, ctx.area)) {
    return { campaignAreaFilter: null, staffAreaFilter: null, ownStaffId: null }
  }
  if (ctx.role === 'admin_area') {
    return {
      campaignAreaFilter: ctx.area,
      staffAreaFilter: ctx.area,
      ownStaffId: null,
    }
  }
  // operativo: solo lo suyo
  return {
    campaignAreaFilter: ctx.area,
    staffAreaFilter: ctx.area,
    ownStaffId: ctx.staffId,
  }
}

export async function getNotifications(): Promise<AppNotification[]> {
  const ctx = await requireUserContext()
  const scope = resolveScope(ctx)

  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // 1) Cancelled campaigns. Para operativo: solo si está asignado.
    const cancelledWhere = [
      eq(campaigns.status, 'cancelada'),
      gte(campaigns.updatedAt, sevenDaysAgo),
      eq(campaigns.isDeleted, false),
    ]
    const areaPred = campaignArea(scope.campaignAreaFilter)
    if (areaPred) cancelledWhere.push(areaPred)
    if (scope.ownStaffId) {
      cancelledWhere.push(
        sql`EXISTS (
          SELECT 1 FROM ${campaignAssignments} ca
          WHERE ca.campaign_id = ${campaigns.id}
            AND ca.staff_id = ${scope.ownStaffId}
            AND ca.is_active = true
        )`,
      )
    }
    const cancelledCampaigns = await db
      .select({
        id: campaigns.id,
        code: campaigns.code,
        cancelReason: campaigns.cancelReason,
        updatedAt: campaigns.updatedAt,
      })
      .from(campaigns)
      .where(and(...cancelledWhere))
      .orderBy(campaigns.updatedAt)

    // 2) Confirmed campaigns without coordinator. Solo aplica a roles que
    //    gestionan asignación (admin, comercial, admin_area de banco_sangre).
    //    Operativos no las ven.
    const confirmedWhere = [
      eq(campaigns.status, 'confirmada'),
      eq(campaigns.isDeleted, false),
    ]
    if (areaPred) confirmedWhere.push(areaPred)

    const confirmedCampaigns =
      ctx.role === 'operativo'
        ? []
        : await db
            .select({
              id: campaigns.id,
              code: campaigns.code,
              createdAt: campaigns.createdAt,
            })
            .from(campaigns)
            .where(and(...confirmedWhere))

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
                inArray(
                  campaignAssignments.campaignId,
                  confirmedCampaigns.map((c) => c.id),
                ),
              ),
            )
            .groupBy(campaignAssignments.campaignId)
        : []

    const coordinatorMap = coordinatorCounts.reduce<Record<string, boolean>>(
      (acc, r) => ({ ...acc, [r.campaignId]: r.hasCoordinator }),
      {},
    )

    // 3) Staff con horas extras >= 10 esta semana (filtrado por área/staffId).
    const weekStart = getCurrentMondayIso()
    const balanceWhere = [
      eq(weeklyBalance.weekStart, weekStart),
      gte(weeklyBalance.extraHours, 10),
    ]
    if (scope.staffAreaFilter) {
      balanceWhere.push(eq(staffMembers.area, scope.staffAreaFilter))
    }
    if (scope.ownStaffId) {
      balanceWhere.push(eq(weeklyBalance.staffId, scope.ownStaffId))
    }
    const highExtraHours = await db
      .select({
        staffId: weeklyBalance.staffId,
        extraHours: weeklyBalance.extraHours,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
      })
      .from(weeklyBalance)
      .innerJoin(staffMembers, eq(weeklyBalance.staffId, staffMembers.id))
      .where(and(...balanceWhere))

    const notifications: AppNotification[] = [
      ...buildCancelledNotifications(cancelledCampaigns),
      ...buildMissingCoordinatorNotifications(confirmedCampaigns, coordinatorMap),
      ...buildBalanceNotifications(highExtraHours),
    ]

    return [...notifications].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener las notificaciones')
  }
}
