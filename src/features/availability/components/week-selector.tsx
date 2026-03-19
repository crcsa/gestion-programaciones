'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface WeekSelectorProps {
  weekStart: string  // 'YYYY-MM-DD'
  paramName?: string
}

function offsetWeek(weekStart: string, offsetWeeks: number): string {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() + offsetWeeks * 7)
  return d.toISOString().slice(0, 10)
}

export function WeekSelector({ weekStart, paramName = 'semana' }: WeekSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const navigate = (newWeekStart: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(paramName, newWeekStart)
    router.push(`?${params.toString()}`)
  }

  const weekEnd = offsetWeek(weekStart, 1)
  const startDate = new Date(`${weekStart}T00:00:00`)
  const endDate = new Date(`${weekEnd}T00:00:00`)
  endDate.setDate(endDate.getDate() - 1)

  const label = `${format(startDate, 'd MMM', { locale: es })} – ${format(endDate, 'd MMM yyyy', { locale: es })}`

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(offsetWeek(weekStart, -1))}
        aria-label="Semana anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-[160px] text-center">{label}</span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(offsetWeek(weekStart, 1))}
        aria-label="Semana siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
