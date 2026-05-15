import { redirect } from 'next/navigation'
import { requireAccess } from '@/features/auth/lib/require-access'
import { PermissionError } from '@/lib/errors/app-errors'
import { CampaignCreateClient } from '@/features/campaigns/components/campaign-create-client'

export default async function NuevaCampanaPage() {
  try {
    await requireAccess({
      roles: ['admin', 'admin_area', 'comercial'],
      areas: ['comercial'],
      allowCrossArea: true,
    })
  } catch (err) {
    if (err instanceof PermissionError) redirect('/campanas')
    throw err
  }

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
