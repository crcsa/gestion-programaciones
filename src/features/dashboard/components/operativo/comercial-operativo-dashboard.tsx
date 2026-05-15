import { Clock, ClipboardList, CalendarClock } from 'lucide-react'
import { StatCard } from '@/components/data-display/stat-card'
import { WeeklyCalendarView } from '@/components/data-display/weekly-calendar-view'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import { getMyHoursTrend } from '../../lib/dashboard-queries'
import {
  getMyWeeklyBreakdown,
  getMyMonthlyProgression,
  getMyUpcomingCampaigns,
  getMyWeekAvailability,
} from '../../lib/operativo-queries'
import { PersonalHoursChart } from '../charts/personal-hours-chart'
import { MonthlyProgressionChart } from '../charts/monthly-progression-chart'
import { UpcomingCampaignsList } from './upcoming-campaigns-list'

interface Props {
  staffId: string
}

/**
 * Dashboard para operativos comerciales: trabajan campañas (sin turnos de
 * sede ni cupos de domingos/pernoctas), enfocados en el flujo de campañas.
 */
export async function ComercialOperativoDashboard({ staffId }: Props) {
  const [trend, breakdown, progression, upcoming, availability, cfg] =
    await Promise.all([
      getMyHoursTrend(staffId, 8),
      getMyWeeklyBreakdown(staffId, 8),
      getMyMonthlyProgression(staffId, 6),
      getMyUpcomingCampaigns(staffId),
      getMyWeekAvailability(staffId),
      loadValidationRuntimeConfig(),
    ])

  const thisMonth = progression[progression.length - 1]
  const thisWeek = breakdown[breakdown.length - 1]
  const weeklyHoursSum = thisWeek.sedeHours + thisWeek.campaignHours
  const coordinatorIds = upcoming
    .filter((c) => c.isCoordinator)
    .map((c) => c.campaignId)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Horas esta semana"
          value={`${weeklyHoursSum}h / ${cfg.weeklyHours}h`}
          icon={Clock}
          description="Horas registradas"
        />
        <StatCard
          title="Campañas del mes"
          value={thisMonth.campaignCount}
          icon={ClipboardList}
          description="Asignaciones registradas"
        />
        <StatCard
          title="Próximas campañas"
          value={upcoming.length}
          icon={CalendarClock}
          description="En los próximos 30 días"
        />
      </div>

      <WeeklyCalendarView
        shifts={[]}
        campaigns={upcoming}
        coordinatorIds={coordinatorIds}
        availability={availability}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PersonalHoursChart data={trend} contractHours={cfg.weeklyHours} />
        <MonthlyProgressionChart data={progression} />
      </div>

      <UpcomingCampaignsList campaigns={upcoming} />
    </div>
  )
}
