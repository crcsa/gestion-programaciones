import { requireAccess } from '@/features/auth/lib/require-access'
import { getWeeklyBalances } from '@/features/hours/actions/hours-actions'
import { WeeklyBalanceTable } from '@/features/hours/components/weekly-balance-table'
import { WeekSelector } from '@/features/availability/components/week-selector'
import { RecalculateButton } from '@/features/hours/components/recalculate-button'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import { getCurrentMondayIso } from '@/lib/date/week'

interface HorasPageProps {
  searchParams: Promise<{ semana?: string }>
}

export default async function HorasPage({ searchParams }: HorasPageProps) {
  // Comercial puede leer cross-área (read-only) además de admin global y admin_area.
  await requireAccess({ roles: ['admin', 'admin_area', 'comercial'] })

  const { semana } = await searchParams
  const weekStart = semana ?? getCurrentMondayIso()

  const [rows, cfg] = await Promise.all([
    getWeeklyBalances(weekStart),
    loadValidationRuntimeConfig(),
  ])

  // "Cumplieron contrato" = trabajaron las horas contratadas o más
  // (incluye horas_extras como subconjunto informativo).
  const cumplieron = rows.filter(
    (r) => r.balanceState === 'cumplió' || r.balanceState === 'horas_extras',
  ).length
  const disponibles = rows.filter((r) => r.balanceState === 'debe_horas').length
  const conExtras  = rows.filter((r) => r.balanceState === 'horas_extras').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Control de Horas</h1>
        <div className="flex items-center gap-2">
          <RecalculateButton weekStart={weekStart} />
          <WeekSelector weekStart={weekStart} paramName="semana" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Cumplieron contrato"
          hint={`Trabajaron ≥ ${cfg.weeklyHours}h`}
          value={cumplieron}
          color="green"
        />
        <StatCard
          label="Con horas extras"
          hint={`Superaron las ${cfg.weeklyHours}h pactadas`}
          value={conExtras}
          color="yellow"
        />
        <StatCard
          label="Disponibles"
          hint="Con capacidad para más trabajo"
          value={disponibles}
          color="blue"
        />
      </div>

      <WeeklyBalanceTable
        rows={rows}
        isLoading={false}
        contractHours={cfg.weeklyHours}
        extraHoursLimit={cfg.maxExtraHoursWeek}
      />
    </div>
  )
}

function StatCard({
  label,
  hint,
  value,
  color,
}: {
  label: string
  hint?: string
  value: number
  color: 'green' | 'yellow' | 'red' | 'blue'
}) {
  const colorClasses = {
    green:  'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    red:    'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
    blue:   'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-0.5 opacity-90">{label}</p>
      {hint && <p className="text-xs mt-0.5 opacity-70">{hint}</p>}
    </div>
  )
}
