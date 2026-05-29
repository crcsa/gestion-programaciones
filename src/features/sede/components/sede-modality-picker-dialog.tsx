'use client'

import { Building2, Droplets } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SEDE_MODALITY_LABELS, type SedeModality } from '@/features/sede/lib/shift-defaults'

interface SedeModalityPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (modality: SedeModality) => void
}

/**
 * Paso previo a programar turnos de un día: elegir la modalidad (sede regular
 * o servicios transfusionales). El texto envuelve y es responsive — las
 * tarjetas se apilan en móvil y comparten ancho en pantallas ≥ sm.
 */
export function SedeModalityPickerDialog({
  open,
  onOpenChange,
  onPick,
}: SedeModalityPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué vas a programar?</DialogTitle>
          <DialogDescription>
            Elige la modalidad de turnos para este día. Cada modalidad se programa por separado y no
            afecta a la otra.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full flex-col items-start gap-1 whitespace-normal p-4 text-left"
            onClick={() => onPick('sede')}
          >
            <span className="flex w-full items-center gap-2 font-medium">
              <Building2 className="size-4 shrink-0" />
              <span className="min-w-0 break-words">{SEDE_MODALITY_LABELS.sede}</span>
            </span>
            <span className="w-full break-words text-xs font-normal text-muted-foreground">
              Diurno completo, noche o posturno.
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full flex-col items-start gap-1 whitespace-normal p-4 text-left"
            onClick={() => onPick('servicios')}
          >
            <span className="flex w-full items-center gap-2 font-medium text-rose-600 dark:text-rose-400">
              <Droplets className="size-4 shrink-0" />
              <span className="min-w-0 break-words">{SEDE_MODALITY_LABELS.servicios}</span>
            </span>
            <span className="w-full break-words text-xs font-normal text-muted-foreground">
              07:00–17:00, 9h efectivas.
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
