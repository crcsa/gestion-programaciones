import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { ROLE_LABELS, type Role } from '@/types/roles'
import {
  getAdminDashboardData,
  getComercialDashboardData,
} from '@/features/dashboard/actions/dashboard-actions'
import { AdminDashboard } from '@/features/dashboard/components/admin-dashboard'
import { ComercialDashboard } from '@/features/dashboard/components/comercial-dashboard'
import { OperativoDashboard } from '@/features/dashboard/components/operativo-dashboard'
import { requireUserContext } from '@/features/auth/lib/user-context'
import { isAreaAdmin } from '@/lib/auth/area-gates'
import type { Area } from '@/types/areas'

type SearchParamsRecord = Record<string, string | string[] | undefined>

/**
 * Para roles ligados a un área operativa (banco_sangre, operativo) forzamos el
 * filtro `area` al área del usuario para que no pueda saltarse el scoping
 * editando la URL. Admin global y comercial respetan el searchParam (pueden
 * navegar entre áreas).
 */
function applyAreaScope(
  sp: SearchParamsRecord,
  role: Role,
  area: Area | null,
): SearchParamsRecord {
  if (role === 'admin' || role === 'comercial') return sp
  if (!area) return sp
  return { ...sp, area }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsRecord>
}) {
  const sp = (await searchParams) ?? {}
  const ctx = await requireUserContext()
  const role = ctx.role
  const scopedSp = applyAreaScope(sp, role, ctx.area)

  if (isAreaAdmin(role)) {
    return <DashboardContent role={role} userId={ctx.userId} searchParams={scopedSp} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {ctx.fullName} — {ROLE_LABELS[role]}
        </p>
      </div>

      <DashboardContent role={role} userId={ctx.userId} searchParams={scopedSp} />
    </div>
  )
}

async function DashboardContent({
  role,
  userId,
  searchParams,
}: {
  role: Role
  userId: string
  searchParams: SearchParamsRecord
}) {
  if (isAreaAdmin(role)) {
    const data = await getAdminDashboardData()
    return <AdminDashboard data={data} searchParams={searchParams} />
  }

  if (role === 'comercial') {
    const data = await getComercialDashboardData()
    return <ComercialDashboard data={data} />
  }

  // operativo
  const [staffMember] = await db
    .select({ id: staffMembers.id, area: staffMembers.area })
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

  return <OperativoDashboard staffId={staffMember.id} area={staffMember.area} />
}
