'use client'

import { useMemo, useState } from 'react'
import { Calendar, Sparkles, Save, Pencil, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TIMELINE_EVENT_LABELS,
  TIMELINE_EVENT_ORDER,
  type TimelineEventType,
} from '@/features/campaigns/lib/timeline-constants'
import {
  scheduleTimelineEventsBatch,
  getCampaignTimeline,
} from '../actions/hours-balance-actions'
import {
  computeTimelineDefaults,
  getNormalDayHours,
} from '../lib/timeline-defaults'
import { getTimelineScheduleWarnings } from '../lib/timeline-schedule-warnings'
import type { CampaignTimelineEvent } from '@/lib/db/schema/campaign-timeline'

interface TimelineProgrammingFormProps {
  campaignId: string
  campaignDate: string
  startTime: string | null
  endTime: string | null
  existingEvents: CampaignTimelineEvent[]
}

export function TimelineProgrammingForm({
  campaignId,
  campaignDate,
  startTime,
  endTime,
  existingEvents,
}: TimelineProgrammingFormProps) {
  const [events, setEvents] = useState<CampaignTimelineEvent[]>(existingEvents)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<TimelineEventType | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  const defaults = useMemo(() => {
    if (!startTime || !endTime) return null
    try {
      return computeTimelineDefaults({ campaignDate, startTime, endTime })
    } catch {
      return null
    }
  }, [campaignDate, startTime, endTime])

  const normalDay = useMemo(() => getNormalDayHours(campaignDate), [campaignDate])

  const eventByType = useMemo(() => {
    const m = new Map<TimelineEventType, CampaignTimelineEvent>()
    for (const e of events) m.set(e.eventType as TimelineEventType, e)
    return m
  }, [events])

  // Advertencias NO bloqueantes: eventos fuera de la jornada laboral fija
  // (07:00–17:00) o cuyo lapso supera las horas TOTALES planificadas del día
  // de la semana (Lun 8.5h, Mar–Vie 9.5h). `scheduledTime` es un timestamp; lo
  // normalizamos a 'HH:mm' para el comparador puro.
  const scheduleWarnings = useMemo(() => {
    return getTimelineScheduleWarnings({
      plannedHours: normalDay.total,
      events: events.map((e) => ({
        eventType: e.eventType,
        scheduledTime: e.scheduledTime ? toTimeInput(e.scheduledTime) : null,
      })),
    })
  }, [events, normalDay.total])

  // Eventos sin hora programada aún → candidatos a recibir la sugerida.
  const pendingTypes = TIMELINE_EVENT_ORDER.filter(
    (t) => eventByType.get(t)?.scheduledTime == null,
  )
  const noneScheduled = pendingTypes.length === TIMELINE_EVENT_ORDER.length

  async function refresh() {
    const fresh = await getCampaignTimeline(campaignId)
    setEvents(fresh)
  }

  async function applyAllSuggestions() {
    if (!defaults || pendingTypes.length === 0) return
    setBusy('apply-all')
    setError(null)
    try {
      // Solo rellena los eventos sin hora; no pisa los que ya editaste.
      const payload = pendingTypes.map((t) => ({
        eventType: t,
        scheduledTime: defaults[t].toISOString(),
      }))
      await scheduleTimelineEventsBatch({ campaignId, events: payload })
      setInfo(`${payload.length} hora(s) programada(s) guardada(s)`)
      await refresh()
      setTimeout(() => setInfo(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aplicar sugerencias')
    } finally {
      setBusy(null)
    }
  }

  function startEdit(eventType: TimelineEventType) {
    const current = eventByType.get(eventType)?.scheduledTime ?? defaults?.[eventType] ?? null
    setEditing(eventType)
    setEditValue(current ? toTimeInput(current) : '')
  }

  async function saveEdit(eventType: TimelineEventType) {
    if (!editValue) {
      setError('Ingrese una hora válida')
      return
    }
    setBusy(`save-${eventType}`)
    setError(null)
    try {
      const iso = combineDateAndTime(campaignDate, editValue).toISOString()
      await scheduleTimelineEventsBatch({
        campaignId,
        events: [{ eventType, scheduledTime: iso }],
      })
      setEditing(null)
      setEditValue('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la hora programada')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">Programación de la línea de tiempo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estas son las horas planificadas para cada actividad. Las horas reales se registran en la pestaña de ejecución.
          </p>
        </div>
        {normalDay.total > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" />
            <span>
              {normalDay.dayLabel} · {normalDay.laborales}h + {normalDay.almuerzo}h almuerzo ={' '}
              <span className="font-semibold text-foreground">{normalDay.total}h</span>
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {info}
        </div>
      )}
      {scheduleWarnings.length > 0 && (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <ul className="space-y-0.5">
            {scheduleWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {defaults && pendingTypes.length > 0 && (
        <Button
          onClick={applyAllSuggestions}
          disabled={busy === 'apply-all'}
          variant="outline"
          className="w-full gap-2"
        >
          <Sparkles className="size-4" />
          {busy === 'apply-all'
            ? 'Aplicando...'
            : noneScheduled
              ? 'Aplicar todas las sugerencias'
              : `Aplicar sugerencias a las ${pendingTypes.length} restantes`}
        </Button>
      )}

      <div className="space-y-2">
        {TIMELINE_EVENT_ORDER.map((eventType, idx) => {
          const event = eventByType.get(eventType)
          const scheduled = event?.scheduledTime ?? null
          const suggestion = defaults?.[eventType] ?? null
          const isEditing = editing === eventType

          return (
            <div
              key={eventType}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="w-5 text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
              <span className="flex-1 text-sm">{TIMELINE_EVENT_LABELS[eventType]}</span>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Label htmlFor={`sched-${eventType}`} className="sr-only">
                    {TIMELINE_EVENT_LABELS[eventType]}
                  </Label>
                  <Input
                    id={`sched-${eventType}`}
                    type="time"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 w-28 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    disabled={busy === `save-${eventType}` || !editValue}
                    onClick={() => saveEdit(eventType)}
                  >
                    <Save className="size-3" />
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setEditing(null)
                      setEditValue('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {scheduled ? (
                    <span className="font-mono text-sm text-foreground">
                      {formatTime(scheduled)}
                    </span>
                  ) : suggestion ? (
                    <span className="font-mono text-xs italic text-muted-foreground">
                      sugerida {formatTime(suggestion)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    onClick={() => startEdit(eventType)}
                  >
                    <Pencil className="size-3" />
                    Editar
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function toTimeInput(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function combineDateAndTime(dateStr: string, timeHhmm: string): Date {
  const [h, m] = timeHhmm.split(':').map(Number)
  const d = new Date(`${dateStr}T00:00:00`)
  d.setHours(h, m, 0, 0)
  return d
}
