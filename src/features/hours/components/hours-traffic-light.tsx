import { cn } from '@/lib/utils'

interface HoursTrafficLightProps {
  workedHours: number
  scheduledHours?: number
  extraHoursLimit?: number
  showLabel?: boolean
  size?: 'xs' | 'sm' | 'md'
}

type TrafficColor = 'green' | 'yellow' | 'red'

function getColor(workedHours: number, scheduled: number, extraLimit: number): TrafficColor {
  if (workedHours <= scheduled) return 'green'
  if (workedHours <= scheduled + extraLimit) return 'yellow'
  return 'red'
}

const DOT_SIZES: Record<NonNullable<HoursTrafficLightProps['size']>, string> = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
}

const COLOR_CLASSES: Record<TrafficColor, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
}

const COLOR_LABELS: Record<TrafficColor, string> = {
  green:  'En rango contractual',
  yellow: 'Con horas extras',
  red:    'Horas extras excedidas',
}

export function HoursTrafficLight({
  workedHours,
  scheduledHours = 44,
  extraHoursLimit = 12,
  showLabel = false,
  size = 'md',
}: HoursTrafficLightProps) {
  const color = getColor(workedHours, scheduledHours, extraHoursLimit)

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        role="img"
        aria-label={COLOR_LABELS[color]}
        className={cn('inline-block rounded-full flex-shrink-0', COLOR_CLASSES[color], DOT_SIZES[size])}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">{COLOR_LABELS[color]}</span>
      )}
    </span>
  )
}
