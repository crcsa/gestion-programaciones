'use server'

import { revalidatePath } from 'next/cache'
import { NotFoundError, ValidationError, PermissionError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaignTimeline } from '@/lib/db/schema/campaign-timeline'
import { campaigns } from '@/lib/db/schema/campaigns'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { hoursLog } from '@/lib/db/schema/hours-log'
import { requireAccess } from '@/features/auth/lib/require-access'
import { logAudit } from '@/lib/audit/log-audit'
import {
  registerTimelineEventSchema,
  scheduleTimelineEventsBatchSchema,
  registerActualTimeSchema,
} from '../schemas/hours-schemas'
import { recalcAggregatesForCampaign } from '../lib/aggregate-staff-data'
import { TIMELINE_EVENT_ORDER, type TimelineEventType } from '@/features/campaigns/lib/timeline-constants'
import type { CampaignTimelineEvent } from '@/lib/db/schema/campaign-timeline'

// ---- Helpers --------------------------------------------------------------

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
  const { userId } = await requireAccess({ roles: ['admin', 'admin_area'] })

  const validated = registerTimelineEventSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { campaignId, eventType, eventTime, notes } = validated.data

  try {
    // Upsert — only one event per type per campaign.
    // El gate `requireAccess({ roles: ['admin','admin_area'] })` ya garantiza que solo
    // administradores entran aquí. `registerActualTime` aplica una verificación
    // separada de coordinador para operativos.
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
    rethrowOrLog(error, 'registerTimelineEvent', 'Error al registrar el evento de línea de tiempo')
  }
}

/**
 * Bulk-upsert de horas PROGRAMADAS para una campaña. Solo admin / banco_sangre.
 * No toca la columna event_time (hora real); deja intacto lo que el coordinador
 * haya registrado.
 */
export async function scheduleTimelineEventsBatch(data: {
  campaignId: string
  events: { eventType: TimelineEventType; scheduledTime: string }[]
}): Promise<void> {
  const { userId } = await requireAccess({ roles: ['admin', 'admin_area'] })

  const validated = scheduleTimelineEventsBatchSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { campaignId, events } = validated.data

  // Detectar duplicados de eventType dentro del batch.
  const seen = new Set<string>()
  for (const e of events) {
    if (seen.has(e.eventType)) {
      throw new Error(`Evento duplicado en el lote: ${e.eventType}`)
    }
    seen.add(e.eventType)
  }

  try {
    await db.transaction(async (tx) => {
      for (const e of events) {
        const [existing] = await tx
          .select({ id: campaignTimeline.id })
          .from(campaignTimeline)
          .where(
            and(
              eq(campaignTimeline.campaignId, campaignId),
              eq(campaignTimeline.eventType, e.eventType),
            ),
          )
          .limit(1)

        if (existing) {
          await tx
            .update(campaignTimeline)
            .set({ scheduledTime: new Date(e.scheduledTime) })
            .where(eq(campaignTimeline.id, existing.id))
        } else {
          await tx.insert(campaignTimeline).values({
            campaignId,
            eventType: e.eventType,
            scheduledTime: new Date(e.scheduledTime),
            registeredById: userId,
          })
        }
      }
    })

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'campaign_timeline',
      recordId: campaignId,
      newData: { scheduled: events.map((e) => e.eventType) },
    })

    revalidatePath(`/campanas/${campaignId}`)
  } catch (error) {
    rethrowOrLog(error, 'scheduleTimelineEventsBatch', 'Error al programar las horas de la línea de tiempo')
  }
}

/**
 * Registra la hora REAL de un evento. Permitido a:
 *   - admin / banco_sangre (siempre)
 *   - operativo si es el coordinador asignado a ESTA campaña
 */
