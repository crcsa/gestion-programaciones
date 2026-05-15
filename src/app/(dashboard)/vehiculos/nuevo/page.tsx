import { redirect } from 'next/navigation'
import { requireAccess } from '@/features/auth/lib/require-access'
import { VehicleFormClient } from '@/features/logistics/components/vehicle-form-client'

export default async function NuevoVehiculoPage() {
  let allowed = true
  try {
    await requireAccess({
      roles: ['admin', 'admin_area'],
      areas: ['logistica'],
    })
  } catch {
    allowed = false
  }
  if (!allowed) redirect('/')

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo vehículo</h1>
        <p className="text-sm text-muted-foreground">
          Registre un nuevo vehículo para el área de logística.
        </p>
      </div>
      <VehicleFormClient mode="create" />
    </div>
  )
}
