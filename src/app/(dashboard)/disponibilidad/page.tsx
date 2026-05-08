import { requireRole } from '@/features/auth/lib/require-role'
import { getWeeklyAvailabilityGrid } from '@/features/availability/actions/availability-actions'
import { AvailabilityGrid } from '@/features/availability/components/availability-grid'
import { AvailabilityFilters } from '@/features/availability/components/availability-filters'
import { WeekSelector } from '@/features/availability/components/week-selector'
import { CapacityCalendar } from '@/features/availability/components/capacity-calendar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

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
  const { role } = await requireRole(['admin', 'banco_sangre', 'comercial'])

  const canSeeWeeklyGrid = role === 'admin' || role === 'banco_sangre'
  const { semana, perfil } = await searchParams
  const weekStart = semana ?? getCurrentMondayISO()

  const rows = canSeeWeeklyGrid
    ? await getWeeklyAvailabilityGrid({
        weekStart,
        staffProfile: perfil as 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar' | 'coordinador' | undefined,
      })
    : []

  if (!canSeeWeeklyGrid) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Capacidad de personal</h1>
        <p className="text-sm text-muted-foreground">
          Vista mensual de capacidad disponible para programar campañas.
        </p>
        <CapacityCalendar />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Disponibilidad</h1>

      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">Semanal por persona</TabsTrigger>
          <TabsTrigger value="capacity">Capacidad mensual</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4 pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <AvailabilityFilters currentProfile={perfil ?? ''} />
            <WeekSelector weekStart={weekStart} paramName="semana" />
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
        </TabsContent>

        <TabsContent value="capacity" className="pt-4">
          <CapacityCalendar />
        </TabsContent>
      </Tabs>
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
