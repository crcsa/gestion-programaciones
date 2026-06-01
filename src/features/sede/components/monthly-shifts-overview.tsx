'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SedeDaySchedulerModal } from './sede-day-scheduler-modal'
import { SedeModalityPickerDialog } from './sede-modality-picker-dialog'
import { type SedeModality } from '@/features/sede/lib/shift-defaults'
import {
  getMonthlyShiftCounts,
  getSedeShiftsForDate,
  getBankBalanceForStaffAtMonth,
} from '@/features/sede/actions/sede-shift-actions'
import type {
  DayShiftCount,
  SedeShiftRow,
  StaffListItem,
} from '@/features/sede/actions/sede-shift-actions'

interface MonthlyShiftsOverviewProps {
  staffList: StaffListItem[]
  initialCounts: DayShiftCount[]
  initialYear: number
  initialMonth: number
  onChanged: () => void
}

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function dayOfWeekIndex(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`).getDay()
  return d === 0 ? 6 : d - 1
}

function getCapacityClass(count: number, totalStaff: number): string {
  if (totalStaff === 0 || count === 0) return 'bg-muted text-muted-foreground'
  const ratio = count / totalStaff
  if (ratio >= 0.8) return 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100'
  if (ratio >= 0.5) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100'
  return 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100'
}

export function MonthlyShiftsOverview({
  staffList,
  initialCounts,
  initialYear,
  initialMonth,
  onChanged,
}: MonthlyShiftsOverviewProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  // `fetchedData` guarda lo que devolvió la última request: counts si tuvo
  // éxito, error si falló. Inicializado a null para que el mes inicial use
  // `initialCounts` directamente sin setState en effect.
  const [fetchedData, setFetchedData] = useState<{
    key: string
    counts: DayShiftCount[]
    error: string | null
  } | null>(null)
  const [modalState, setModalState] = useState<{
    date: string
    existing: SedeShiftRow[]
    modality: SedeModality
    bankBalanceByStaff: Record<string, number>
  } | null>(null)
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const isInitialMonth = year === initialYear && month === initialMonth
  const currentKey = `${year}-${month}`
  // Memoizamos `counts` para que la dependencia del useMemo de `grid` no
  // cambie de identidad en cada render (eslint react-hooks/exhaustive-deps).
  const counts = useMemo<DayShiftCount[]>(
    () =>
      isInitialMonth
        ? initialCounts
        : fetchedData?.key === currentKey
          ? fetchedData.counts
          : [],
    [isInitialMonth, initialCounts, fetchedData, currentKey],
  )
  const error = fetchedData?.key === currentKey ? fetchedData.error : null
  const isLoading = !isInitialMonth && fetchedData?.key !== currentKey

  useEffect(() => {
    if (isInitialMonth) return
    let cancelled = false
    getMonthlyShiftCounts(year, month)
      .then((data) => {
        if (!cancelled) setFetchedData({ key: currentKey, counts: data, error: null })
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchedData({
            key: currentKey,
            counts: [],
            error: err instanceof Error ? err.message : 'Error al cargar el mes',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [year, month, isInitialMonth, currentKey])

  const grid = useMemo(() => {
    if (counts.length === 0) return []
    const firstOffset = dayOfWeekIndex(counts[0].date)
    const cells: (DayShiftCount | null)[] = []
    for (let i = 0; i < firstOffset; i++) cells.push(null)
    for (const c of counts) cells.push(c)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [counts])

  const totalActiveStaff = staffList.length

  function handlePrev() {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }

  function handleNext() {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  function handleDayClick(date: string) {
    setPickerDate(date)
  }

  async function handlePickModality(date: string, modality: SedeModality) {
    setPickerDate(null)
    // Mes del día abierto (YYYY-MM-01) — usamos componentes del string para
    // evitar pasarlo por Date/timezone.
    const monthKey = `${date.slice(0, 7)}-01`
    const staffIds = staffList.map((s) => s.id)
    try {
      const [existing, bankBalanceByStaff] = await Promise.all([
        getSedeShiftsForDate(date),
        getBankBalanceForStaffAtMonth(staffIds, monthKey).catch(() => ({})),
      ])
      setModalState({ date, existing, modality, bankBalanceByStaff })
    } catch {
      setModalState({ date, existing: [], modality, bankBalanceByStaff: {} })
    }
  }

  async function refreshCurrentMonth() {
    try {
      const data = await getMonthlyShiftCounts(year, month)
      if (isInitialMonth) {
        // El mes inicial se hidrata desde el servidor (RSC). Dispara un
        // refresh del routing para que `initialCounts` se actualice.
        onChanged()
      } else {
        setFetchedData({ key: currentKey, counts: data, error: null })
      }
    } catch {
      // ignore
    }
  }

  function handleSaved() {
    startTransition(() => {
      onChanged()
    })
    void refreshCurrentMonth()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold min-w-[140px] text-center">
            {MONTH_LABELS[month - 1]} {year}
          </span>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Personal activo: <strong>{totalActiveStaff}</strong>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-green-100 dark:bg-green-900/30" />
          &lt;50% del personal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-yellow-100 dark:bg-yellow-900/30" />
          50–80%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-red-100 dark:bg-red-900/30" />
          ≥80%
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Cargando mes...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-7 bg-muted text-xs font-medium">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="px-2 py-2 text-center border-r border-border last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((cell, i) => (
              <div
                key={i}
                className="border-r border-b border-border last:border-r-0 min-h-[88px] p-1.5"
              >
                {cell && (
                  <button
                    type="button"
                    onClick={() => handleDayClick(cell.date)}
                    className={`rounded-md h-full w-full p-2 text-left transition-opacity hover:opacity-90 ${getCapacityClass(cell.count, totalActiveStaff)}`}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs opacity-70">
                        {Number(cell.date.slice(8, 10))}
                      </span>
                      <span className="text-lg font-bold">{cell.count}</span>
                    </div>
                    {cell.count > 0 && (
                      <div className="text-[10px] opacity-70 leading-tight mt-1">
                        {cell.types.diurno > 0 && <div>{cell.types.diurno} Diurno</div>}
                        {cell.types.noche > 0 && <div>{cell.types.noche} Noche</div>}
                        {cell.types.posturno > 0 && <div>{cell.types.posturno} Posturno</div>}
                      </div>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
          bankBalanceByStaff={modalState.bankBalanceByStaff}
        />
      )}
    </div>
  )
}
