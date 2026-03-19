import { requireRole } from '@/features/auth/lib/require-role'
import { getWeeklyAvailabilityGrid } from '@/features/availability/actions/availability-actions'
import { AvailabilityGrid } from '@/features/availability/components/availability-grid'
import { AvailabilityFilters } from '@/features/availability/components/availability-filters'
import { WeekSelector } from '@/features/availability/components/week-selector'

interface DisponibilidadPageProps {
  searchParams: Promise<{ semana?: string; perfil?: string }>
}

function getCurrentMondayISO(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export default async function DisponibilidadPage({ searchParams }: DisponibilidadPageProps) {
  await requireRole(['admin', 'banco_sangre'])

  const { semana, perfil } = await searchParams
  const weekStart = semana ?? getCurrentMondayISO()

  const rows = await getWeeklyAvailabilityGrid({
    weekStart,
    staffProfile: perfil as 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar' | 'coordinador' | undefined,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Disponibilidad</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <AvailabilityFilters currentProfile={perfil ?? ''} />
          <WeekSelector weekStart={weekStart} paramName="semana" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <LegendItem color="bg-background border border-border" label="Libre" />
        <LegendItem color="bg-blue-100 dark:bg-blue-900/40" label="En sede" />
        <LegendItem color="bg-green-100 dark:bg-green-900/40" label="En campaña" />
        <LegendItem color="bg-orange-100 dark:bg-orange-900/40" label="Vacaciones" />
        <LegendItem color="bg-red-100 dark:bg-red-900/40" label="Incapacidad" />
        <LegendItem color="bg-gray-100 dark:bg-gray-800" label="Licencia" />
      </div>

      <AvailabilityGrid rows={rows} weekStart={weekStart} />
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3 w-5 rounded ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}
