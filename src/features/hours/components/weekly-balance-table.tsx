'use client'

import { Badge } from '@/components/ui/badge'
import { HoursTrafficLight } from './hours-traffic-light'
import { WEEKLY_HOURS_CONTRACT } from '@/features/assignments/lib/validation-constants'
import type { WeeklyBalanceRow } from '../actions/hours-actions'

interface WeeklyBalanceTableProps {
  rows: WeeklyBalanceRow[]
  isLoading: boolean
}

const BALANCE_STATE_LABELS: Record<WeeklyBalanceRow['balanceState'], string> = {
  cumplió:     'Cumplió',
  horas_extras: 'Con extras',
  debe_horas:  'Debe horas',
}

const BALANCE_STATE_VARIANTS: Record<
  WeeklyBalanceRow['balanceState'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  cumplió:     'default',
  horas_extras: 'secondary',
  debe_horas:  'destructive',
}

const PROFILE_LABELS: Record<string, string> = {
  bacteriologo: 'Bacteriólogo',
  tecnico:      'Técnico',
  medico:       'Médico',
  auxiliar:     'Auxiliar',
  coordinador:  'Coordinador',
}

export function WeeklyBalanceTable({ rows, isLoading }: WeeklyBalanceTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Cargando balances...
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        No hay datos para la semana seleccionada.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Funcionario</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Perfil</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Sede</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Campaña</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Extras</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Dom.</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Pernoc.</th>
            <th className="px-4 py-2 text-center font-medium text-muted-foreground">Estado</th>
            <th className="px-4 py-2 text-center font-medium text-muted-foreground">Semáforo</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.staffId} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2 font-medium">
                {row.lastName}, {row.firstName}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {PROFILE_LABELS[row.staffProfile] ?? row.staffProfile}
              </td>
              <td className="px-4 py-2 text-right">{row.sedeHours}h</td>
              <td className="px-4 py-2 text-right">{row.campaignHours}h</td>
              <td className="px-4 py-2 text-right font-medium">{row.workedHours}h</td>
              <td className="px-4 py-2 text-right">
                {row.extraHours > 0 ? (
                  <span className="text-yellow-600 dark:text-yellow-400">+{row.extraHours}h</span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-2 text-right">{row.sundayCount}</td>
              <td className="px-4 py-2 text-right">{row.overnightCount}</td>
              <td className="px-4 py-2 text-center">
                <Badge variant={BALANCE_STATE_VARIANTS[row.balanceState]}>
                  {BALANCE_STATE_LABELS[row.balanceState]}
                </Badge>
              </td>
              <td className="px-4 py-2 text-center">
                <HoursTrafficLight workedHours={row.workedHours} size="sm" />
              </td>
              <td className="px-4 py-2 text-right">
                {(() => {
                  const diff = row.workedHours - WEEKLY_HOURS_CONTRACT
                  return (
                    <span
                      className={
                        diff > 0
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : diff < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                      }
                    >
                      {diff > 0 ? '+' : ''}{diff}h
                    </span>
                  )
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
