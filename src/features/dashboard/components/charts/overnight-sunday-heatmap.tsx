'use client'

import { useMemo, useState } from 'react'
import { ChartCard } from './chart-card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PROFILE_LABELS, type StaffProfile } from '../../lib/filters'
import type { OvernightSundayCell } from '../../lib/dashboard-queries'

interface Props {
  data: OvernightSundayCell[]
}

function pernoctaClasses(n: number): string {
  if (n >= 2) return 'bg-red-500/20 text-red-700 dark:text-red-400'
  if (n === 1) return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
  return 'bg-green-500/10 text-green-700 dark:text-green-400'
}

function sundayClasses(n: number): string {
  if (n >= 3) return 'bg-red-500/20 text-red-700 dark:text-red-400'
  if (n >= 2) return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
  return 'bg-green-500/10 text-green-700 dark:text-green-400'
}

function riskBar(score: number): { className: string; label: string } {
  if (score >= 80) {
    return { className: 'bg-red-500', label: 'Crítico' }
  }
  if (score >= 50) {
    return { className: 'bg-yellow-500', label: 'Alto' }
  }
  if (score >= 25) {
    return { className: 'bg-blue-500', label: 'Medio' }
  }
  return { className: 'bg-emerald-500', label: 'Bajo' }
}

export function OvernightSundayHeatmap({ data }: Props) {
  const [profileFilter, setProfileFilter] = useState<string>('todos')

  const filtered = useMemo(() => {
    const base =
      profileFilter === 'todos'
        ? data
        : data.filter((d) => d.profile === profileFilter)
    return [...base].sort((a, b) => b.riskScore - a.riskScore)
  }, [data, profileFilter])

  return (
    <ChartCard
      title="Pernoctas y domingos del mes"
      description="Score de riesgo combinado · pernocta (60%) + domingo (40%)"
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Label htmlFor="heatmap-profile" className="mb-1.5 text-xs">
            Filtrar perfil
          </Label>
          <Select value={profileFilter} onValueChange={(v) => setProfileFilter(v ?? 'todos')}>
            <SelectTrigger id="heatmap-profile" className="h-8 w-full">
              <SelectValue>
                {profileFilter === 'todos'
                  ? 'Todos los perfiles'
                  : PROFILE_LABELS[profileFilter as StaffProfile]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los perfiles</SelectItem>
              {(Object.keys(PROFILE_LABELS) as StaffProfile[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PROFILE_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Mostrando {filtered.length} de {data.length}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Colaborador</th>
              <th className="pb-2 font-medium">Perfil</th>
              <th className="pb-2 text-right font-medium">Pernoctas</th>
              <th className="pb-2 text-right font-medium">Domingos</th>
              <th className="pb-2 font-medium">Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-muted-foreground">
                  Sin coincidencias para los filtros aplicados.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const risk = riskBar(row.riskScore)
                return (
                  <tr key={row.staffId} className="border-t border-border">
                    <td className="max-w-[180px] truncate py-2">{row.fullName}</td>
                    <td className="py-2 text-xs text-muted-foreground">{row.profileLabel}</td>
                    <td className="py-2 text-right">
                      <span className={`inline-block min-w-[2rem] rounded px-2 py-0.5 text-center text-xs font-medium ${pernoctaClasses(row.overnightCount)}`}>
                        {row.overnightCount}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={`inline-block min-w-[2rem] rounded px-2 py-0.5 text-center text-xs font-medium ${sundayClasses(row.sundayCount)}`}>
                        {row.sundayCount}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${risk.className} transition-all`}
                            style={{ width: `${row.riskScore}%` }}
                          />
                        </div>
                        <span className="min-w-12 text-xs text-muted-foreground">
                          {risk.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
