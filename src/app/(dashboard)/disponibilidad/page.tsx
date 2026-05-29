import { requireAccess } from '@/features/auth/lib/require-access'
import { getWeeklyAvailabilityGrid } from '@/features/availability/actions/availability-actions'
import { AvailabilityGrid } from '@/features/availability/components/availability-grid'
import { AvailabilityFilters } from '@/features/availability/components/availability-filters'
import { WeekSelector } from '@/features/availability/components/week-selector'
import { CapacityCalendar } from '@/features/availability/components/capacity-calendar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Users, CalendarRange } from 'lucide-react'
import { getCurrentMondayIso } from '@/lib/date/week'

interface DisponibilidadPageProps {
  searchParams: Promise<{ semana?: string; perfil?: string }>
}

export default async function DisponibilidadPage({ searchParams }: DisponibilidadPageProps) {
  const { role } = await requireAccess({ roles: ['admin', 'admin_area', 'comercial'] })

  // Admin global, admin_area de cualquier área y comercial (legacy o
  // admin_area + área=comercial) ven el grid semanal. Comercial ve cross-área
  // en read-only — el filtro de scope se aplica en la server action.
  const canSeeWeeklyGrid =
    role === 'admin' || role === 'admin_area' || role === 'comercial'
  const { semana, perfil } = await searchParams
  const weekStart = semana ?? getCurrentMondayIso()

  const rows = canSeeWeeklyGrid
    ? await getWeeklyAvailabilityGrid({
        weekStart,
        staffProfile: perfil as
          | 'bacteriologo'
          | 'tecnico'
          | 'medico'
          | 'auxiliar'
          | 'comercial'
          | undefined,
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

      <Tabs defaultValue="weekly" className="flex-col">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-9 w-fit p-1">
            <TabsTrigger value="weekly" className="h-7 flex-none gap-1.5 px-3">
              <Users className="size-3.5" aria-hidden />
              Semanal por persona
            </TabsTrigger>
            <TabsTrigger value="capacity" className="h-7 flex-none gap-1.5 px-3">
              <CalendarRange className="size-3.5" aria-hidden />
              Capacidad mensual
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="weekly" className="space-y-4 pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <AvailabilityFilters currentProfile={perfil ?? ''} />
            <WeekSelector weekStart={weekStart} paramName="semana" />
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <LegendItem color="bg-background border border-border" label="Libre" />
            <LegendItem color="bg-blue-100 dark:bg-blue-900/40" label="En sede" />
            <LegendItem color="bg-rose-100 dark:bg-rose-900/40" label="Servicios transfusionales" />
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
