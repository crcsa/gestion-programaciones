'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getMonthlyCapacity } from '@/features/availability/actions/capacity-actions'
import type {
  CapacityProfile,
  DayCapacity,
} from '@/features/availability/actions/capacity-actions'

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const PROFILES: { value: CapacityProfile | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos los perfiles' },
  { value: 'bacteriologo', label: 'Bacteriólogos' },
  { value: 'tecnico', label: 'Técnicos' },
  { value: 'medico', label: 'Médicos' },
  { value: 'auxiliar', label: 'Auxiliares' },
]

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getCapacityClass(free: number, total: number): string {
  if (total === 0) return 'bg-muted text-muted-foreground'
  const ratio = free / total
  if (ratio >= 0.4) return 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100'
  if (ratio >= 0.15) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100'
  return 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100'
}

function dayOfWeekIndex(dateStr: string): number {
  // Monday = 0, Sunday = 6
  const d = new Date(`${dateStr}T00:00:00`).getDay()
  return d === 0 ? 6 : d - 1
}

export function CapacityCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [profile, setProfile] = useState<CapacityProfile | 'todos'>('todos')
  const [days, setDays] = useState<DayCapacity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchCapacity() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getMonthlyCapacity({
          year,
          month,
          profile: profile === 'todos' ? undefined : profile,
        })
        if (!cancelled) setDays(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar capacidad')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchCapacity()
    return () => {
      cancelled = true
    }
  }, [year, month, profile])

  const grid = useMemo(() => {
    if (days.length === 0) return []
    const firstDayOffset = dayOfWeekIndex(days[0].date)
    const cells: (DayCapacity | null)[] = []
    for (let i = 0; i < firstDayOffset; i++) cells.push(null)
    for (const d of days) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [days])

  const handlePrev = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }

  const handleNext = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  const totalStaff = days[0]?.totalStaff ?? 0

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

        <Select
          value={profile}
          onValueChange={(v) => setProfile(v as CapacityProfile | 'todos')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFILES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Total personal activo: <strong>{totalStaff}</strong></span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-green-100 dark:bg-green-900/30" />
          ≥40% libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-yellow-100 dark:bg-yellow-900/30" />
          15–40% libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-red-100 dark:bg-red-900/30" />
          &lt;15% libre
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Cargando capacidad...</p>
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
                className="border-r border-b border-border last:border-r-0 min-h-[80px] p-1.5"
              >
                {cell && (
                  <div
                    className={`rounded-md h-full p-2 ${getCapacityClass(cell.free, cell.totalStaff)}`}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs opacity-70">
                        {Number(cell.date.slice(8, 10))}
                      </span>
                      <span className="text-lg font-bold">{cell.free}</span>
                    </div>
                    <div className="text-[10px] opacity-70 leading-tight mt-1">
                      <div>Camp: {cell.assignedToCampaign}</div>
                      <div>Sede: {cell.onSedeShift}</div>
                      {cell.unavailable > 0 && (
                        <div>NoDisp: {cell.unavailable}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
