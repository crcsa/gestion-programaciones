import { Clock, Moon, ClipboardList, Truck } from 'lucide-react'
import { StatCard } from '@/components/data-display/stat-card'
import { WeeklyCalendarView } from '@/components/data-display/weekly-calendar-view'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import { getMyHoursTrend } from '../../lib/dashboard-queries'
import {
  getMyWeeklyBreakdown,
  getMyMonthlyProgression,
  getMyDriverCampaigns,
  getMyLatestVehicle,
  getMyWeekAvailability,
} from '../../lib/operativo-queries'
import { PersonalHoursChart } from '../charts/personal-hours-chart'
import { MonthlyProgressionChart } from '../charts/monthly-progression-chart'
import { QuotaCard } from './operativo-kpi-cards'

interface Props {
  staffId: string
}

/**
 * Dashboard para conductores (logística): sus campañas vienen de
 * `campaign_vehicles.driver_staff_id`, no de `campaign_assignments`.
 */
export async function ConductorDashboard({ staffId }: Props) {
  const [
    trend,
    breakdown,
    progression,
    driverCampaigns,
    vehicle,
    availability,
    cfg,
  ] = await Promise.all([
    getMyHoursTrend(staffId, 8),
    getMyWeeklyBreakdown(staffId, 8),
    getMyMonthlyProgression(staffId, 6),
    getMyDriverCampaigns(staffId),
    getMyLatestVehicle(staffId),
    getMyWeekAvailability(staffId),
    loadValidationRuntimeConfig(),
  ])

  const thisMonth = progression[progression.length - 1]
  const thisWeek = breakdown[breakdown.length - 1]
  const weeklyHoursSum = thisWeek.sedeHours + thisWeek.campaignHours

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Horas esta semana"
          value={`${weeklyHoursSum}h / ${cfg.weeklyHours}h`}
          icon={Clock}
          description="Horas de conducción"
        />
        <QuotaCard
          title="Pernoctas del mes"
          current={thisMonth.overnightCount}
          max={cfg.maxOvernightsMonth}
          icon={Moon}
        />
        <StatCard
          title="Campañas del mes"
          value={thisMonth.campaignCount}
          icon={ClipboardList}
          description="Rutas registradas"
        />
        <StatCard
          title="Mi vehículo"
          value={vehicle?.plate ?? 'Sin asignar'}
          icon={Truck}
          description={
            vehicle
              ? [vehicle.mobileNumber ? `Móvil ${vehicle.mobileNumber}` : null, vehicle.model]
                  .filter(Boolean)
                  .join(' · ') || 'Asignación más reciente'
              : 'No tienes vehículo asignado'
          }
        />
      </div>

      <WeeklyCalendarView
        shifts={[]}
        campaigns={driverCampaigns}
        coordinatorIds={[]}
        availability={availability}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PersonalHoursChart data={trend} contractHours={cfg.weeklyHours} />
        <MonthlyProgressionChart data={progression} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis próximas campañas</CardTitle>
        </CardHeader>
        <CardContent>
          {driverCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tienes campañas asignadas en los próximos 30 días.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {driverCampaigns.map((c) => (
                <div
                  key={c.campaignVehicleId}
                  className="flex items-center justify-between py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.code} — {c.municipality}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.campaignDate}
                      {c.startTime ? ` · ${c.startTime}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-3 shrink-0">
                    {c.plate}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
