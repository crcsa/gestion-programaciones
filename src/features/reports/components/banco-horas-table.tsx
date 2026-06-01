'use client'

import { useMemo, useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getBancoHorasReport,
  type BancoHorasReportRow,
} from '../actions/banco-horas-actions'
import { exportToExcel } from '@/lib/excel/export-utils'
import { STAFF_PROFILE_LABELS, type StaffProfile } from '@/features/staff/lib/constants'
import { AREA_LABELS, VALID_AREAS, type Area } from '@/types/areas'
import type { Role } from '@/types/roles'

type Granularity = 'mensual' | 'quincenal_q1' | 'quincenal_q2'

interface BancoHorasTableProps {
  initialData: BancoHorasReportRow[]
  currentRole: Role
  callerArea: Area | null
  initialYear: number
  initialMonth: number
}

const STATE_LABELS: Record<BancoHorasReportRow['state'], string> = {
  cumplio: 'Cumplió',
  debe: 'Debe',
  compensatorio: 'Compensatorio',
}

const STATE_VARIANTS: Record<
  BancoHorasReportRow['state'],
  'default' | 'destructive' | 'outline'
> = {
  cumplio: 'outline',
  debe: 'destructive',
  compensatorio: 'outline',
}

const STATE_CLASSES: Record<BancoHorasReportRow['state'], string> = {
  cumplio:
    'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400 dark:border-green-500/50',
  debe: '',
  compensatorio:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:border-amber-500/50',
}

/**
 * Escala de colores para "Horas trabajadas" según progreso hacia la jornada
 * normal (44h). `0h` se queda neutro (sin marcar) porque suele indicar staff
 * sin asignaciones aún en el periodo, no incumplimiento real.
 */
function workedHoursClass(hours: number): string {
  if (hours <= 0) return 'text-muted-foreground'
  if (hours >= 44) return 'text-green-600 dark:text-green-400 font-medium'
  if (hours >= 33) return 'text-lime-600 dark:text-lime-400'
  if (hours >= 22) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function formatMonthInput(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseMonthInput(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

function flattenRows(rows: BancoHorasReportRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    Colaborador: `${r.lastName}, ${r.firstName}`,
    Perfil: STAFF_PROFILE_LABELS[r.staffProfile as StaffProfile] ?? r.staffProfile,
    Area: AREA_LABELS[r.area],
    'Horas trabajadas': r.workedHours,
    'Delta banco': r.bankDelta,
    'Saldo mes': r.bankBalanceMonth,
    Semanas: r.weeksCount,
    Estado: STATE_LABELS[r.state],
  }))
}

