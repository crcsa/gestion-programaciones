import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStaffById, getTrainingAreas } from '@/features/staff/actions/staff-actions'
import { StaffFormClient } from '@/features/staff/components/staff-form-client'
import { RoleGate } from '@/features/auth/components/role-gate'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'
import type { Role } from '@/types/roles'

interface EditStaffPageProps {
  params: Promise<{ id: string }>
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

export default async function EditStaffPage({ params }: EditStaffPageProps) {
  const { id } = await params

  let staff
  try {
    staff = await getStaffById(id)
  } catch {
    notFound()
  }

  if (!staff) {
    notFound()
  }

  const [currentRole, areas] = await Promise.all([
    getCurrentRole(),
    getTrainingAreas(),
  ])

  const defaultValues: Partial<CreateStaffInput> = {
    firstName: staff.firstName,
    lastName: staff.lastName,
    cedula: staff.cedula,
    email: staff.email ?? undefined,
    phone: staff.phone ?? undefined,
    staffProfile: staff.staffProfile,
    weeklyHours: staff.weeklyHours,
    hireDate: staff.hireDate ?? undefined,
    trainingAreaIds: staff.trainingAreaIds ?? [],
  }

  return (
    <RoleGate allowedRoles={['admin', 'banco_sangre']} currentRole={currentRole}>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Editar Funcionario
          </h1>
          <p className="text-muted-foreground text-sm">
            {staff.firstName} {staff.lastName}
          </p>
        </div>

        <StaffFormClient
          mode="edit"
          staffId={id}
          defaultValues={defaultValues}
          areas={areas}
        />
      </div>
    </RoleGate>
  )
}
