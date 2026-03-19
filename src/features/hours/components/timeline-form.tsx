'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TIMELINE_EVENT_LABELS,
  TIMELINE_EVENT_ORDER,
  type TimelineEventType,
} from '@/features/campaigns/lib/timeline-constants'
import { registerTimelineEvent, finalizeCampaignHours } from '../actions/hours-balance-actions'
import type { CampaignTimelineEvent } from '@/lib/db/schema/campaign-timeline'

interface TimelineFormProps {
  campaignId: string
  existingEvents: CampaignTimelineEvent[]
  isCoordinator: boolean
}

export function TimelineForm({ campaignId, existingEvents, isCoordinator }: TimelineFormProps) {
  const [events, setEvents] = useState<CampaignTimelineEvent[]>(existingEvents)
  const [pendingTimes, setPendingTimes] = useState<Record<string, string>>({})
  const [registering, setRegistering] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const registeredTypes = new Set(events.map((e) => e.eventType))
  const allRegistered = TIMELINE_EVENT_ORDER.every((t) => registeredTypes.has(t))

  const handleRegister = async (eventType: TimelineEventType) => {
    const timeValue = pendingTimes[eventType]
    if (!timeValue) {
      setError('Ingrese la hora antes de registrar')
      return
    }

    setRegistering(eventType)
    setError(null)
    try {
      await registerTimelineEvent({
        campaignId,
        eventType,
        eventTime: new Date(timeValue).toISOString(),
      })
      const updated = await import('../actions/hours-balance-actions').then((m) =>
        m.getCampaignTimeline(campaignId),
      )
      setEvents(updated)
      setPendingTimes((prev) => {
        const { [eventType]: _, ...rest } = prev
        void _
        return rest
      })
      setSuccessMessage(`"${TIMELINE_EVENT_LABELS[eventType]}" registrado`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setRegistering(null)
    }
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    setError(null)
    try {
      await finalizeCampaignHours(campaignId)
      setSuccessMessage('Horas calculadas y campaña marcada como ejecutada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al finalizar')
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Línea de tiempo</h3>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {successMessage}
        </div>
      )}

      <div className="space-y-2">
        {TIMELINE_EVENT_ORDER.map((eventType, idx) => {
          const existing = events.find((e) => e.eventType === eventType)
          const label = TIMELINE_EVENT_LABELS[eventType]

          return (
            <div
              key={eventType}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="w-4 text-xs text-muted-foreground">{idx + 1}</span>
              <span className="flex-1 text-sm">{label}</span>

              {existing ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(existing.eventTime).toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-green-500 text-sm" aria-label="Registrado">
                    ✓
                  </span>
                </div>
              ) : isCoordinator ? (
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <Label className="sr-only" htmlFor={`time-${eventType}`}>
                      {label}
                    </Label>
                    <Input
                      id={`time-${eventType}`}
                      type="datetime-local"
                      className="h-7 text-xs w-44"
                      value={pendingTimes[eventType] ?? ''}
                      onChange={(e) =>
                        setPendingTimes((prev) => ({ ...prev, [eventType]: e.target.value }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={registering === eventType || !pendingTimes[eventType]}
                    onClick={() => handleRegister(eventType)}
                  >
                    {registering === eventType ? '...' : 'Registrar'}
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Pendiente</span>
              )}
            </div>
          )
        })}
      </div>

      {allRegistered && isCoordinator && (
        <Button onClick={handleFinalize} disabled={finalizing} className="w-full">
          {finalizing ? 'Calculando...' : 'Finalizar y calcular horas'}
        </Button>
      )}
    </div>
  )
}
