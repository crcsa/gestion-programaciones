import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CampaignCreateClient } from '@/features/campaigns/components/campaign-create-client'
import type { Role } from '@/types/roles'

const ALLOWED_ROLES: Role[] = ['admin', 'banco_sangre', 'comercial']

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

export default async function NuevaCampanaPage() {
  const currentRole = await getCurrentRole()

  if (!currentRole || !ALLOWED_ROLES.includes(currentRole)) {
    redirect('/campanas')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nueva Campana</h1>
        <p className="text-muted-foreground text-sm">
          Complete los datos para registrar una nueva campana.
        </p>
      </div>

      <CampaignCreateClient />
    </div>
  )
}
