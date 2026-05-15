'use client'

import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ChartCardProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function ChartCard({ title, description, children, className }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export const CHART_COLORS = {
  primary: 'var(--chart-1, #2563eb)',
  secondary: 'var(--chart-2, #16a34a)',
  tertiary: 'var(--chart-3, #f97316)',
  quaternary: 'var(--chart-4, #a855f7)',
  quinary: 'var(--chart-5, #ef4444)',
  muted: 'var(--muted-foreground, #6b7280)',
} as const

export const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.quaternary,
  CHART_COLORS.quinary,
] as const

/**
 * Estilos compartidos por todos los Tooltip de recharts en el dashboard.
 * Mantener consistencia visual: cualquier cambio (radio, sombra, fondo)
 * se aplica desde acá a las 9 charts simultáneamente.
 */
export const CHART_TOOLTIP_CONTENT_STYLE = {
  backgroundColor: 'var(--popover, white)',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 6,
} as const

export const CHART_LEGEND_WRAPPER_STYLE = {
  fontSize: 12,
} as const
