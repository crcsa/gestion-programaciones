import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCampaignsList } from '@/features/campaigns/actions/campaign-actions'
import { CampaignListClient } from '@/features/campaigns/components/campaign-list-client'
import { Skeleton } from '@/components/ui/skeleton'
import { PAGE_LIMIT } from '@/features/campaigns/lib/constants'
import type { Role } from '@/types/roles'

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

async function CampanasSection() {
  const [result, currentRole] = await Promise.all([
    getCampaignsList({ page: 1, limit: PAGE_LIMIT }),
    getCurrentRole(),
  ])

  return (
    <CampaignListClient
      initialData={result}
      currentRole={currentRole}
    />
  )
}

export default async function CampanasPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      }
    >
      <CampanasSection />
    </Suspense>
  )
}
