'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import { ChartCard, CHART_COLORS , CHART_TOOLTIP_CONTENT_STYLE } from './chart-card'
import type { StatusShare } from '../../lib/dashboard-queries'

const STATUS_LABELS: Record<string, string> = {
  tentativa: 'Tentativa',
  confirmada: 'Confirmada',
  ejecutada: 'Ejecutada',
  cancelada: 'Cancelada',
}

const STATUS_COLOR: Record<string, string> = {
  tentativa: CHART_COLORS.tertiary,
  confirmada: CHART_COLORS.primary,
  ejecutada: CHART_COLORS.secondary,
  cancelada: CHART_COLORS.quinary,
}

interface Props {
  data: StatusShare[]
}

export function StatusDistributionChart({ data }: Props) {
  const display = data.map((d) => ({ ...d, label: STATUS_LABELS[d.status] ?? d.status }))

  return (
    <ChartCard
      title="Estado de campañas"
      description="Distribución global"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={display}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              label={(p: { name?: string; value?: number }) => `${p.name ?? ''} (${p.value ?? 0})`}
            >
              {display.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={STATUS_COLOR[entry.status] ?? CHART_COLORS.muted}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
