'use client'

import { useMemo, useState, useTransition } from 'react'
import { CalendarPlus } from 'lucide-react'
import { SedeDaySchedulerModal } from './sede-day-scheduler-modal'
import { SedeModalityPickerDialog } from './sede-modality-picker-dialog'
import { getSedeShiftsForDate } from '@/features/sede/actions/sede-shift-actions'
import {
  SHIFT_TYPE_SHORT_LABELS,
  type ShiftType,
  type SedeModality,
} from '@/features/sede/lib/shift-defaults'
import type {
  SedeShiftRow,
  StaffListItem,
} from '@/features/sede/actions/sede-shift-actions'

interface WeeklyShiftsCalendarProps {
  shifts: SedeShiftRow[]
  staffList: StaffListItem[]
  weekStart: string // YYYY-MM-DD
  onChanged: () => void
}

const WEEK_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function addDays(dateStr: string, days: number): string {
  // Timezone-safe: descomponemos ISO date-only y operamos sobre epoch UTC
  // para que el resultado YYYY-MM-DD no se corra cuando el browser local
  // está al oeste de UTC (Colombia UTC-5) y la hora pasa el límite de día.
  const [y, m, d] = dateStr.split('-').map(Number)
  const epoch = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000
  return new Date(epoch).toISOString().slice(0, 10)
}

function dayNumber(dateStr: string): number {
  return Number(dateStr.slice(8, 10))
}

export function WeeklyShiftsCalendar({
  shifts,
  staffList,
  weekStart,
  onChanged,
}: WeeklyShiftsCalendarProps) {
  const [modalState, setModalState] = useState<{
    date: string
    existing: SedeShiftRow[]
    modality: SedeModality
  } | null>(null)
  // Día elegido a la espera de que se seleccione la modalidad a programar.
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [loadingDate, setLoadingDate] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  // Agrupa shifts por fecha desde el initialData semanal
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, SedeShiftRow[]>()
    for (const s of shifts) {
      const arr = map.get(s.shiftDate) ?? []
      arr.push(s)
      map.set(s.shiftDate, arr)
    }
    return map
  }, [shifts])

  // Click en un día → primero pedimos la modalidad a programar.
  function handleDayClick(date: string) {
    setPickerDate(date)
  }

  // Modalidad elegida → cargamos los turnos del día y abrimos el scheduler.
  async function handlePickModality(date: string, modality: SedeModality) {
    setPickerDate(null)
    setLoadingDate(date)
    try {
      // Re-fetch fresco para evitar mostrar datos stale
      const existing = await getSedeShiftsForDate(date)
      setModalState({ date, existing, modality })
    } catch {
      // Fallback al snapshot inicial
      setModalState({ date, existing: shiftsByDate.get(date) ?? [], modality })
    } finally {
      setLoadingDate(null)
    }
  }

  function handleSaved() {
    startTransition(() => {
      onChanged()
    })
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
        {days.map((date, i) => {
          const dayShifts = shiftsByDate.get(date) ?? []
          const count = dayShifts.length
          const typeCounts = dayShifts.reduce(
            (acc, s) => {
              acc[s.shiftType] = (acc[s.shiftType] ?? 0) + 1
              return acc
            },
            {} as Record<ShiftType, number>,
          )
          const isLoading = loadingDate === date

          return (
            <button
              key={date}
              type="button"
              onClick={() => handleDayClick(date)}
              disabled={isLoading}
              className="flex flex-col items-stretch gap-1.5 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/30 disabled:opacity-60"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {WEEK_LABELS[i]}
                </span>
                <span className="text-2xl font-bold">{dayNumber(date)}</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{count}</span>
                <span className="text-xs text-muted-foreground">
                  {count === 1 ? 'en sede' : 'en sede'}
                </span>
              </div>

              {count > 0 && (
                <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  {typeCounts.diurno_completo ? (
                    <span>{typeCounts.diurno_completo} {SHIFT_TYPE_SHORT_LABELS.diurno_completo}</span>
                  ) : null}
                  {typeCounts.noche ? (
                    <span>· {typeCounts.noche} {SHIFT_TYPE_SHORT_LABELS.noche}</span>
                  ) : null}
                  {typeCounts.posturno ? (
                    <span>· {typeCounts.posturno} {SHIFT_TYPE_SHORT_LABELS.posturno}</span>
                  ) : null}
                  {typeCounts.servicios_transfusionales ? (
                    <span className="text-rose-600 dark:text-rose-400">
                      · {typeCounts.servicios_transfusionales} {SHIFT_TYPE_SHORT_LABELS.servicios_transfusionales}
                    </span>
                  ) : null}
                </div>
              )}

              <div className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                <CalendarPlus className="size-3.5" />
                {isLoading ? 'Abriendo...' : count === 0 ? 'Programar' : 'Editar'}
              </div>

              {count > 0 && (
                <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground border-t border-border/50 pt-1.5">
                  {dayShifts.slice(0, 4).map((s) => (
                    <div key={s.id} className="truncate">
                      {s.lastName}, {s.firstName.charAt(0)}.
                    </div>
                  ))}
                  {dayShifts.length > 4 && (
                    <div className="text-[10px] italic">+{dayShifts.length - 4} más</div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Paso 1: elegir la modalidad a programar para el día */}
      <SedeModalityPickerDialog
        open={!!pickerDate}
        onOpenChange={(o) => !o && setPickerDate(null)}
        onPick={(modality) => pickerDate && handlePickModality(pickerDate, modality)}
      />

      {modalState && (
        <SedeDaySchedulerModal
          open={!!modalState}
          onOpenChange={(o) => !o && setModalState(null)}
          shiftDate={modalState.date}
          existing={modalState.existing}
          staffList={staffList}
          modality={modalState.modality}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
