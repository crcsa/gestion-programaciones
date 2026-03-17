import { Clock } from 'lucide-react'
import { StatCard } from '@/components/data-display/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OperativoDashboardData } from '../actions/dashboard-actions'

const SHIFT_TYPE_LABELS: Record<string, string> = {
  diurno_completo: 'Diurno completo',
  noche: 'Noche',
  posturno: 'Posturno',
}

interface Props {
  data: OperativoDashboardData
}

export function OperativoDashboard({ data }: Props) {
  const hasActivity =
    data.myWeeklyShifts.length > 0 || data.myCampaignAssignments.length > 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Horas esta semana"
          value={`${data.weeklyHoursSum}h`}
          icon={Clock}
          description="Turnos en sede"
        />
      </div>

      {!hasActivity && (
        <p className="text-sm text-muted-foreground">
          Sin actividad programada esta semana.
        </p>
      )}

      {data.myWeeklyShifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mis turnos esta semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {data.myWeeklyShifts.map((shift) => (
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
                  <Badge variant="secondary">{shift.totalHours}h</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.myCampaignAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mis campañas esta semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {data.myCampaignAssignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {a.code} — {a.municipality}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.campaignDate}
                    </p>
                  </div>
                  {a.isCoordinator && (
                    <Badge className="ml-3 shrink-0 bg-primary text-primary-foreground">
                      Coordinador
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
