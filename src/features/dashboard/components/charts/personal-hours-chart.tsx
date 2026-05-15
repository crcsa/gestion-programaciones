'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { ChartCard, CHART_COLORS , CHART_TOOLTIP_CONTENT_STYLE } from './chart-card'
import type { PersonalHoursPoint } from '../../lib/dashboard-queries'

interface Props {
  data: PersonalHoursPoint[]
  contractHours: number
}

export function PersonalHoursChart({ data, contractHours }: Props) {
  return (
    <ChartCard
      title="Mis horas trabajadas"
      description={`Últimas ${data.length} semanas (contrato: ${contractHours}h)`}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="weekLabel" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="workedHours"
              name="Horas trabajadas"
              fill={CHART_COLORS.primary}
              radius={[4, 4, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="contractHours"
              name="Contrato"
              stroke={CHART_COLORS.muted}
              strokeDasharray="4 4"
              dot={false}
            />
            <ReferenceLine
              y={contractHours}
              stroke={CHART_COLORS.muted}
              strokeOpacity={0}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
