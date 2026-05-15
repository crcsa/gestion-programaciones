'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CHART_COLORS , CHART_TOOLTIP_CONTENT_STYLE } from './chart-card'
import {
  parseDashboardFilters,
  serializeDashboardFilters,
  PERIOD_LABELS,
} from '../../lib/filters'
import type { StaffBalanceRow } from '../../lib/dashboard-queries'

interface Props {
  rows: StaffBalanceRow[]
  contractHours: number
  extraHoursLimit: number
  topN?: number
}

export function BalanceHeroChart({
  rows,
  contractHours,
  extraHoursLimit,
  topN = 20,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filters = parseDashboardFilters(
    new URLSearchParams(searchParams?.toString() ?? ''),
  )

  const data = useMemo(() => rows.slice(0, topN), [rows, topN])
  const allZero =
    rows.length === 0 || rows.every((r) => r.workedHours === 0)

  const switchToLastWeek = () => {
    const qs = serializeDashboardFilters({
      ...filters,
      period: 'lastWeek',
    }).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const goToStaff = (staffId: string) => {
    router.push(`/personal/${staffId}/editar`)
  }

  const chartHeight = Math.max(220, data.length * 24 + 64)
  const limit = contractHours + extraHoursLimit

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <CardTitle className="text-base">Balance por persona</CardTitle>
            <p className="text-xs text-muted-foreground">
              {PERIOD_LABELS[filters.period]} · línea de contrato {contractHours}h, tope extras {limit}h
              {filters.profile ? ` · perfil filtrado` : ''}
              {filters.municipality ? ` · ${filters.municipality}` : ''}
              {rows.length > topN ? ` · top ${topN} de ${rows.length}` : ''}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {allZero ? (
          <EmptyState
            isThisWeek={filters.period === 'thisWeek'}
            onLastWeek={switchToLastWeek}
          />
        ) : (
          <div style={{ height: chartHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 0, left: 140 }}
                onClick={(state: unknown) => {
                  const s = state as { activePayload?: Array<{ payload?: StaffBalanceRow }> }
                  const row = s?.activePayload?.[0]?.payload
                  if (row) goToStaff(row.staffId)
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="fullName"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  width={140}
                  tickFormatter={(v: string) =>
                    v.length > 22 ? `${v.slice(0, 21)}…` : v
                  }
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.25 }}
                  contentStyle={{ ...CHART_TOOLTIP_CONTENT_STYLE, fontSize: 12 }}
                  formatter={(value, name) => [`${String(value)}h`, name as string]}
                  labelFormatter={(label) => String(label ?? '')}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  x={contractHours}
                  stroke={CHART_COLORS.tertiary}
                  strokeDasharray="4 4"
                  label={{
                    value: 'Contrato',
                    fill: CHART_COLORS.tertiary,
                    fontSize: 10,
                    position: 'top',
                  }}
                />
                <ReferenceLine
                  x={limit}
                  stroke={CHART_COLORS.quinary}
                  strokeDasharray="4 4"
                  label={{
                    value: 'Tope extras',
                    fill: CHART_COLORS.quinary,
                    fontSize: 10,
                    position: 'top',
                  }}
                />
                <Bar
                  dataKey="sedeHours"
                  name="Sede"
                  stackId="h"
                  fill={CHART_COLORS.primary}
                  cursor="pointer"
                />
                <Bar
                  dataKey="campaignHours"
                  name="Campañas"
                  stackId="h"
                  fill={CHART_COLORS.secondary}
                  cursor="pointer"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({
  isThisWeek,
  onLastWeek,
}: {
  isThisWeek: boolean
  onLastWeek: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        No hay horas registradas para el periodo seleccionado.
      </p>
      {isThisWeek && (
        <>
          <p className="text-xs text-muted-foreground">
            Los balances de la semana en curso se recalculan al cierre de turnos.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onLastWeek}>
            Ver semana pasada
          </Button>
        </>
      )}
    </div>
  )
}
