import { Suspense } from 'react'
import { getStaffList, getTrainingAreas } from '@/features/staff/actions/staff-actions'
import { StaffListClient } from '@/features/staff/components/staff-list-client'
import { StaffTableSkeleton } from '@/features/staff/components/staff-table-skeleton'
import { PAGE_LIMIT } from '@/features/staff/lib/constants'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import { getCurrentUserContext } from '@/features/auth/lib/user-context'

async function PersonalSection() {
  const [result, areas, ctx, cfg] = await Promise.all([
    getStaffList({ page: 1, limit: PAGE_LIMIT }),
    getTrainingAreas(),
    getCurrentUserContext(),
    loadValidationRuntimeConfig(),
  ])

  return (
    <StaffListClient
      initialData={result}
      areas={areas}
      currentRole={ctx?.role ?? null}
      currentArea={ctx?.area ?? null}
      defaultWeeklyHours={cfg.weeklyHours}
    />
  )
}

export default async function PersonalPage() {
  return (
    <Suspense fallback={<StaffTableSkeleton />}>
      <PersonalSection />
    </Suspense>
  )
}
