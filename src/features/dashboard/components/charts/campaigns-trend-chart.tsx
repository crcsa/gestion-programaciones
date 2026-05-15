'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { ChartCard, CHART_COLORS , CHART_TOOLTIP_CONTENT_STYLE } from './chart-card'
import type { CampaignTrendPoint } from '../../lib/dashboard-queries'

interface Props {
  data: CampaignTrendPoint[]
}

export function CampaignsTrendChart({ data }: Props) {
  return (
    <ChartCard
      title="Tendencia de campañas"
      description="Programadas vs ejecutadas vs canceladas (últimos meses)"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="monthLabel" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="created"
              name="Programadas"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="ejecutadas"
              name="Ejecutadas"
              stroke={CHART_COLORS.secondary}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="canceladas"
              name="Canceladas"
              stroke={CHART_COLORS.quinary}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
