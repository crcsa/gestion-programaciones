import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { getCampaignById } from '@/features/campaigns/actions/campaign-actions'
import { getCampaignTimeline } from '@/features/hours/actions/hours-balance-actions'
import { CampaignStatusBadge } from '@/features/campaigns/components/campaign-status-badge'
import { CampaignSizeBadge } from '@/features/campaigns/components/campaign-size-badge'
import { AssignmentPanel } from '@/features/assignments/components/assignment-panel'
import { TimelineForm } from '@/features/hours/components/timeline-form'
import { CampaignCommercialView } from '@/features/campaigns/components/campaign-commercial-view'
import { Button } from '@/components/ui/button'
import {
  CAMPAIGN_MODALITY_LABELS,
} from '@/features/campaigns/lib/constants'
import type { Role } from '@/types/roles'

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>
}

async function getCurrentRole(): Promise<Role | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (profile?.role as Role) ?? null
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params

  let campaign
  try {
    campaign = await getCampaignById(id)
  } catch {
    notFound()
  }

  if (!campaign) {
    notFound()
  }

  const [currentRole, timelineEvents] = await Promise.all([
    getCurrentRole(),
    (campaign.status === 'confirmada' || campaign.status === 'ejecutada')
      ? getCampaignTimeline(id).catch(() => [])
      : Promise.resolve([]),
  ])

  const isTentativa = campaign.status === 'tentativa'
  const canEdit = isTentativa && (currentRole === 'admin' || currentRole === 'comercial')
  const isCoordinatorOrAdmin = currentRole === 'admin' || currentRole === 'banco_sangre'
  const isCommercial = currentRole === 'admin' || currentRole === 'comercial'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Campana {campaign.code}
          </h1>
          <p className="text-muted-foreground text-sm">
            {campaign.companyName ?? 'Sin empresa asignada'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CampaignStatusBadge status={campaign.status} />
          {canEdit && (
            <Button variant="outline" nativeButton={false} render={<Link href={`/campanas/${id}/editar`} />}>
              Editar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg border border-border p-4">
        <DetailRow label="Codigo" value={campaign.code} />
        <DetailRow label="Empresa" value={campaign.companyName ?? '\u2014'} />
        <DetailRow label="Municipio" value={campaign.municipality} />
        <DetailRow
          label="Fecha"
          value={formatCampaignDate(campaign.campaignDate)}
        />
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tamano</p>
          <div className="mt-0.5">
            <CampaignSizeBadge size={campaign.size} />
          </div>
        </div>
        <DetailRow
          label="Modalidad"
          value={CAMPAIGN_MODALITY_LABELS[campaign.modality] ?? campaign.modality}
        />
        <DetailRow
          label="Donaciones esperadas"
          value={campaign.expectedDonations != null ? String(campaign.expectedDonations) : '\u2014'}
        />
        {campaign.startTime && (
          <DetailRow label="Hora de inicio" value={campaign.startTime} />
        )}
        {campaign.endTime && (
          <DetailRow label="Hora de fin" value={campaign.endTime} />
        )}
        {campaign.observations && (
          <div className="sm:col-span-2">
            <DetailRow label="Observaciones" value={campaign.observations} />
          </div>
        )}
        {campaign.cancelReason && (
          <div className="sm:col-span-2">
            <DetailRow label="Motivo de cancelacion" value={campaign.cancelReason} />
          </div>
        )}
      </div>

      {(campaign.status === 'confirmada' || campaign.status === 'ejecutada') && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-4">Personal asignado</h2>
            <AssignmentPanel
              campaignId={campaign.id}
              campaignSize={campaign.size}
              campaignStatus={campaign.status}
              currentRole={currentRole}
            />
          </section>

          {isCoordinatorOrAdmin && (
            <section className="rounded-lg border border-border p-4">
              <TimelineForm
                campaignId={campaign.id}
                existingEvents={timelineEvents}
                isCoordinator={isCoordinatorOrAdmin}
              />
            </section>
          )}

          {isCommercial && (
            <CampaignCommercialView campaignId={campaign.id} size={campaign.size} />
          )}
        </>
      )}

      <div className="pt-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/campanas" />}>
          &larr; Campañas
        </Button>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  )
}

function formatCampaignDate(dateStr: string): string {
  try {
    return format(new Date(`${dateStr}T00:00:00`), 'dd/MM/yyyy', { locale: es })
  } catch {
    return dateStr
  }
}
