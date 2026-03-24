import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { parseRole, ROLE_LABELS, type Role } from '@/types/roles'
import {
  getAdminDashboardData,
  getComercialDashboardData,
  getOperativoDashboardData,
} from '@/features/dashboard/actions/dashboard-actions'
import { AdminDashboard } from '@/features/dashboard/components/admin-dashboard'
import { ComercialDashboard } from '@/features/dashboard/components/comercial-dashboard'
import { OperativoDashboard } from '@/features/dashboard/components/operativo-dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [profile] = await db
    .select({ role: profiles.role, fullName: profiles.fullName })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1)

  const role = parseRole(profile?.role) ?? 'operativo'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {profile?.fullName ?? user.email} — {ROLE_LABELS[role]}
        </p>
      </div>

      <DashboardContent role={role} userId={user.id} />
    </div>
  )
}

async function DashboardContent({
  role,
  userId,
}: {
  role: Role
  userId: string
}) {
  if (role === 'admin' || role === 'banco_sangre') {
    const data = await getAdminDashboardData()
    return <AdminDashboard data={data} />
  }

  if (role === 'comercial') {
    const data = await getComercialDashboardData()
    return <ComercialDashboard data={data} />
  }

  // operativo
  const [staffMember] = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(eq(staffMembers.profileId, userId))
    .limit(1)

  if (!staffMember) {
    return (
      <p className="text-sm text-muted-foreground">
        Perfil de empleado no configurado. Contacta al administrador.
      </p>
    )
  }

  const data = await getOperativoDashboardData(staffMember.id)
  return <OperativoDashboard data={data} />
}
