import { Suspense } from 'react'
import { getCampaignsList } from '@/features/campaigns/actions/campaign-actions'
import { CampaignListClient } from '@/features/campaigns/components/campaign-list-client'
import { Skeleton } from '@/components/ui/skeleton'
import { PAGE_LIMIT } from '@/features/campaigns/lib/constants'
import { getCurrentUserContext } from '@/features/auth/lib/user-context'

async function CampanasSection() {
  const [result, ctx] = await Promise.all([
    getCampaignsList({ page: 1, limit: PAGE_LIMIT }),
    getCurrentUserContext(),
  ])

  return (
    <CampaignListClient
      initialData={result}
      currentRole={ctx?.role ?? null}
      currentArea={ctx?.area ?? null}
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
