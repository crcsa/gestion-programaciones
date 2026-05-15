'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { VehicleForm } from './vehicle-form'
import { createVehicle, updateVehicle } from '@/features/logistics/actions/vehicle-actions'
import type { CreateVehicleInput } from '@/features/logistics/schemas/vehicle-schemas'

interface VehicleFormClientProps {
  mode: 'create' | 'edit'
  vehicleId?: string
  defaultValues?: Partial<CreateVehicleInput>
}

export function VehicleFormClient({ mode, vehicleId, defaultValues }: VehicleFormClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handle = async (data: CreateVehicleInput) => {
    setError(null)
    setLoading(true)
    try {
      if (mode === 'create') {
        await createVehicle(data)
      } else if (vehicleId) {
        await updateVehicle(vehicleId, data)
      }
      router.push('/vehiculos')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el vehículo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <VehicleForm
        defaultValues={defaultValues}
        onSubmit={handle}
        isLoading={loading}
        submitLabel={mode === 'create' ? 'Crear vehículo' : 'Guardar cambios'}
      />
    </div>
  )
}
