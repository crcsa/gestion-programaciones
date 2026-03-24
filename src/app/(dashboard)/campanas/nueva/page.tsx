import { requireRole } from '@/features/auth/lib/require-role'
import { CampaignCreateClient } from '@/features/campaigns/components/campaign-create-client'

export default async function NuevaCampanaPage() {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nueva Campana</h1>
        <p className="text-muted-foreground text-sm">
          Complete los datos para registrar una nueva campaña.
        </p>
      </div>

      <CampaignCreateClient />
    </div>
  )
}
