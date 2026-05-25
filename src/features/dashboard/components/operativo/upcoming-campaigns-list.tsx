import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { MyUpcomingCampaign } from '../../lib/operativo-queries'

interface Props {
  campaigns: MyUpcomingCampaign[]
  showCoordinator?: boolean
}

/** Lista de próximas campañas (30 días) del staff vía campaign_assignments. */
export function UpcomingCampaignsList({ campaigns, showCoordinator = false }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mis próximas campañas</CardTitle>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes campañas programadas en los próximos 30 días.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map((c) => (
              <div
                key={c.assignmentId}
                className="flex items-center justify-between py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.isCoordinator ? (
                      <Link
                        href={`/campanas/${c.campaignId}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {c.code}
                      </Link>
                    ) : (
                      c.code
                    )}{' '}
                    — {c.municipality}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.campaignDate}
                    {c.startTime ? ` · ${c.startTime}` : ''}
                    {c.isCoordinator ? ' · registra ejecución desde el detalle' : ''}
                  </p>
                </div>
                {showCoordinator && c.isCoordinator && (
                  <Badge className="ml-3 shrink-0 bg-primary text-primary-foreground">
                    Coordinador
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
