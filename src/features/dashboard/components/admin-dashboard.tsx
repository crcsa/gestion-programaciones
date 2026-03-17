import { Users, Megaphone, UserCheck, CalendarDays } from 'lucide-react'
import { StatCard } from '@/components/data-display/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AdminDashboardData } from '../actions/dashboard-actions'

const SIZE_LABELS: Record<string, string> = {
  S: 'S',
  S_plus: 'S+',
  M: 'M',
  L: 'L',
}

interface Props {
  data: AdminDashboardData
}

export function AdminDashboard({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Personal activo"
          value={data.activeStaffCount}
          icon={Users}
        />
        <StatCard
          title="Campañas esta semana"
          value={data.campaignsThisWeek}
          icon={Megaphone}
        />
        <StatCard
          title="En sede hoy"
          value={data.sedeToday}
          icon={UserCheck}
          description="Turnos programados para hoy"
        />
        <StatCard
          title="Próximas confirmadas"
          value={data.upcomingCampaigns.length}
          icon={CalendarDays}
          description="En los próximos días"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas campañas confirmadas</CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcomingCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay campañas confirmadas próximas.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.upcomingCampaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.code} — {c.municipality}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.campaignDate}
                      {c.companyName ? ` · ${c.companyName}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-3 shrink-0">
                    {SIZE_LABELS[c.size] ?? c.size}
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
