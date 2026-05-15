'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { ChartCard, CHART_COLORS , CHART_TOOLTIP_CONTENT_STYLE } from './chart-card'
import type { MonthlyProgressionPoint } from '../../lib/operativo-queries'

interface Props {
  data: MonthlyProgressionPoint[]
}

export function MonthlyProgressionChart({ data }: Props) {
  return (
    <ChartCard
      title="Progresión mensual"
      description={`Últimos ${data.length} meses — horas y campañas`}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="monthLabel" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis
              yAxisId="hours"
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <YAxis
              yAxisId="campaigns"
              orientation="right"
              stroke="var(--muted-foreground)"
              fontSize={12}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="hours"
              dataKey="totalHours"
              name="Horas totales"
              fill={CHART_COLORS.primary}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="hours"
              dataKey="extraHours"
              name="Horas extra"
              fill={CHART_COLORS.tertiary}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="campaigns"
              type="monotone"
              dataKey="campaignCount"
              name="Campañas"
              stroke={CHART_COLORS.quaternary}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
