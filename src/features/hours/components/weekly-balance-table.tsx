'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HoursTrafficLight } from './hours-traffic-light'
import type { WeeklyBalanceRow } from '../actions/hours-actions'

interface WeeklyBalanceTableProps {
  rows: WeeklyBalanceRow[]
  isLoading: boolean
  contractHours: number
  extraHoursLimit: number
}

type StateFilter = 'todos' | WeeklyBalanceRow['balanceState']

const BALANCE_STATE_LABELS: Record<WeeklyBalanceRow['balanceState'], string> = {
  cumplió:     'Cumplió',
  horas_extras: 'Con extras',
  debe_horas:  'Disponible',
}

const BALANCE_STATE_VARIANTS: Record<
  WeeklyBalanceRow['balanceState'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  cumplió:     'default',
  horas_extras: 'destructive',
  debe_horas:  'outline',
}

const BALANCE_STATE_CLASSES: Record<WeeklyBalanceRow['balanceState'], string> = {
  cumplió:      '',
  horas_extras: '',
  debe_horas:   'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400 dark:border-blue-500/50',
}

const PROFILE_LABELS: Record<string, string> = {
  bacteriologo: 'Bacteriólogo',
  tecnico:      'Técnico',
  medico:       'Médico',
  auxiliar:     'Auxiliar',
}

export function WeeklyBalanceTable({
  rows,
  isLoading,
  contractHours,
  extraHoursLimit,
}: WeeklyBalanceTableProps) {
  const [search, setSearch] = useState('')
  const [perfil, setPerfil] = useState<string>('todos')
  const [estado, setEstado] = useState<StateFilter>('todos')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const result = rows.filter((r) => {
      if (q) {
        const hay = `${r.firstName} ${r.lastName}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (perfil !== 'todos' && r.staffProfile !== perfil) return false
      if (estado !== 'todos' && r.balanceState !== estado) return false
      return true
    })
    // Orden descendente por horas trabajadas, desempate alfabético
    return [...result].sort((a, b) => {
      if (b.workedHours !== a.workedHours) return b.workedHours - a.workedHours
      return a.lastName.localeCompare(b.lastName)
    })
  }, [rows, search, perfil, estado])

  const hasActive = search.trim() !== '' || perfil !== 'todos' || estado !== 'todos'

  function clearFilters() {
    setSearch('')
    setPerfil('todos')
    setEstado('todos')
  }

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
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="flex-1 min-w-0 sm:min-w-48">
          <Label htmlFor="hours-search" className="mb-1.5 text-xs">
            Buscar
          </Label>
          <Input
            id="hours-search"
            placeholder="Nombre o apellido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="hours-perfil" className="mb-1.5 text-xs">
            Perfil
          </Label>
          <Select value={perfil} onValueChange={(v) => setPerfil(v ?? 'todos')}>
            <SelectTrigger id="hours-perfil" className="h-9 w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="bacteriologo">Bacteriólogo</SelectItem>
              <SelectItem value="tecnico">Técnico</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="auxiliar">Auxiliar</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="hours-estado" className="mb-1.5 text-xs">
            Estado balance
          </Label>
          <Select value={estado} onValueChange={(v) => setEstado((v ?? 'todos') as StateFilter)}>
            <SelectTrigger id="hours-estado" className="h-9 w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="cumplió">Cumplió</SelectItem>
              <SelectItem value="horas_extras">Con extras</SelectItem>
              <SelectItem value="debe_horas">Disponible</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 self-end rounded-md border border-border bg-background px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Mostrando {filtered.length} de {rows.length} colaboradores.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Colaborador</th>
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
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-6 text-center text-sm text-muted-foreground">
                Sin coincidencias para los filtros aplicados.
              </td>
            </tr>
          ) : null}
          {filtered.map((row) => (
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
                <Badge
                  variant={BALANCE_STATE_VARIANTS[row.balanceState]}
                  className={BALANCE_STATE_CLASSES[row.balanceState] || undefined}
                >
                  {BALANCE_STATE_LABELS[row.balanceState]}
                </Badge>
              </td>
              <td className="px-4 py-2 text-center">
                <HoursTrafficLight
                  workedHours={row.workedHours}
                  scheduledHours={contractHours}
                  extraHoursLimit={extraHoursLimit}
                  size="sm"
                />
              </td>
              <td className="px-4 py-2 text-right">
                {(() => {
                  const diff = row.workedHours - contractHours
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
    </div>
  )
}
