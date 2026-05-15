import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ComercialDashboardData, UpcomingCampaign } from '../actions/dashboard-actions'
import {
  getCampaignsTrendByMonth,
  getCampaignsByModality,
  getCampaignsByStatusDistribution,
} from '../lib/dashboard-queries'
import { CampaignsTrendChart } from './charts/campaigns-trend-chart'
import { ModalityPieChart } from './charts/modality-pie-chart'
import { StatusDistributionChart } from './charts/status-distribution-chart'

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

export async function ComercialDashboard({ data }: Props) {
  const [trend, modality, statusDist] = await Promise.all([
    getCampaignsTrendByMonth(6),
    getCampaignsByModality(3),
    getCampaignsByStatusDistribution(),
  ])

  const tentativaCount = data.pendingTentativeCampaigns.length
  const confirmedCount = data.upcomingConfirmedCampaigns.length
  const ratio = tentativaCount + confirmedCount > 0
    ? Math.round((confirmedCount / (tentativaCount + confirmedCount)) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tentativas pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tentativaCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Próximas confirmadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{confirmedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ratio de confirmación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{ratio}%</p>
            <p className="text-xs text-muted-foreground">Confirmadas / total programadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Capacidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              render={<Link href="/disponibilidad" />}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Ver matriz mensual
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CampaignsTrendChart data={trend} />
        <ModalityPieChart data={modality} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StatusDistributionChart data={statusDist} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tentativas pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <CampaignList
              campaigns={data.pendingTentativeCampaigns}
              emptyMessage="No hay campañas tentativas pendientes."
            />
          </CardContent>
        </Card>
      </div>

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
