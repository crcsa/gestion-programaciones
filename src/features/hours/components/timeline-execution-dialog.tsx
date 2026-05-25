'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TimelineExecutionForm } from './timeline-execution-form'
import { getCampaignTimeline } from '../actions/hours-balance-actions'
import type { CampaignTimelineEvent } from '@/lib/db/schema/campaign-timeline'

interface TimelineExecutionDialogProps {
  campaignId: string
  campaignDate: string
  initialEvents: CampaignTimelineEvent[]
  canFinalize?: boolean
}

export function TimelineExecutionDialog({
  campaignId,
  campaignDate,
  initialEvents,
  canFinalize = false,
}: TimelineExecutionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<CampaignTimelineEvent[]>(initialEvents)

  // Al abrir, refrescar para reflejar lo último (puede haber cambiado desde
  // que se renderizó la página, e.g. otro admin programó horas).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getCampaignTimeline(campaignId)
      .then((fresh) => {
        if (!cancelled) setEvents(fresh)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, campaignId])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // Al cerrar, re-render del server para que la página principal vea los
      // event_time recién registrados (vista comercial, etc.).
      router.refresh()
    }
  }

  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <ClipboardCheck className="size-4" />
        Registrar horas de ejecución
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto overflow-x-hidden"
          style={{ maxWidth: 'min(28rem, calc(100vw - 2rem))', width: '100%' }}
        >
          <DialogHeader>
            <DialogTitle>Registro de ejecución</DialogTitle>
            <DialogDescription>
              Registra la hora real de cada actividad de la línea de tiempo.
            </DialogDescription>
          </DialogHeader>
          <TimelineExecutionForm
            campaignId={campaignId}
            campaignDate={campaignDate}
            existingEvents={events}
            canFinalize={canFinalize}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