export async function registerActualTime(data: {
  campaignId: string
  eventType: TimelineEventType
  actualTime: string
}): Promise<void> {
  const { userId, role } = await requireAccess({ roles: ['admin', 'admin_area', 'operativo'] })

  const validated = registerActualTimeSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { campaignId, eventType, actualTime } = validated.data

  if (role === 'operativo') {
    const [coord] = await db
      .select({ staffId: campaignAssignments.staffId })
      .from(campaignAssignments)
      .innerJoin(staffMembers, eq(staffMembers.id, campaignAssignments.staffId))
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
          eq(campaignAssignments.isCoordinator, true),
          eq(staffMembers.profileId, userId),
        ),
      )
      .limit(1)

    if (!coord) {
      throw new PermissionError('No tiene permiso para registrar horas de esta campaña')
    }
  }

  try {
    const [existing] = await db
      .select({ id: campaignTimeline.id })
      .from(campaignTimeline)
      .where(
        and(
          eq(campaignTimeline.campaignId, campaignId),
          eq(campaignTimeline.eventType, eventType),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(campaignTimeline)
        .set({
          eventTime: new Date(actualTime),
          registeredById: userId,
        })
        .where(eq(campaignTimeline.id, existing.id))
    } else {
      await db.insert(campaignTimeline).values({
        campaignId,
        eventType,
        eventTime: new Date(actualTime),
        registeredById: userId,
      })
    }

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'campaign_timeline',
      recordId: campaignId,
      newData: { eventType, actualTime },
    })

    revalidatePath(`/campanas/${campaignId}`)
  } catch (error) {
    rethrowOrLog(error, 'registerActualTime', 'Error al registrar la hora real')
  }
}

export async function getCampaignTimeline(
  campaignId: string,
): Promise<CampaignTimelineEvent[]> {
  await requireAccess({ roles: ['admin', 'admin_area', 'comercial', 'operativo'] })

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
    rethrowOrLog(error, 'getCampaignTimeline', 'Error al obtener la línea de tiempo de la campaña')
  }
}

export async function finalizeCampaignHours(campaignId: string): Promise<void> {
  await requireAccess({ roles: ['admin', 'admin_area'] })

  try {
    const events = await getCampaignTimeline(campaignId)

    // Solo eventos con hora REAL registrada (event_time NOT NULL).
    const registered = events.filter((e) => e.eventTime !== null)
    const missing = TIMELINE_EVENT_ORDER.filter(
      (t) => !registered.some((e) => e.eventType === t),
    )
    if (missing.length > 0) {
      throw new ValidationError(
        `Faltan horas reales de: ${missing.join(', ')}`,
      )
    }

    const eventMap = registered.reduce<Record<string, Date>>(
      (acc, e) => ({ ...acc, [e.eventType]: e.eventTime as Date }),
      {},
    )

    const salidaSede = eventMap['salida_sede']
    const fin = eventMap['fin']
    const salidaAlmuerzo = eventMap['salida_almuerzo']
    const regresoAlmuerzo = eventMap['regreso_almuerzo']

    if (!salidaSede || !fin || !salidaAlmuerzo || !regresoAlmuerzo) {
      throw new NotFoundError('Eventos clave de línea de tiempo no encontrados')
    }

    const totalSpanHours = calcHoursBetween(salidaSede, fin)
    const lunchHours = calcHoursBetween(salidaAlmuerzo, regresoAlmuerzo)
    const workedHours = Math.round(totalSpanHours - lunchHours)

    const [campaign] = await db
      .select({ campaignDate: campaigns.campaignDate })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1)

    if (!campaign) throw new NotFoundError('Campaña no encontrada')

    const assignedStaff = await db
      .select({ staffId: campaignAssignments.staffId })
      .from(campaignAssignments)
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
        ),
      )

    // Transacción: hours_log inserts + cambio de status van juntos. Si algo
    // falla acá, nada se aplica. El recálculo de agregados queda fuera (no es
    // parte de la consistencia del log; un fallo allí se loggea y reintenta
    // vía cron `recalc-aggregates`).
    await db.transaction(async (tx) => {
      for (const { staffId } of assignedStaff) {
        await tx
          .insert(hoursLog)
          .values({
            staffId,
            logDate: campaign.campaignDate,
            hoursWorked: workedHours,
            sourceType: 'campaign',
            sourceId: campaignId,
          })
          .onConflictDoNothing()
      }
      await tx
        .update(campaigns)
        .set({ status: 'ejecutada', updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId))
    })

    // Recalcula balance semanal y contadores mensuales (fuera de la transacción).
    await recalcAggregatesForCampaign(
      campaignId,
      assignedStaff.map((s) => s.staffId),
      'finalizeCampaignHours',
    )
  } catch (error) {
    rethrowOrLog(error, 'finalizeCampaignHours', 'Error al finalizar las horas de la campaña')
  }
}
