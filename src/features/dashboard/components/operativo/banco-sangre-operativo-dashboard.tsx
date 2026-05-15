import { Clock, Calendar, Moon, ClipboardList } from 'lucide-react'
import { StatCard } from '@/components/data-display/stat-card'
import { WeeklyCalendarView } from '@/components/data-display/weekly-calendar-view'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import { getMyHoursTrend } from '../../lib/dashboard-queries'
import {
  getMyWeeklyBreakdown,
  getMyMonthlyProgression,
  getMyUpcomingCampaigns,
  getMyWeekSedeShifts,
  getMyWeekAvailability,
} from '../../lib/operativo-queries'
import { PersonalHoursChart } from '../charts/personal-hours-chart'
import { HoursBreakdownChart } from '../charts/hours-breakdown-chart'
import { MonthlyProgressionChart } from '../charts/monthly-progression-chart'
import { QuotaCard } from './operativo-kpi-cards'
import { UpcomingCampaignsList } from './upcoming-campaigns-list'

const SHIFT_TYPE_LABELS: Record<string, string> = {
  diurno_completo: 'Diurno completo',
  noche: 'Noche',
  posturno: 'Posturno',
}

interface Props {
  staffId: string
}

/**
 * Dashboard para operativos de banco de sangre (médico, bacteriólogo,
 * técnico, auxiliar): trabajan turnos de sede y campañas, con cupos de
 * domingos y pernoctas.
 */
export async function BancoSangreOperativoDashboard({ staffId }: Props) {
  const [trend, breakdown, progression, upcoming, weekShifts, availability, cfg] =
    await Promise.all([
      getMyHoursTrend(staffId, 8),
      getMyWeeklyBreakdown(staffId, 8),
      getMyMonthlyProgression(staffId, 6),
      getMyUpcomingCampaigns(staffId),
      getMyWeekSedeShifts(staffId),
      getMyWeekAvailability(staffId),
      loadValidationRuntimeConfig(),
    ])

  const thisMonth = progression[progression.length - 1]
  const weeklyHoursSum = weekShifts.reduce((acc, s) => acc + s.totalHours, 0)
  const coordinatorIds = upcoming
    .filter((c) => c.isCoordinator)
    .map((c) => c.campaignId)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Horas esta semana"
          value={`${weeklyHoursSum}h / ${cfg.weeklyHours}h`}
          icon={Clock}
          description="Turnos en sede"
        />
        <QuotaCard
          title="Domingos del mes"
          current={thisMonth.sundayCount}
          max={cfg.maxSundaysMonth}
          icon={Calendar}
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
          description="Asignaciones registradas"
        />
      </div>

      <WeeklyCalendarView
        shifts={weekShifts}
        campaigns={upcoming}
        coordinatorIds={coordinatorIds}
        availability={availability}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PersonalHoursChart data={trend} contractHours={cfg.weeklyHours} />
        <HoursBreakdownChart data={breakdown} />
      </div>

      <MonthlyProgressionChart data={progression} />

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingCampaignsList campaigns={upcoming} showCoordinator />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mis turnos esta semana</CardTitle>
          </CardHeader>
          <CardContent>
            {weekShifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes turnos de sede esta semana.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {weekShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {SHIFT_TYPE_LABELS[shift.shiftType] ?? shift.shiftType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {shift.shiftDate} · {shift.startTime}–{shift.endTime}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      title={
                        shift.shiftType === 'diurno_completo'
                          ? 'Horas efectivas (descuenta 1h de almuerzo en Diurno completo)'
                          : 'Horas efectivas del turno'
                      }
                    >
                      {shift.totalHours}h
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
