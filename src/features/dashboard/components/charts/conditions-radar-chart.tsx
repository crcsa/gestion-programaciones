'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
} from 'recharts'
import { ChartCard, CHART_PALETTE , CHART_TOOLTIP_CONTENT_STYLE } from './chart-card'
import type { RadarRow } from '../../lib/dashboard-queries'

interface Props {
  rows: RadarRow[]
}

const METRICS = [
  { key: 'extrasScore', label: 'Extras' },
  { key: 'overnightScore', label: 'Pernoctas' },
  { key: 'sundayScore', label: 'Domingos' },
  { key: 'campaignScore', label: 'Campañas' },
  { key: 'absenteeismScore', label: 'Ausentismo' },
] as const

export function ConditionsRadarChart({ rows }: Props) {
  // Pivote: cada métrica es un punto del radar; cada perfil es una serie.
  const data = useMemo(() => {
    return METRICS.map(({ key, label }) => {
      const point: Record<string, number | string> = { metric: label }
      for (const row of rows) {
        point[row.profileLabel] = row[key as keyof RadarRow] as number
      }
      return point
    })
  }, [rows])

  if (rows.length === 0) {
    return (
      <ChartCard
        title="Condiciones por perfil (mes)"
        description="Extras, pernoctas, domingos, campañas, ausentismo · 0-100"
      >
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin datos para los filtros aplicados.
        </p>
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title="Condiciones por perfil (mes)"
      description="Extras, pernoctas, domingos, campañas, ausentismo · 0-100 vs topes"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
            />
            {rows.map((r, i) => (
              <Radar
                key={r.profile}
                name={r.profileLabel}
                dataKey={r.profileLabel}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                fillOpacity={0.15}
              />
            ))}
            <Tooltip
              contentStyle={{ ...CHART_TOOLTIP_CONTENT_STYLE, fontSize: 12 }}
              formatter={(value) => `${String(value)}/100`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
