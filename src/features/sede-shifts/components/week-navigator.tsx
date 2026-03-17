'use client'

import { format, addDays, subDays, startOfWeek, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'

interface WeekNavigatorProps {
  weekStart: string
  onChange: (weekStart: string) => void
}

function formatWeekLabel(weekStart: string): string {
  const start = parseISO(weekStart)
  const end = addDays(start, 6)
  const startLabel = format(start, 'dd/MM', { locale: es })
  const endLabel = format(end, 'dd/MM/yyyy', { locale: es })
  return `Semana del ${startLabel} al ${endLabel}`
}

function getCurrentWeekStart(): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  return format(monday, 'yyyy-MM-dd')
}

export function WeekNavigator({ weekStart, onChange }: WeekNavigatorProps) {
  const label = formatWeekLabel(weekStart)

  const handlePrev = () => {
    const prev = subDays(parseISO(weekStart), 7)
    onChange(format(prev, 'yyyy-MM-dd'))
  }

  const handleNext = () => {
    const next = addDays(parseISO(weekStart), 7)
    onChange(format(next, 'yyyy-MM-dd'))
  }

  const handleToday = () => {
    onChange(getCurrentWeekStart())
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handlePrev}>
        &larr; Anterior
      </Button>
      <span className="text-sm font-medium min-w-48 text-center">{label}</span>
      <Button variant="outline" size="sm" onClick={handleNext}>
        Siguiente &rarr;
      </Button>
      <Button variant="outline" size="sm" onClick={handleToday}>
        Hoy
      </Button>
    </div>
  )
}
