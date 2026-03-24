import { requireRole } from '@/features/auth/lib/require-role'
import { getWeeklyBalances } from '@/features/hours/actions/hours-actions'
import { WeeklyBalanceTable } from '@/features/hours/components/weekly-balance-table'
import { WeekSelector } from '@/features/availability/components/week-selector'
import { RecalculateButton } from '@/features/hours/components/recalculate-button'

interface HorasPageProps {
  searchParams: Promise<{ semana?: string }>
}

function getCurrentMondayISO(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export default async function HorasPage({ searchParams }: HorasPageProps) {
  await requireRole(['admin', 'banco_sangre'])

  const { semana } = await searchParams
  const weekStart = semana ?? getCurrentMondayISO()

  const rows = await getWeeklyBalances(weekStart)

  const cumplieron = rows.filter((r) => r.balanceState === 'cumplió').length
  const debenHoras = rows.filter((r) => r.balanceState === 'debe_horas').length
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
        <StatCard label="Cumplieron contrato" value={cumplieron} color="green" />
        <StatCard label="Con horas extras"    value={conExtras}  color="yellow" />
        <StatCard label="Deben horas"         value={debenHoras} color="red" />
      </div>

      <WeeklyBalanceTable rows={rows} isLoading={false} />
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'green' | 'yellow' | 'red'
}) {
  const colorClasses = {
    green:  'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    red:    'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-0.5 opacity-80">{label}</p>
    </div>
  )
}
