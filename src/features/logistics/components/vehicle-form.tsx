'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  createVehicleSchema,
  type CreateVehicleInput,
} from '@/features/logistics/schemas/vehicle-schemas'

interface VehicleFormProps {
  defaultValues?: Partial<CreateVehicleInput>
  onSubmit: (data: CreateVehicleInput) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
}

export function VehicleForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  submitLabel = 'Guardar',
}: VehicleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateVehicleInput>({
    resolver: zodResolver(createVehicleSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="plate">Placa *</Label>
          <Input id="plate" {...register('plate')} placeholder="ABC-123" />
          {errors.plate && (
            <p className="text-sm text-destructive">{errors.plate.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobileNumber">Número de móvil</Label>
          <Input
            id="mobileNumber"
            {...register('mobileNumber')}
            placeholder="M-12"
          />
          {errors.mobileNumber && (
            <p className="text-sm text-destructive">
              {errors.mobileNumber.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Modelo</Label>
          <Input id="model" {...register('model')} placeholder="Toyota Hilux 2022" />
          {errors.model && (
            <p className="text-sm text-destructive">{errors.model.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">Año</Label>
          <Input
            id="year"
            type="number"
            {...register('year', { valueAsNumber: true })}
            placeholder="2022"
          />
          {errors.year && (
            <p className="text-sm text-destructive">{errors.year.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Capacidad (pasajeros)</Label>
          <Input
            id="capacity"
            type="number"
            {...register('capacity', { valueAsNumber: true })}
            placeholder="6"
          />
          {errors.capacity && (
            <p className="text-sm text-destructive">{errors.capacity.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Input id="notes" {...register('notes')} placeholder="Observaciones" />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
