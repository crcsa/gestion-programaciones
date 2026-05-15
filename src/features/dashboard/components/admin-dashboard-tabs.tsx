'use client'

import { LineChart, AlertOctagon, CalendarCheck2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HoursSparklineTable } from './charts/hours-sparkline-table'
import { OvernightSundayHeatmap } from './charts/overnight-sunday-heatmap'
import type {
  OvernightSundayCell,
  SparklineRow,
} from '../lib/dashboard-queries'
import type { UpcomingCampaign } from '../actions/dashboard-actions'

const SIZE_LABELS: Record<string, string> = {
  S: 'S',
  S_plus: 'S+',
  M: 'M',
  L: 'L',
}

interface Props {
  sparklineRows: SparklineRow[]
  heatmap: OvernightSundayCell[]
  upcomingCampaigns: UpcomingCampaign[]
}

export function AdminDashboardTabs({
  sparklineRows,
  heatmap,
  upcomingCampaigns,
}: Props) {
  return (
    <Tabs defaultValue="sparkline" className="flex-col">
      <TabsList className="h-9 w-fit p-1">
        <TabsTrigger value="sparkline" className="h-7 gap-1.5 px-3">
          <LineChart className="size-4" />
          Tendencia 8 semanas
        </TabsTrigger>
        <TabsTrigger value="heatmap" className="h-7 gap-1.5 px-3">
          <AlertOctagon className="size-4" />
          Pernoctas y domingos
        </TabsTrigger>
        <TabsTrigger value="upcoming" className="h-7 gap-1.5 px-3">
          <CalendarCheck2 className="size-4" />
          Próximas campañas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sparkline" className="pt-4">
        <HoursSparklineTable rows={sparklineRows} />
      </TabsContent>

      <TabsContent value="heatmap" className="pt-4">
        <OvernightSundayHeatmap data={heatmap} />
      </TabsContent>

      <TabsContent value="upcoming" className="pt-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Próximas campañas confirmadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingCampaigns.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay campañas confirmadas próximas.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {upcomingCampaigns.map((c) => (
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
      </TabsContent>
    </Tabs>
  )
}
