import { notFound, redirect } from 'next/navigation'
import { requireAccess } from '@/features/auth/lib/require-access'
import { getStaffById, getTrainingAreas } from '@/features/staff/actions/staff-actions'
import { StaffFormClient } from '@/features/staff/components/staff-form-client'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import type { CreateStaffInput } from '@/features/staff/schemas/staff-schemas'
import type { Area } from '@/types/areas'

interface EditStaffPageProps {
  params: Promise<{ id: string }>
}

export default async function EditStaffPage({ params }: EditStaffPageProps) {
  let canSelectArea = false
  let callerArea: Area | null = null
  try {
    const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })
    canSelectArea = ctx.role === 'admin'
    callerArea = ctx.area
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

  const [areas, cfg] = await Promise.all([
    getTrainingAreas(),
    loadValidationRuntimeConfig(),
  ])

  const defaultValues: Partial<CreateStaffInput> = {
    firstName: staff.firstName,
    lastName: staff.lastName,
    cedula: staff.cedula,
    email: staff.email ?? undefined,
    phone: staff.phone ?? undefined,
    // Filtra el legacy 'coordinador' del enum DB (deprecado en 0025):
    // si la row aún lo tiene, dejamos staffProfile undefined para forzar
    // re-selección y respetar el invariant del schema.
    staffProfile:
      staff.staffProfile === 'coordinador'
        ? undefined
        : (staff.staffProfile as CreateStaffInput['staffProfile']),
    area: staff.area,
    weeklyHours: staff.weeklyHours,
    hireDate: staff.hireDate ?? undefined,
    trainingAreaIds: staff.trainingAreaIds ?? [],
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar Colaborador</h1>
        <p className="text-muted-foreground text-sm">
          {staff.firstName} {staff.lastName}
        </p>
      </div>

      <StaffFormClient
        mode="edit"
        staffId={id}
        defaultValues={defaultValues}
        areas={areas}
        defaultWeeklyHours={cfg.weeklyHours}
        canSelectArea={canSelectArea}
        callerArea={callerArea}
      />
    </div>
  )
}