export function BancoHorasTable({
  initialData,
  currentRole,
  callerArea,
  initialYear,
  initialMonth,
}: BancoHorasTableProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [granularity, setGranularity] = useState<Granularity>('mensual')
  // Admin global: 'todas' = null (cross-area). Admin_area: fijado a su area.
  const [areaFilter, setAreaFilter] = useState<Area | 'todas'>('todas')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<BancoHorasReportRow[]>(initialData)
  const [loading, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const canSelectArea = currentRole === 'admin'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const hay = `${r.firstName} ${r.lastName} ${r.staffProfile}`.toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search])

  function reload(opts: {
    year?: number
    month?: number
    granularity?: Granularity
    area?: Area | 'todas'
  }) {
    const nextYear = opts.year ?? year
    const nextMonth = opts.month ?? month
    const nextGran = opts.granularity ?? granularity
    const nextArea = opts.area ?? areaFilter

    setError(null)
    startTransition(async () => {
      try {
        const areaParam = canSelectArea
          ? nextArea === 'todas'
            ? null
            : nextArea
          : null // admin_area: el server lo ancla a su scope.area
        const data = await getBancoHorasReport({
          year: nextYear,
          month: nextMonth,
          granularity: nextGran,
          area: areaParam,
        })
        setRows(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar el reporte')
      }
    })
  }

  function handleMonthChange(value: string) {
    const parsed = parseMonthInput(value)
    if (!parsed) return
    setYear(parsed.year)
    setMonth(parsed.month)
    reload({ year: parsed.year, month: parsed.month })
  }

  function handleGranularityChange(g: Granularity) {
    setGranularity(g)
    reload({ granularity: g })
  }

  function handleAreaChange(v: Area | 'todas') {
    setAreaFilter(v)
    reload({ area: v })
  }

  function handleExport() {
    const fileName = `banco-horas-${year}-${String(month).padStart(2, '0')}`
    exportToExcel(flattenRows(filtered), 'Banco de horas', fileName)
  }

  const periodLabel =
    granularity === 'mensual'
      ? 'Mensual'
      : granularity === 'quincenal_q1'
        ? 'Q1 (1–14)'
        : 'Q2 (15–fin)'

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Las semanas se asignan al mes del lunes (<code>weekStart</code>). El saldo es solo
          informativo; la app no modifica metas semanales.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="banco-month">Mes</Label>
            <Input
              id="banco-month"
              type="month"
              value={formatMonthInput(year, month)}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Periodo</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={granularity === 'mensual' ? 'default' : 'outline'}
                onClick={() => handleGranularityChange('mensual')}
                disabled={loading}
              >
                Mensual
              </Button>
              <Button
                type="button"
                size="sm"
                variant={granularity === 'quincenal_q1' ? 'default' : 'outline'}
                onClick={() => handleGranularityChange('quincenal_q1')}
                disabled={loading}
              >
                Q1
              </Button>
              <Button
                type="button"
                size="sm"
                variant={granularity === 'quincenal_q2' ? 'default' : 'outline'}
                onClick={() => handleGranularityChange('quincenal_q2')}
                disabled={loading}
              >
                Q2
              </Button>
            </div>
          </div>

          {canSelectArea && (
            <div className="space-y-1.5">
              <Label htmlFor="banco-area">Área</Label>
              <Select
                value={areaFilter}
                onValueChange={(v) => handleAreaChange((v ?? 'todas') as Area | 'todas')}
              >
                <SelectTrigger id="banco-area" className="w-44">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {VALID_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AREA_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!canSelectArea && callerArea && (
            <div className="space-y-1.5">
              <Label className="text-xs">Área</Label>
              <div className="h-9 flex items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">
                {AREA_LABELS[callerArea]} (fijada)
              </div>
            </div>
          )}

          <div className="flex-1 min-w-48 space-y-1.5">
            <Label htmlFor="banco-search">Buscar</Label>
            <Input
              id="banco-search"
              placeholder="Nombre o perfil..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filtered.length === 0 || loading}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Periodo: <strong>{periodLabel}</strong> · Mostrando {filtered.length} de {rows.length}{' '}
        colaborador{rows.length === 1 ? '' : 'es'}.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Colaborador
              </th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Perfil</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Área</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Horas trabajadas
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Δ Banco
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Saldo mes
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Semanas
              </th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Cargando reporte...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Sin coincidencias para los filtros aplicados.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const deltaCls =
                  row.bankDelta > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : row.bankDelta < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                const balanceCls =
                  row.bankBalanceMonth >= 1
                    ? 'text-amber-600 dark:text-amber-400'
                    : row.bankBalanceMonth <= -1
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                const balanceLabel =
                  row.bankBalanceMonth <= -1
                    ? `Debe ${Math.abs(row.bankBalanceMonth)}h`
                    : row.bankBalanceMonth >= 1
                      ? `+${row.bankBalanceMonth}h`
                      : '0h'
                return (
                  <tr
                    key={row.staffId}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2 font-medium">
                      {row.lastName}, {row.firstName}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {STAFF_PROFILE_LABELS[row.staffProfile as StaffProfile] ?? row.staffProfile}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{AREA_LABELS[row.area]}</td>
                    <td className={`px-4 py-2 text-right ${workedHoursClass(row.workedHours)}`}>
                      {row.workedHours}h
                    </td>
                    <td className={`px-4 py-2 text-right ${deltaCls}`}>
                      {row.bankDelta > 0 ? '+' : ''}
                      {row.bankDelta}h
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${balanceCls}`}>
                      {balanceLabel}
                    </td>
                    <td className="px-4 py-2 text-right">{row.weeksCount}</td>
                    <td className="px-4 py-2 text-center">
                      <Badge
                        variant={STATE_VARIANTS[row.state]}
                        className={STATE_CLASSES[row.state] || undefined}
                      >
                        {STATE_LABELS[row.state]}
                      </Badge>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
