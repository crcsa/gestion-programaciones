import { notFound } from 'next/navigation'
import { getStaffById } from '@/features/staff/actions/staff-actions'
import { StaffFormClient } from '@/features/staff/components/staff-form-client'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'

interface EditStaffPageProps {
  params: Promise<{ id: string }>
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

  const defaultValues: Partial<CreateStaffInput> = {
    firstName: staff.firstName,
    lastName: staff.lastName,
    cedula: staff.cedula,
    email: staff.email ?? undefined,
    phone: staff.phone ?? undefined,
    staffProfile: staff.staffProfile,
    contractType: staff.contractType,
    weeklyHours: staff.weeklyHours,
    defaultShift: staff.defaultShift,
    hireDate: staff.hireDate ?? undefined,
  }

  return (
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
      />
    </div>
  )
}
