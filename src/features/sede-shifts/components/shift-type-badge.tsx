'use client'

import { cn } from '@/lib/utils'
import { SHIFT_TYPE_LABELS, SHIFT_TYPE_COLORS } from '../lib/constants'

interface ShiftTypeBadgeProps {
  shiftType: string
  className?: string
}

export function ShiftTypeBadge({ shiftType, className }: ShiftTypeBadgeProps) {
  const label = SHIFT_TYPE_LABELS[shiftType] ?? shiftType
  const colorClasses = SHIFT_TYPE_COLORS[shiftType] ?? 'bg-gray-100 text-gray-800'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        colorClasses,
        className,
      )}
    >
      {label}
    </span>
  )
}
