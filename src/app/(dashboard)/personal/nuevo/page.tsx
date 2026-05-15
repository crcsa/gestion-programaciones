import { redirect } from 'next/navigation'
import { requireAccess } from '@/features/auth/lib/require-access'
import { getTrainingAreas } from '@/features/staff/actions/staff-actions'
import { StaffFormClient } from '@/features/staff/components/staff-form-client'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'

export default async function NuevoColaboradorPage() {
  let canSelectArea = false
  let callerArea: 'banco_sangre' | 'comercial' | 'logistica' | null = null
  try {
    const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })
    canSelectArea = ctx.role === 'admin'
    callerArea = ctx.area
  } catch {
    redirect('/')
  }

  const [areas, cfg] = await Promise.all([
    getTrainingAreas(),
    loadValidationRuntimeConfig(),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo Colaborador</h1>
        <p className="text-muted-foreground text-sm">
          Complete los datos para registrar un nuevo colaborador.
        </p>
      </div>

      <StaffFormClient
        mode="create"
        areas={areas}
        defaultWeeklyHours={cfg.weeklyHours}
        canSelectArea={canSelectArea}
        callerArea={callerArea}
      />
    </div>
  )
}
