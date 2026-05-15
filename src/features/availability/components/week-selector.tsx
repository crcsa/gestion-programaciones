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
  // Timezone-safe: descomponemos el ISO date-only y usamos UTC para evitar
  // shifts cuando el browser local está al oeste de UTC (Colombia UTC-5)
  // y la hora actual pasa el límite de día al serializar.
  const [y, m, d] = weekStart.split('-').map(Number)
  const epoch = Date.UTC(y, m - 1, d) + offsetWeeks * 7 * 24 * 60 * 60 * 1000
  return new Date(epoch).toISOString().slice(0, 10)
}

export function WeekSelector({ weekStart, paramName = 'semana' }: WeekSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const navigate = (newWeekStart: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(paramName, newWeekStart)
    router.push(`?${params.toString()}`)
  }

  // Construimos las fechas a partir de componentes UTC sobre el ISO date-only
  // del weekStart. `new Date(\`${date}T00:00:00\`)` se parsearía como LOCAL,
  // y al combinarse con timezone offset produce el label desfasado en zonas
  // negativas como Colombia (UTC-5).
  const [sy, sm, sd] = weekStart.split('-').map(Number)
  const startDate = new Date(sy, sm - 1, sd)
  const endDate = new Date(sy, sm - 1, sd + 6)

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
