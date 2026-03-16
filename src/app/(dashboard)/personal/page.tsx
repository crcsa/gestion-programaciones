import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getStaffList } from '@/features/staff/actions/staff-actions'
import { StaffListClient } from '@/features/staff/components/staff-list-client'
import { StaffTableSkeleton } from '@/features/staff/components/staff-table-skeleton'
import { RoleGate } from '@/features/auth/components/role-gate'
import { Button } from '@/components/ui/button'
import type { Role } from '@/types/roles'

async function StaffListSection() {
  const result = await getStaffList({ page: 1, limit: 20 })
  return <StaffListClient initialData={result} />
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

export default async function PersonalPage() {
  const currentRole = await getCurrentRole()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personal</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de funcionarios del banco de sangre
          </p>
        </div>

        <RoleGate allowedRoles={['admin', 'banco_sangre']} currentRole={currentRole}>
          <Button render={<Link href="/personal/nuevo" />}>
            Nuevo
          </Button>
        </RoleGate>
      </div>

      <Suspense fallback={<StaffTableSkeleton />}>
        <StaffListSection />
      </Suspense>
    </div>
  )
}
