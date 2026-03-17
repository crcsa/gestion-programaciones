import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCampaignById } from '@/features/campaigns/actions/campaign-actions'
import { CampaignEditClient } from '@/features/campaigns/components/campaign-edit-client'
import { RoleGate } from '@/features/auth/components/role-gate'
import type { CreateCampaignInput } from '@/features/campaigns/schemas/campaign-schemas'
import type { Role } from '@/types/roles'

interface EditCampaignPageProps {
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

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
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

  if (campaign.status !== 'tentativa') {
    redirect(`/campanas/${id}`)
  }

  const currentRole = await getCurrentRole()

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
    <RoleGate allowedRoles={['admin', 'banco_sangre', 'comercial']} currentRole={currentRole}>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Editar Campana
          </h1>
          <p className="text-muted-foreground text-sm">
            {campaign.code}
          </p>
        </div>

        <CampaignEditClient
          campaignId={id}
          defaultValues={defaultValues}
        />
      </div>
    </RoleGate>
  )
}
