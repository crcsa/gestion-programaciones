import { notFound, redirect } from 'next/navigation'
import { requireRole } from '@/features/auth/lib/require-role'
import { getStaffById, getTrainingAreas } from '@/features/staff/actions/staff-actions'
import { StaffFormClient } from '@/features/staff/components/staff-form-client'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'

interface EditStaffPageProps {
  params: Promise<{ id: string }>
}

export default async function EditStaffPage({ params }: EditStaffPageProps) {
  try {
    await requireRole(['admin', 'banco_sangre'])
  } catch {
    redirect('/')
  }

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

  const areas = await getTrainingAreas()

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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar Funcionario</h1>
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
  )
}
