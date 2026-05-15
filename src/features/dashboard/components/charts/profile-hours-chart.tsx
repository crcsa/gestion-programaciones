'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { ChartCard, CHART_COLORS , CHART_TOOLTIP_CONTENT_STYLE } from './chart-card'
import type { ProfileHoursRow } from '../../lib/dashboard-queries'

interface Props {
  data: ProfileHoursRow[]
  contractHours: number
}

export function ProfileHoursChart({ data, contractHours }: Props) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Horas promedio por perfil"
        description="Sede + campaña, promedio por colaborador del perfil"
      >
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin datos para los filtros aplicados.
        </p>
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title="Horas promedio por perfil"
      description={`Sede + campaña por persona · referencia ${contractHours}h contrato`}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="profileLabel"
              stroke="var(--muted-foreground)"
              fontSize={11}
            />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.25 }}
              contentStyle={{ ...CHART_TOOLTIP_CONTENT_STYLE, fontSize: 12 }}
              formatter={(value, name) => [`${String(value)}h`, name as string]}
              labelFormatter={(label, payload) => {
                const labelStr = String(label ?? '')
                const headcount = (
                  (Array.isArray(payload) ? payload[0] : undefined)
                    ?.payload as ProfileHoursRow | undefined
                )?.headcount
                return headcount ? `${labelStr} · ${headcount} pers.` : labelStr
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={contractHours}
              stroke={CHART_COLORS.tertiary}
              strokeDasharray="4 4"
              label={{
                value: 'Contrato',
                fill: CHART_COLORS.tertiary,
                fontSize: 10,
                position: 'right',
              }}
            />
            <Bar
              dataKey="avgSedeHours"
              name="Sede"
              stackId="h"
              fill={CHART_COLORS.primary}
            />
            <Bar
              dataKey="avgCampaignHours"
              name="Campañas"
              stackId="h"
              fill={CHART_COLORS.secondary}
              radius={[4, 4, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
