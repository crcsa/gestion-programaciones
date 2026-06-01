import { notFound, redirect } from 'next/navigation'
import { requireAccess } from '@/features/auth/lib/require-access'
import { PermissionError } from '@/lib/errors/app-errors'
import { getCampaignById } from '@/features/campaigns/actions/campaign-actions'
import { CampaignEditClient } from '@/features/campaigns/components/campaign-edit-client'
import type { CreateCampaignInput } from '@/features/campaigns/schemas/campaign-schemas'

interface EditCampaignPageProps {
  params: Promise<{ id: string }>
}

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const { id } = await params

  try {
    await requireAccess({
      roles: ['admin', 'admin_area', 'comercial'],
      areas: ['comercial'],
      allowCrossArea: true,
    })
  } catch (err) {
    if (err instanceof PermissionError) redirect(`/campanas/${id}`)
    throw err
  }

  let campaign
  try {
    campaign = await getCampaignById(id)
  } catch {
    notFound()
  }

  if (!campaign) {
    notFound()
  }

  // Tentativa y confirmada se pueden editar. Cancelada y ejecutada no.
  if (campaign.status === 'cancelada' || campaign.status === 'ejecutada') {
    redirect(`/campanas/${id}`)
  }

  const defaultValues: Partial<CreateCampaignInput> = {
    code: campaign.code,
    companyId: campaign.companyId ?? undefined,
    locationId: campaign.locationId ?? undefined,
    campaignDate: campaign.campaignDate,
    startTime: campaign.startTime ?? undefined,
    endTime: campaign.endTime ?? undefined,
    size: campaign.size,
    modality: campaign.modality,
    municipality: campaign.municipality,
    expectedDonations: campaign.expectedDonations ?? undefined,
    trainingAreaId: campaign.trainingAreaId ?? undefined,
    observations: campaign.observations ?? undefined,
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar Campaña</h1>
        <p className="text-muted-foreground text-sm">{campaign.code}</p>
      </div>

      <CampaignEditClient
        campaignId={id}
        defaultValues={defaultValues}
      />
    </div>
  )
}
