import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getStaffList, getTrainingAreas } from '@/features/staff/actions/staff-actions'
import { StaffListClient } from '@/features/staff/components/staff-list-client'
import { StaffTableSkeleton } from '@/features/staff/components/staff-table-skeleton'
import { PAGE_LIMIT } from '@/features/staff/lib/constants'
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

async function PersonalSection() {
  const [result, areas, currentRole] = await Promise.all([
    getStaffList({ page: 1, limit: PAGE_LIMIT }),
    getTrainingAreas(),
    getCurrentRole(),
  ])

  return (
    <StaffListClient
      initialData={result}
      areas={areas}
      currentRole={currentRole}
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
