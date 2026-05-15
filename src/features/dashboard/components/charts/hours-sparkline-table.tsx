'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  YAxis,
} from 'recharts'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CHART_COLORS } from './chart-card'
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import type { SparklineRow } from '../../lib/dashboard-queries'

const COLUMN_INFO: Record<string, string> = {
  colaborador: 'Persona del personal activo. Click en la fila para ir a su ficha.',
  perfil: 'Cargo asignado en la organización (Bacteriólogo, Técnico, Médico, Auxiliar, Coordinador, Comercial).',
  tendencia:
    'Mini-gráfica de horas trabajadas en las últimas 8 semanas. La línea punteada naranja marca las horas de contrato.',
  cumplimiento:
    'Cada cuadrito representa una semana coloreada según las horas trabajadas vs contrato. Hover para ver el detalle por semana.',
  semana: 'Horas registradas en la semana en curso (sede + campaña).',
  delta: 'Diferencia en horas frente a la semana anterior. Positivo = más carga, negativo = menos.',
  trend:
    'Pendiente de la línea de regresión sobre las 8 semanas. Subiendo/Bajando si la pendiente supera ±2h por semana; Estable en caso contrario.',
}

function HeaderCell({
  label,
  infoKey,
  align = 'left',
  minWidth,
}: {
  label: string
  infoKey: keyof typeof COLUMN_INFO
  align?: 'left' | 'right' | 'center'
  minWidth?: number
}) {
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  const textAlign =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th
      className={`px-3 py-2 font-medium text-muted-foreground ${textAlign}`}
      style={minWidth ? { minWidth } : undefined}
    >
      <span className={`inline-flex w-full items-center gap-1.5 ${justify}`}>
        <span>{label}</span>
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label={`Información sobre ${label}`}
            className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
            {COLUMN_INFO[infoKey]}
          </TooltipContent>
        </Tooltip>
      </span>
    </th>
  )
}

interface Props {
  rows: SparklineRow[]
}

export function HoursSparklineTable({ rows }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.fullName.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Tendencia individual · 8 semanas
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Mini-tendencia + cumplimiento semanal por persona (línea de contrato como referencia)
            </p>
          </div>
          <Input
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full max-w-xs sm:w-56"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ComplianceLegend />
        <TooltipProvider delay={150}>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <HeaderCell label="Colaborador" infoKey="colaborador" />
                <HeaderCell label="Perfil" infoKey="perfil" />
                <HeaderCell label="Tendencia 8 sem." infoKey="tendencia" minWidth={220} />
                <HeaderCell label="Cumplimiento" infoKey="cumplimiento" minWidth={180} />
                <HeaderCell label="Sem. actual" infoKey="semana" align="right" />
                <HeaderCell label="Δ vs ant." infoKey="delta" align="right" />
                <HeaderCell label="Trend" infoKey="trend" align="center" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    Sin coincidencias.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const lastWeek = row.weeklyValues[row.weeklyValues.length - 1]
                  return (
                    <tr
                      key={row.staffId}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                      onClick={() => router.push(`/personal/${row.staffId}/editar`)}
                    >
                      <td className="px-3 py-2 align-middle font-medium">{row.fullName}</td>
                      <td className="px-3 py-2 align-middle text-muted-foreground">{row.profileLabel}</td>
                      <td className="px-3 py-2 align-middle">
                        <Sparkline values={row.weeklyValues} contract={row.contractHours} />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <ComplianceStrip
                          values={row.weeklyValues}
                          contract={row.contractHours}
                        />
                      </td>
                      <td className="px-3 py-2 text-right align-middle font-medium tabular-nums">
                        {lastWeek}h
                      </td>
                      <td className="px-3 py-2 text-right align-middle">
                        <DeltaBadge delta={row.delta} />
                      </td>
                      <td className="px-3 py-2 text-center align-middle">
                        <TrendBadge trend={row.trend} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}

function Sparkline({ values, contract }: { values: number[]; contract: number }) {
  const data = values.map((v, i) => ({ idx: i, value: v }))
  const max = Math.max(contract, ...values, 1)
  return (
    <div className="h-9 w-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={[0, max]} hide />
          <ReferenceLine y={contract} stroke={CHART_COLORS.tertiary} strokeDasharray="2 2" />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

type ComplianceBand = 'empty' | 'low' | 'high' | 'ok' | 'over'

const BAND_META: Record<ComplianceBand, { color: string; label: string }> = {
  empty: { color: 'rgba(148, 163, 184, 0.45)', label: 'Sin datos' },
  low: { color: '#f43f5e', label: 'Muy bajo' },
  high: { color: '#f59e0b', label: 'Bajo' },
  ok: { color: '#10b981', label: 'En contrato' },
  over: { color: '#0ea5e9', label: 'Sobre contrato' },
}

function classifyWeek(value: number, contract: number): ComplianceBand {
  if (value <= 0) return 'empty'
  if (contract <= 0) return 'ok'
  const ratio = value / contract
  if (ratio < 0.6) return 'low'
  if (ratio < 0.9) return 'high'
  if (ratio <= 1.1) return 'ok'
  return 'over'
}

function ComplianceStrip({ values, contract }: { values: number[]; contract: number }) {
  const total = values.length
  return (
    <div className="flex items-center gap-[3px]" role="img" aria-label="Cumplimiento semanal">
      {values.map((v, i) => {
        const band = classifyWeek(v, contract)
        const meta = BAND_META[band]
        const weeksAgo = total - 1 - i
        const tooltip =
          weeksAgo === 0
            ? `Sem actual · ${v}h · ${meta.label}`
            : `Hace ${weeksAgo} sem · ${v}h · ${meta.label}`
        return (
          <span
            key={i}
            title={tooltip}
            className="h-5 w-3.5 rounded-sm transition-transform duration-150 hover:scale-y-125"
            style={{ backgroundColor: meta.color }}
          />
        )
      })}
    </div>
  )
}

function ComplianceLegend() {
  const items: { band: ComplianceBand; text: string }[] = [
    { band: 'low', text: '< 60%' },
    { band: 'high', text: '60–90%' },
    { band: 'ok', text: '90–110%' },
    { band: 'over', text: '> 110%' },
    { band: 'empty', text: 'Sin datos' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-1 text-[11px] text-muted-foreground">
      <span className="font-medium uppercase tracking-wide">Cumplimiento:</span>
      {items.map(({ band, text }) => (
        <span key={band} className="inline-flex items-center gap-1">
          <span
            className="inline-block h-3 w-3.5 rounded-sm"
            style={{ backgroundColor: BAND_META[band].color }}
          />
          {text}
        </span>
      ))}
    </div>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-muted-foreground">0h</span>
  const positive = delta > 0
  return (
    <span
      className={
        positive
          ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-red-600 dark:text-red-400'
      }
    >
      {positive ? '+' : ''}
      {delta}h
    </span>
  )
}

function TrendBadge({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return (
      <Badge variant="outline" className="gap-1 border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
        <TrendingUp className="size-3" />
        Subiendo
      </Badge>
    )
  }
  if (trend === 'down') {
    return (
      <Badge variant="outline" className="gap-1 border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400">
        <TrendingDown className="size-3" />
        Bajando
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Minus className="size-3" />
      Estable
    </Badge>
  )
}
