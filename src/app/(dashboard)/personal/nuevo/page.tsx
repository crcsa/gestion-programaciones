import { createClient } from '@/lib/supabase/server'
import { getTrainingAreas } from '@/features/staff/actions/staff-actions'
import { StaffFormClient } from '@/features/staff/components/staff-form-client'
import { RoleGate } from '@/features/auth/components/role-gate'
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

export default async function NuevoFuncionarioPage() {
  const [currentRole, areas] = await Promise.all([
    getCurrentRole(),
    getTrainingAreas(),
  ])

  return (
    <RoleGate allowedRoles={['admin', 'banco_sangre']} currentRole={currentRole}>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo Funcionario</h1>
          <p className="text-muted-foreground text-sm">
            Complete los datos para registrar un nuevo funcionario.
          </p>
        </div>

        <StaffFormClient mode="create" areas={areas} />
      </div>
    </RoleGate>
  )
}
