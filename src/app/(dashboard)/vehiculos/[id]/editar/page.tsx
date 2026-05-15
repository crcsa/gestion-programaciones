import { redirect, notFound } from 'next/navigation'
import { getVehicleById } from '@/features/logistics/actions/vehicle-actions'
import { VehicleFormClient } from '@/features/logistics/components/vehicle-form-client'
import type { Vehicle } from '@/lib/db/schema/vehicles'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditarVehiculoPage({ params }: PageProps) {
  const { id } = await params
  let vehicle: Vehicle
  try {
    vehicle = await getVehicleById(id)
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) {
      redirect('/')
    }
    if (error instanceof Error && error.message.includes('no encontrado')) {
      notFound()
    }
    throw error
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar vehículo</h1>
        <p className="text-sm text-muted-foreground">Placa {vehicle.plate}</p>
      </div>
      <VehicleFormClient
        mode="edit"
        vehicleId={vehicle.id}
        defaultValues={{
          plate: vehicle.plate,
          mobileNumber: vehicle.mobileNumber ?? undefined,
          model: vehicle.model ?? undefined,
          year: vehicle.year ?? undefined,
          capacity: vehicle.capacity ?? undefined,
          notes: vehicle.notes ?? undefined,
        }}
      />
    </div>
  )
}
