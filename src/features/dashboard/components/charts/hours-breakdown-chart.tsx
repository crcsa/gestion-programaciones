'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { ChartCard, CHART_COLORS , CHART_TOOLTIP_CONTENT_STYLE } from './chart-card'
import type { WeeklyBreakdownPoint } from '../../lib/operativo-queries'

interface Props {
  data: WeeklyBreakdownPoint[]
}

export function HoursBreakdownChart({ data }: Props) {
  return (
    <ChartCard
      title="Sede vs campaña"
      description={`Últimas ${data.length} semanas`}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="weekLabel" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="sedeHours"
              name="Horas sede"
              stackId="hours"
              fill={CHART_COLORS.primary}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="campaignHours"
              name="Horas campaña"
              stackId="hours"
              fill={CHART_COLORS.secondary}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
