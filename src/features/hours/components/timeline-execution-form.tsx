'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TIMELINE_EVENT_LABELS,
  TIMELINE_EVENT_ORDER,
  type TimelineEventType,
} from '@/features/campaigns/lib/timeline-constants'
import {
  registerActualTime,
  finalizeCampaignHours,
  getCampaignTimeline,
} from '../actions/hours-balance-actions'
import type { CampaignTimelineEvent } from '@/lib/db/schema/campaign-timeline'

interface TimelineExecutionFormProps {
  campaignId: string
  campaignDate: string
  existingEvents: CampaignTimelineEvent[]
}

export function TimelineExecutionForm({
  campaignId,
  campaignDate,
  existingEvents,
}: TimelineExecutionFormProps) {
  const router = useRouter()
  const [events, setEvents] = useState<CampaignTimelineEvent[]>(existingEvents)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const eventByType = useMemo(() => {
    const m = new Map<TimelineEventType, CampaignTimelineEvent>()
    for (const e of events) m.set(e.eventType as TimelineEventType, e)
    return m
  }, [events])

  const registeredCount = TIMELINE_EVENT_ORDER.filter(
    (t) => eventByType.get(t)?.eventTime != null,
  ).length
  const allRegistered = registeredCount === TIMELINE_EVENT_ORDER.length

  function getDraftTime(eventType: TimelineEventType): string {
    if (drafts[eventType] != null) return drafts[eventType]
    const scheduled = eventByType.get(eventType)?.scheduledTime
    if (scheduled) return toTimeInput(new Date(scheduled))
    return ''
  }

  function updateDraftTime(eventType: TimelineEventType, time: string) {
    setDrafts((prev) => ({ ...prev, [eventType]: time }))
  }

  async function refresh() {
    const fresh = await getCampaignTimeline(campaignId)
    setEvents(fresh)
  }

  async function registerNow(eventType: TimelineEventType) {
    setBusy(`now-${eventType}`)
    setError(null)
    try {
      await registerActualTime({
        campaignId,
        eventType,
        actualTime: new Date().toISOString(),
      })
      // Limpia draft para que la fila pase a "registrado".
      setDrafts((prev) => {
        const { [eventType]: _, ...rest } = prev
        void _
        return rest
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la hora actual')
    } finally {
      setBusy(null)
    }
  }

  async function registerManual(eventType: TimelineEventType) {
    const time = getDraftTime(eventType)
    if (!time) {
      setError('Ingrese una hora antes de registrar')
      return
    }
    setBusy(`manual-${eventType}`)
    setError(null)
    try {
      const iso = combineDateAndTime(campaignDate, time).toISOString()
      await registerActualTime({ campaignId, eventType, actualTime: iso })
      setDrafts((prev) => {
        const { [eventType]: _, ...rest } = prev
        void _
        return rest
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la hora real')
    } finally {
      setBusy(null)
    }
  }

  async function finalize() {
    setBusy('finalize')
    setError(null)
    try {
      await finalizeCampaignHours(campaignId)
      setInfo('Horas calculadas y campaña marcada como ejecutada')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al finalizar')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Pulsa <strong className="text-foreground">Ahora</strong> para sello automático o
          ingresa fecha y hora manualmente.
        </p>
        <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {registeredCount} / {TIMELINE_EVENT_ORDER.length} registradas
        </div>
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

      <div className="space-y-2">
        {TIMELINE_EVENT_ORDER.map((eventType, idx) => {
          const event = eventByType.get(eventType)
          const scheduled = event?.scheduledTime ?? null
          const actual = event?.eventTime ?? null
          const draftTime = getDraftTime(eventType)

          return (
            <div
              key={eventType}
              className="rounded-lg border border-border p-3 flex flex-col gap-2"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums leading-5">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight break-words">
                    {TIMELINE_EVENT_LABELS[eventType]}
                  </p>
                  {scheduled && (
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      Programada {formatTime(scheduled)}
                    </p>
                  )}
                </div>
                {actual && (
                  <div className="inline-flex shrink-0 items-center gap-1 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span className="font-mono whitespace-nowrap">{formatTime(actual)}</span>
                  </div>
                )}
              </div>

              {!actual && (
                <div className="flex items-center gap-1.5 pl-7">
                  <Label htmlFor={`time-${eventType}`} className="sr-only">
                    Hora
                  </Label>
                  <Input
                    id={`time-${eventType}`}
                    type="time"
                    value={draftTime}
                    onChange={(e) => updateDraftTime(eventType, e.target.value)}
                    className="h-9 min-w-0 flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 shrink-0 p-0"
                    disabled={busy === `now-${eventType}`}
                    onClick={() => registerNow(eventType)}
                    title="Registrar con la hora actual"
                    aria-label="Registrar con la hora actual"
                  >
                    <Clock className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 shrink-0 px-3 text-xs"
                    disabled={busy === `manual-${eventType}` || !draftTime}
                    onClick={() => registerManual(eventType)}
                  >
                    Registrar
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allRegistered && (
        <Button onClick={finalize} disabled={busy === 'finalize'} className="w-full">
          {busy === 'finalize' ? 'Calculando...' : 'Finalizar y calcular horas'}
        </Button>
      )}
    </div>
  )
}

function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function combineDateAndTime(dateStr: string, timeHhmm: string): Date {
  const [h, m] = timeHhmm.split(':').map(Number)
  const d = new Date(`${dateStr}T00:00:00`)
  d.setHours(h, m, 0, 0)
  return d
}
