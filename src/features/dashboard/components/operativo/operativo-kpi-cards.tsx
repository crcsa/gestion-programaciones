import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * KPI con barra de progreso para cupos mensuales (domingos, pernoctas).
 * Cambia a tono de alerta cuando se alcanza o supera el tope.
 */
export function QuotaCard({
  title,
  current,
  max,
  icon: Icon,
}: {
  title: string
  current: number
  max: number
  icon: LucideIcon
}) {
  const reached = current >= max
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">
          {current}
          <span className="text-base font-normal text-muted-foreground">
            {' '}
            / {max}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              reached ? 'bg-destructive' : 'bg-primary',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p
          className={cn(
            'text-xs',
            reached ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {reached ? 'Tope alcanzado' : 'Disponible'}
        </p>
      </CardContent>
    </Card>
  )
}
