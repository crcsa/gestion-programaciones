'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrainingAreaMultiSelect } from '@/features/training-areas/components/training-area-multi-select'
import { createStaffSchema, type CreateStaffInput } from '../schemas/staff-schemas'
import { PROFILE_TYPE_LABELS, SHIFT_TYPE_LABELS } from '@/lib/utils/constants'
import { Loader2 } from 'lucide-react'

interface TrainingAreaOption {
  id: string
  code: string
  name: string
}

interface StaffFormProps {
  defaultValues?: Partial<CreateStaffInput>
  trainingAreas: TrainingAreaOption[]
  onSubmit: (data: CreateStaffInput) => Promise<unknown>
  isSubmitting?: boolean
  submitLabel?: string
}

export function StaffForm({
  defaultValues,
  trainingAreas,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Guardar',
}: StaffFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateStaffInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createStaffSchema) as any,
    defaultValues: {
      weeklyContractHours: 44,
      maxOvertimeWeekly: 12,
      maxShiftHours: 12,
      trainingAreaIds: [],
      ...defaultValues,
    },
  })

  const selectedAreas = watch('trainingAreaIds') ?? []
  const profileType = watch('profileType')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="documentNumber">Número de Documento *</Label>
            <Input
              id="documentNumber"
              placeholder="1234567890"
              {...register('documentNumber')}
            />
            {errors.documentNumber && (
              <p className="text-sm text-destructive">{errors.documentNumber.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="firstName">Nombre *</Label>
            <Input id="firstName" placeholder="Juan" {...register('firstName')} />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Apellido *</Label>
            <Input id="lastName" placeholder="Pérez" {...register('lastName')} />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" placeholder="+57 300 123 4567" {...register('phone')} />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perfil y Contrato</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de Perfil *</Label>
            <Select
              value={profileType}
              onValueChange={(value) =>
                setValue('profileType', value as CreateStaffInput['profileType'])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar perfil" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROFILE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.profileType && (
              <p className="text-sm text-destructive">{errors.profileType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractType">Tipo de Contrato</Label>
            <Input
              id="contractType"
              placeholder="Planta, Contratista..."
              {...register('contractType')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weeklyContractHours">Horas Semanales</Label>
            <Input
              id="weeklyContractHours"
              type="number"
              {...register('weeklyContractHours', { valueAsNumber: true })}
            />
            {errors.weeklyContractHours && (
              <p className="text-sm text-destructive">{errors.weeklyContractHours.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxOvertimeWeekly">Máximo Extras/Semana</Label>
            <Input
              id="maxOvertimeWeekly"
              type="number"
              {...register('maxOvertimeWeekly', { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxShiftHours">Máximo Horas/Turno</Label>
            <Input
              id="maxShiftHours"
              type="number"
              {...register('maxShiftHours', { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label>Turno por Defecto</Label>
            <Select
              value={watch('defaultShiftType') ?? ''}
              onValueChange={(value) =>
                setValue(
                  'defaultShiftType',
                  value as CreateStaffInput['defaultShiftType'],
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin turno por defecto" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SHIFT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Áreas de Formación</CardTitle>
        </CardHeader>
        <CardContent>
          <TrainingAreaMultiSelect
            options={trainingAreas}
            selected={selectedAreas}
            onChange={(ids) => setValue('trainingAreaIds', ids)}
            disabled={isSubmitting}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
