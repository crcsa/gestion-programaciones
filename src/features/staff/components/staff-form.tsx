'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createStaffSchema, type CreateStaffInput } from '@/features/staff/schemas/staff-schemas'
import { TrainingAreaMultiSelect } from './training-area-multi-select'
import type { TrainingArea } from '@/lib/db/schema/training-areas'

interface StaffFormProps {
  defaultValues?: Partial<CreateStaffInput>
  onSubmit: (data: CreateStaffInput) => Promise<void>
  isLoading?: boolean
  areas: TrainingArea[]
}

export function StaffForm({ defaultValues, onSubmit, isLoading = false, areas }: StaffFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      weeklyHours: 44,
      ...defaultValues,
    },
  })

  const staffProfile = watch('staffProfile')
  const contractType = watch('contractType')
  const defaultShift = watch('defaultShift')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            {...register('firstName')}
            aria-invalid={!!errors.firstName}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            {...register('lastName')}
            aria-invalid={!!errors.lastName}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cedula">Cédula</Label>
          <Input
            id="cedula"
            {...register('cedula')}
            aria-invalid={!!errors.cedula}
          />
          {errors.cedula && (
            <p className="text-sm text-destructive">{errors.cedula.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            {...register('phone')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staffProfile">Perfil</Label>
          <Select
            value={staffProfile}
            onValueChange={(v) => setValue('staffProfile', v as CreateStaffInput['staffProfile'], { shouldValidate: true })}
          >
            <SelectTrigger id="staffProfile" aria-invalid={!!errors.staffProfile} className="w-full">
              <SelectValue placeholder="Seleccionar perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bacteriologo">Bacteriólogo</SelectItem>
              <SelectItem value="tecnico">Técnico</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="auxiliar">Auxiliar</SelectItem>
              <SelectItem value="coordinador">Coordinador</SelectItem>
            </SelectContent>
          </Select>
          {errors.staffProfile && (
            <p className="text-sm text-destructive">{errors.staffProfile.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contractType">Tipo de Contrato</Label>
          <Select
            value={contractType}
            onValueChange={(v) => setValue('contractType', v as CreateStaffInput['contractType'], { shouldValidate: true })}
          >
            <SelectTrigger id="contractType" aria-invalid={!!errors.contractType} className="w-full">
              <SelectValue placeholder="Seleccionar contrato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indefinido">Indefinido</SelectItem>
              <SelectItem value="fijo">Fijo</SelectItem>
              <SelectItem value="prestacion_servicios">Prestación de Servicios</SelectItem>
              <SelectItem value="aprendizaje">Aprendizaje</SelectItem>
            </SelectContent>
          </Select>
          {errors.contractType && (
            <p className="text-sm text-destructive">{errors.contractType.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="weeklyHours">Horas/semana</Label>
          <Input
            id="weeklyHours"
            type="number"
            min={20}
            max={48}
            {...register('weeklyHours', { valueAsNumber: true })}
            aria-invalid={!!errors.weeklyHours}
          />
          {errors.weeklyHours && (
            <p className="text-sm text-destructive">{errors.weeklyHours.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="defaultShift">Turno por defecto</Label>
          <Select
            value={defaultShift}
            onValueChange={(v) => setValue('defaultShift', v as CreateStaffInput['defaultShift'], { shouldValidate: true })}
          >
            <SelectTrigger id="defaultShift" aria-invalid={!!errors.defaultShift} className="w-full">
              <SelectValue placeholder="Seleccionar turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diurno_completo">Diurno Completo</SelectItem>
              <SelectItem value="noche">Noche</SelectItem>
              <SelectItem value="posturno">Posturno</SelectItem>
            </SelectContent>
          </Select>
          {errors.defaultShift && (
            <p className="text-sm text-destructive">{errors.defaultShift.message}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Áreas de Entrenamiento</Label>
          <Controller
            control={control}
            name="trainingAreaIds"
            render={({ field }) => (
              <TrainingAreaMultiSelect
                value={field.value ?? []}
                onChange={field.onChange}
                areas={areas}
              />
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hireDate">Fecha de ingreso</Label>
          <Input
            id="hireDate"
            type="date"
            {...register('hireDate')}
          />
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
