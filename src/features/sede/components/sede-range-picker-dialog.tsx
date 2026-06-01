'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, CalendarRange, Droplets } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SEDE_MODALITY_LABELS, type SedeModality } from '@/features/sede/lib/shift-defaults'

interface SedeRangePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Lunes de la semana actualmente visible (para anclar el rango). */
  weekStart: string
  onPick: (data: { dateFrom: string; dateTo: string; modality: SedeModality }) => void
}

/**
 * Calcula el lunes (YYYY-MM-DD) de la semana ISO a la que pertenece `iso`.
 * Igual lógica que el refine del schema; usar Date local + getDay para evitar
 * issues de timezone (el browser está en America/Bogota, UTC-5).
 */
function isoMondayOf(iso: string): string {
  const dt = new Date(`${iso}T00:00:00`)
  const dow = dt.getDay() // 0=Dom, 1=Lun, ...
  const offset = dow === 0 ? -6 : 1 - dow
  const lun = new Date(dt)
  lun.setDate(dt.getDate() + offset)
  return lun.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * Paso previo a programar un rango contiguo: el usuario elige fecha de
 * inicio y fin (deben caer en la misma semana que `weekStart`) y la
 * modalidad. Al continuar se entrega `{ dateFrom, dateTo, modality }` al
 * caller, que abre el scheduler de rango.
 */
export function SedeRangePickerDialog({
  open,
  onOpenChange,
  weekStart,
  onPick,
}: SedeRangePickerDialogProps) {
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const [dateFrom, setDateFrom] = useState(weekStart)
  const [dateTo, setDateTo] = useState(weekStart)
  const [modality, setModality] = useState<SedeModality>('sede')

  // Resetea al abrirse para que el dialog refleje la semana actual.
  useEffect(() => {
    if (open) {
      setDateFrom(weekStart)
      setDateTo(weekStart)
      setModality('sede')
    }
  }, [open, weekStart])

  const error = useMemo<string | null>(() => {
    if (dateFrom < weekStart || dateFrom > weekEnd) {
      return 'La fecha de inicio debe estar en la semana visible (lunes a domingo).'
    }
    if (dateTo < weekStart || dateTo > weekEnd) {
      return 'La fecha de fin debe estar en la semana visible (lunes a domingo).'
    }
    if (dateFrom > dateTo) {
      return 'La fecha de inicio debe ser ≤ a la fecha de fin.'
    }
    if (isoMondayOf(dateFrom) !== isoMondayOf(dateTo)) {
      return 'El rango debe estar dentro de una misma semana (lunes a domingo).'
    }
    return null
  }, [dateFrom, dateTo, weekStart, weekEnd])

  function handleContinue() {
    if (error) return
    onPick({ dateFrom, dateTo, modality })
  }

  const daysCount = useMemo(() => {
    if (error) return 0
    const [y, m, d] = dateFrom.split('-').map(Number)
    const [y2, m2, d2] = dateTo.split('-').map(Number)
    const a = Date.UTC(y, m - 1, d)
    const b = Date.UTC(y2, m2 - 1, d2)
    return Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1
  }, [dateFrom, dateTo, error])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto overflow-x-hidden"
        style={{ maxWidth: 'min(34rem, calc(100vw - 2rem))', width: '100%' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="size-4 shrink-0" />
            Programar rango de días
          </DialogTitle>
          <DialogDescription>
            Aplica la MISMA programación (mismo personal, mismo turno) a todos los días del rango.
            El rango debe quedar dentro de la semana visible (lunes a domingo).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="range-from" className="text-xs">
              Desde
            </Label>
            <Input
              id="range-from"
              type="date"
              min={weekStart}
              max={weekEnd}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="range-to" className="text-xs">
              Hasta
            </Label>
            <Input
              id="range-to"
              type="date"
              min={weekStart}
              max={weekEnd}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modalidad
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={modality === 'sede' ? 'default' : 'outline'}
              className="h-auto w-full flex-col items-start gap-1 whitespace-normal p-3 text-left"
              onClick={() => setModality('sede')}
            >
              <span className="flex w-full items-center gap-2 font-medium">
                <Building2 className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{SEDE_MODALITY_LABELS.sede}</span>
              </span>
              <span className="w-full break-words text-xs font-normal opacity-80">
                Diurno completo, noche o posturno.
              </span>
            </Button>
            <Button
              type="button"
              variant={modality === 'servicios' ? 'default' : 'outline'}
              className={`h-auto w-full flex-col items-start gap-1 whitespace-normal p-3 text-left ${
                modality === 'servicios' ? '' : 'text-rose-600 dark:text-rose-400'
              }`}
              onClick={() => setModality('servicios')}
            >
              <span className="flex w-full items-center gap-2 font-medium">
                <Droplets className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{SEDE_MODALITY_LABELS.servicios}</span>
              </span>
              <span className="w-full break-words text-xs font-normal opacity-80">
                07:00–17:00, 9h efectivas.
              </span>
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Se programarán <strong>{daysCount}</strong> día{daysCount === 1 ? '' : 's'} con la
            misma configuración.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleContinue} disabled={!!error}>
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
