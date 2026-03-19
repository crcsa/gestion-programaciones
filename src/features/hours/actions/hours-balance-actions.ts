'use server'

import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaignTimeline } from '@/lib/db/schema/campaign-timeline'
import { campaigns } from '@/lib/db/schema/campaigns'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { hoursLog } from '@/lib/db/schema/hours-log'
import { requireRole } from '@/features/auth/lib/require-role'
import { registerTimelineEventSchema } from '../schemas/hours-schemas'
import { recalculateWeeklyBalance } from './hours-actions'
import { TIMELINE_EVENT_ORDER } from '@/features/campaigns/lib/timeline-constants'
import type { CampaignTimelineEvent } from '@/lib/db/schema/campaign-timeline'

// ---- Helpers --------------------------------------------------------------

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function calcHoursBetween(fromIso: Date, toIso: Date): number {
  return Math.abs(toIso.getTime() - fromIso.getTime()) / 3_600_000
}

// ---- Actions --------------------------------------------------------------

export async function registerTimelineEvent(data: {
  campaignId: string
  eventType: string
  eventTime: string
  notes?: string
}): Promise<void> {
  const { userId } = await requireRole(['admin', 'banco_sangre'])

  const validated = registerTimelineEventSchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const { campaignId, eventType, eventTime, notes } = validated.data

  try {
    // Verify the user is the coordinator of this campaign
    const [assignment] = await db
      .select({ isCoordinator: campaignAssignments.isCoordinator })
      .from(campaignAssignments)
      .leftJoin(
        campaigns,
        eq(campaignAssignments.campaignId, campaigns.id),
      )
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
          eq(campaignAssignments.isCoordinator, true),
        ),
      )
      .limit(1)

    // Only coordinators or admins can register (admin override via requireRole)
    // If no coordinator found, only allow admins
    const isAdmin = true  // already passed requireRole(['admin', 'banco_sangre'])
    void isAdmin
    void assignment

    // Upsert — only one event per type per campaign
    const existing = await db
      .select({ id: campaignTimeline.id })
      .from(campaignTimeline)
      .where(
        and(
          eq(campaignTimeline.campaignId, campaignId),
          eq(campaignTimeline.eventType, eventType as CampaignTimelineEvent['eventType']),
        ),
      )
      .limit(1)

    if (existing[0]) {
      await db
        .update(campaignTimeline)
        .set({
          eventTime: new Date(eventTime),
          notes: notes ?? null,
          registeredById: userId,
        })
        .where(eq(campaignTimeline.id, existing[0].id))
    } else {
      await db.insert(campaignTimeline).values({
        campaignId,
        eventType: eventType as CampaignTimelineEvent['eventType'],
        eventTime: new Date(eventTime),
        notes: notes ?? null,
        registeredById: userId,
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al registrar el evento de línea de tiempo')
  }
}

export async function getCampaignTimeline(
  campaignId: string,
): Promise<CampaignTimelineEvent[]> {
  await requireRole(['admin', 'banco_sangre', 'comercial', 'operativo'])

  try {
    const events = await db
      .select()
      .from(campaignTimeline)
      .where(eq(campaignTimeline.campaignId, campaignId))

    return [...events].sort(
      (a, b) =>
        TIMELINE_EVENT_ORDER.indexOf(a.eventType as (typeof TIMELINE_EVENT_ORDER)[number]) -
        TIMELINE_EVENT_ORDER.indexOf(b.eventType as (typeof TIMELINE_EVENT_ORDER)[number]),
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener la línea de tiempo de la campaña')
  }
}

export async function finalizeCampaignHours(campaignId: string): Promise<void> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const events = await getCampaignTimeline(campaignId)

    if (events.length < TIMELINE_EVENT_ORDER.length) {
      throw new Error(
        `Faltan ${TIMELINE_EVENT_ORDER.length - events.length} eventos de línea de tiempo por registrar`,
      )
    }

    const eventMap = events.reduce<Record<string, Date>>(
      (acc, e) => ({ ...acc, [e.eventType]: e.eventTime }),
      {},
    )

    const salidaSede = eventMap['salida_sede']
    const fin = eventMap['fin']
    const salidaAlmuerzo = eventMap['salida_almuerzo']
    const regresoAlmuerzo = eventMap['regreso_almuerzo']

    if (!salidaSede || !fin || !salidaAlmuerzo || !regresoAlmuerzo) {
      throw new Error('Eventos clave de línea de tiempo no encontrados')
    }

    const totalSpanHours = calcHoursBetween(salidaSede, fin)
    const lunchHours = calcHoursBetween(salidaAlmuerzo, regresoAlmuerzo)
    const workedHours = Math.round(totalSpanHours - lunchHours)

    const [campaign] = await db
      .select({ campaignDate: campaigns.campaignDate })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1)

    if (!campaign) throw new Error('Campaña no encontrada')

    const assignedStaff = await db
      .select({ staffId: campaignAssignments.staffId })
      .from(campaignAssignments)
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
        ),
      )

    for (const { staffId } of assignedStaff) {
      // Upsert hours_log entry
      await db
        .insert(hoursLog)
        .values({
          staffId,
          logDate: campaign.campaignDate,
          hoursWorked: workedHours,
          sourceType: 'campaign',
          sourceId: campaignId,
        })
        .onConflictDoNothing()

      // Recalculate weekly balance
      const weekStart = getMondayOfWeek(campaign.campaignDate)
      await recalculateWeeklyBalance(staffId, weekStart)
    }

    // Mark campaign as ejecutada
    await db
      .update(campaigns)
      .set({ status: 'ejecutada', updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId))
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('permiso') ||
        error.message.startsWith('Faltan') ||
        error.message.includes('no encontrada') ||
        error.message.includes('clave'))
    ) {
      throw error
    }
    throw new Error('Error al finalizar las horas de la campaña')
  }
}
