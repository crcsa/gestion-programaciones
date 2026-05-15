'use client'

import { Clock, CheckCircle2, Circle } from 'lucide-react'
import {
  TIMELINE_EVENT_LABELS,
  TIMELINE_EVENT_ORDER,
  type TimelineEventType,
} from '@/features/campaigns/lib/timeline-constants'

interface TimelineEventRow {
  eventType: TimelineEventType
  scheduledTime: Date | string | null
  eventTime: Date | string | null
}

interface TimelineReadOnlyViewProps {
  events: TimelineEventRow[]
  /**
   * Ventana base de la campaña (hora de inicio y fin declaradas por comercial).
   * Se muestra siempre como referencia, incluso si el equipo de banco de sangre
   * aún no ha programado los 9 eventos granulares.
   */
  campaignStartTime?: string | null
  campaignEndTime?: string | null
}

function formatHM(value: Date | string | null): string {
  if (value === null || value === undefined) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatPlainHM(value: string | null | undefined): string {
  if (!value) return '—'
  // Recibe "HH:MM" o "HH:MM:SS" desde columnas time; truncar a HH:MM.
  return value.slice(0, 5)
}

/**
 * Vista de la línea de tiempo en modo solo lectura. Usada por comercial y
 * logística (admins de áreas no banco_sangre) para coordinar sin editar.
 *
 * Muestra los 9 eventos en orden, con su hora programada (por banco_sangre)
 * y la hora real registrada por el coordinador de la campaña.
 */
export function TimelineReadOnlyView({
  events,
  campaignStartTime,
  campaignEndTime,
}: TimelineReadOnlyViewProps) {
  const byType = new Map<TimelineEventType, TimelineEventRow>()
  for (const e of events) byType.set(e.eventType, e)

  const programmedCount = TIMELINE_EVENT_ORDER.filter(
    (t) => byType.get(t)?.scheduledTime,
  ).length
  const registeredCount = TIMELINE_EVENT_ORDER.filter(
    (t) => byType.get(t)?.eventTime,
  ).length
  const isUnprogrammed = programmedCount === 0

  return (
    <section className="rounded-lg border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Línea de tiempo</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vista de solo lectura. La programación y la ejecución las hace el
            equipo de banco de sangre.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Programadas: {programmedCount}/{TIMELINE_EVENT_ORDER.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Registradas: {registeredCount}/{TIMELINE_EVENT_ORDER.length}
          </span>
        </div>
      </div>

      {(campaignStartTime || campaignEndTime) && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-medium text-muted-foreground">Ventana declarada:</span>
          <span>
            Inicio campaña{' '}
            <strong className="font-mono">{formatPlainHM(campaignStartTime)}</strong>
          </span>
          <span>
            Fin campaña{' '}
            <strong className="font-mono">{formatPlainHM(campaignEndTime)}</strong>
          </span>
        </div>
      )}

      {isUnprogrammed && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          El equipo de banco de sangre aún no ha programado los 9 eventos de la
          línea de tiempo. Solo verás la ventana general declarada en la campaña.
        </div>
      )}

      <ol className="space-y-2">
        {TIMELINE_EVENT_ORDER.map((eventType, idx) => {
          const row = byType.get(eventType)
          const registered = !!row?.eventTime
          return (
            <li
              key={eventType}
              className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground w-5 text-right">
                {idx + 1}
              </span>
              <span className="shrink-0">
                {registered ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50" />
                )}
              </span>
              <span className="flex-1">{TIMELINE_EVENT_LABELS[eventType]}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  Programada: <strong className="font-mono">{formatHM(row?.scheduledTime ?? null)}</strong>
                </span>
                <span className={registered ? 'text-emerald-300' : 'text-muted-foreground'}>
                  Real: <strong className="font-mono">{formatHM(row?.eventTime ?? null)}</strong>
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
