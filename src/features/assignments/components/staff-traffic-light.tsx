import { cn } from '@/lib/utils'

interface StaffTrafficLightProps {
  color: 'green' | 'yellow' | 'red'
  size?: 'sm' | 'md'
}

const COLOR_CLASSES: Record<StaffTrafficLightProps['color'], string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
}

const COLOR_LABELS: Record<StaffTrafficLightProps['color'], string> = {
  green:  'Horas dentro del contrato',
  yellow: 'Horas extras permitidas',
  red:    'Horas extras excedidas',
}

const SIZE_CLASSES: Record<NonNullable<StaffTrafficLightProps['size']>, string> = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
}

export function StaffTrafficLight({ color, size = 'md' }: StaffTrafficLightProps) {
  return (
    <span
      role="img"
      aria-label={COLOR_LABELS[color]}
      className={cn(
        'inline-block rounded-full flex-shrink-0',
        COLOR_CLASSES[color],
        SIZE_CLASSES[size],
      )}
    />
  )
}
