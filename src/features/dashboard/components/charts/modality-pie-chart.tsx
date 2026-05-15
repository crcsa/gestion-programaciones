'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import { ChartCard, CHART_PALETTE , CHART_TOOLTIP_CONTENT_STYLE } from './chart-card'
import type { ModalityShare } from '../../lib/dashboard-queries'

const MODALITY_LABELS: Record<string, string> = {
  corporativa: 'Corporativa',
  carpa: 'Carpa',
  unidad_movil: 'Unidad móvil',
  municipal: 'Municipal',
  combinada: 'Combinada',
}

interface Props {
  data: ModalityShare[]
}

export function ModalityPieChart({ data }: Props) {
  const display = data.map((d) => ({
    ...d,
    label: MODALITY_LABELS[d.modality] ?? d.modality,
  }))

  return (
    <ChartCard
      title="Distribución por modalidad"
      description="Campañas en los últimos 3 meses"
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
              outerRadius={80}
              label={(props: { name?: string; value?: number }) =>
                `${props.name ?? ''} (${props.value ?? 0})`
              }
            >
              {display.map((entry, idx) => (
                <Cell key={entry.modality} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
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
