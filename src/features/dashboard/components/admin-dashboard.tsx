import { Users, Megaphone, UserCheck, AlertTriangle, Truck, UserSquare2 } from 'lucide-react'
import { DashboardKpiCard } from './dashboard-kpi-card'
import type { AdminDashboardData } from '../actions/dashboard-actions'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import {
  getCampaignsTrendByMonth,
  getCampaignsByStatusDistribution,
  getOvernightSundayHeatmap,
  getMonthlyAlerts,
  getStaffWeeklyBalance,
  getHoursByProfile,
  getConditionsRadarByProfile,
  getHoursSparkline,
  getCriticalAlerts,
  getCampaignMunicipalities,
} from '../lib/dashboard-queries'
import {
  parseDashboardFilters,
  type DashboardFilters,
} from '../lib/filters'
import { DashboardToolbar } from './dashboard-toolbar'
import { DashboardAlertBar } from './dashboard-alert-bar'
import { CampaignsTrendChart } from './charts/campaigns-trend-chart'
import { StatusDistributionChart } from './charts/status-distribution-chart'
import { BalanceHeroChart } from './charts/balance-hero-chart'
import { ProfileHoursChart } from './charts/profile-hours-chart'
import { ConditionsRadarChart } from './charts/conditions-radar-chart'
import { AdminDashboardTabs } from './admin-dashboard-tabs'
import { getCurrentUserContext } from '@/features/auth/lib/user-context'
import { getLogisticaKpis } from '../lib/logistica-queries'

interface Props {
  data: AdminDashboardData
  searchParams?: Record<string, string | string[] | undefined>
}

export async function AdminDashboard({ data, searchParams }: Props) {
  const filters: DashboardFilters = parseDashboardFilters(searchParams ?? {})
  const ctx = await getCurrentUserContext()
  // Solo admin global y comercial pueden cambiar de área desde el toolbar.
  const canSwitchArea = ctx?.role === 'admin' || ctx?.role === 'comercial'

  const [
    cfg,
    municipalities,
    criticalAlerts,
    balanceRows,
    profileHours,
    radarRows,
    sparklineRows,
    trend,
    statusDist,
    heatmap,
    alerts,
  ] = await Promise.all([
    loadValidationRuntimeConfig(),
    getCampaignMunicipalities(),
    getCriticalAlerts(filters),
    getStaffWeeklyBalance(filters),
    getHoursByProfile(filters),
    getConditionsRadarByProfile(filters),
    getHoursSparkline(filters, 8),
    getCampaignsTrendByMonth(6, filters.area),
    getCampaignsByStatusDistribution(filters.area),
    getOvernightSundayHeatmap(filters.area),
    getMonthlyAlerts(filters.area),
  ])

  const totalAlerts = alerts.overSundays + alerts.overOvernights
  const showLogisticaKpis = filters.area === 'logistica'
  const logisticaKpis = showLogisticaKpis ? await getLogisticaKpis() : null

  return (
    <>
      <DashboardToolbar municipalities={municipalities} showAreaSelector={canSwitchArea} />
      <div className="space-y-5">
      <DashboardAlertBar alerts={criticalAlerts} />

      {showLogisticaKpis && logisticaKpis ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardKpiCard
            title="Vehículos activos"
            value={logisticaKpis.activeVehicles}
            icon={Truck}
            accent="blue"
            hint="Flota disponible"
          />
          <DashboardKpiCard
            title="Conductores activos"
            value={logisticaKpis.activeDrivers}
            icon={UserSquare2}
            accent="green"
            hint="En plantilla"
          />
          <DashboardKpiCard
            title="Campañas próx. semana"
            value={logisticaKpis.upcomingCampaignsNextWeek}
            icon={Megaphone}
            accent="amber"
            hint="Confirmadas o en ejecución"
          />
          <DashboardKpiCard
            title="Sin vehículo asignado"
            value={logisticaKpis.campaignsWithoutVehicleNextWeek}
            icon={AlertTriangle}
            accent="red"
            description="Campañas próximas sin vehículo asignado"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardKpiCard
            title="Personal activo"
            value={data.activeStaffCount}
            icon={Users}
            accent="blue"
            hint="Colaboradores en plantilla"
          />
          <DashboardKpiCard
            title="Campañas esta semana"
            value={data.campaignsThisWeek}
            icon={Megaphone}
            accent="green"
            hint="Confirmadas + programadas"
          />
          <DashboardKpiCard
            title="En sede hoy"
            value={data.sedeToday}
            icon={UserCheck}
            accent="amber"
            hint="Turnos programados"
          />
          <DashboardKpiCard
            title="Alertas del mes"
            value={totalAlerts}
            icon={AlertTriangle}
            accent="red"
            description={`${alerts.overSundays} sobre 2 domingos · ${alerts.overOvernights} sobre 1 pernocta`}
          />
        </div>
      )}

      <BalanceHeroChart
        rows={balanceRows}
        contractHours={cfg.weeklyHours}
        extraHoursLimit={cfg.maxExtraHoursWeek}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileHoursChart data={profileHours} contractHours={cfg.weeklyHours} />
        <CampaignsTrendChart data={trend} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConditionsRadarChart rows={radarRows} />
        <StatusDistributionChart data={statusDist} />
      </div>

      <AdminDashboardTabs
        sparklineRows={sparklineRows}
        heatmap={heatmap}
        upcomingCampaigns={data.upcomingCampaigns}
      />
      </div>
    </>
  )
}
