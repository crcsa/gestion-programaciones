import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ComercialDashboardData, UpcomingCampaign } from '../actions/dashboard-actions'

const SIZE_LABELS: Record<string, string> = {
  S: 'S',
  S_plus: 'S+',
  M: 'M',
  L: 'L',
}

interface Props {
  data: ComercialDashboardData
}

function CampaignList({
  campaigns,
  emptyMessage,
}: {
  campaigns: UpcomingCampaign[]
  emptyMessage: string
}) {
  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="divide-y divide-border">
      {campaigns.map((c) => (
        <div key={c.id} className="flex items-center justify-between py-2">
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
  )
}

export function ComercialDashboard({ data }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Campañas tentativas pendientes
            {data.pendingTentativeCampaigns.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {data.pendingTentativeCampaigns.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignList
            campaigns={data.pendingTentativeCampaigns}
            emptyMessage="No hay campañas tentativas pendientes."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas campañas confirmadas</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignList
            campaigns={data.upcomingConfirmedCampaigns}
            emptyMessage="No hay campañas confirmadas próximas."
          />
        </CardContent>
      </Card>
    </div>
  )
}
