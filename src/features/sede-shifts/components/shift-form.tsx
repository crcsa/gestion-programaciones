'use client'

import { useForm } from 'react-hook-form'
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
import { upsertShiftSchema, type UpsertShiftInput } from '../schemas/shift-schemas'
import { SHIFT_TYPE_LABELS, SHIFT_TYPE_DEFAULTS } from '../lib/constants'

interface ShiftFormProps {
  staffId: string
  shiftDate: string
  defaultValues?: Partial<UpsertShiftInput>
  onSubmit: (data: UpsertShiftInput) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const SHIFT_TYPES = Object.entries(SHIFT_TYPE_LABELS) as [string, string][]

export function ShiftForm({
  staffId,
  shiftDate,
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
}: ShiftFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpsertShiftInput>({
    resolver: zodResolver(upsertShiftSchema),
    defaultValues: {
      staffId,
      shiftDate,
      ...defaultValues,
    },
  })

  const shiftType = watch('shiftType')

  const handleShiftTypeChange = (value: string | null) => {
    if (!value) return
    const typed = value as UpsertShiftInput['shiftType']
    setValue('shiftType', typed, { shouldValidate: true })

    const defaults = SHIFT_TYPE_DEFAULTS[value]
    if (defaults) {
      setValue('startTime', defaults.startTime)
      setValue('endTime', defaults.endTime)
      setValue('totalHours', defaults.totalHours)
      setValue('isOvernight', defaults.isOvernight)
    }
  }

  const handleFormSubmit = handleSubmit((data) => onSubmit(data as UpsertShiftInput))

  return (
    <form onSubmit={handleFormSubmit} className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={`shiftType-${staffId}-${shiftDate}`} className="text-xs">
          Tipo de turno
        </Label>
        <Select
          value={shiftType ?? ''}
          onValueChange={handleShiftTypeChange}
        >
          <SelectTrigger
            id={`shiftType-${staffId}-${shiftDate}`}
            aria-invalid={!!errors.shiftType}
            className="w-full"
          >
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            {SHIFT_TYPES.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.shiftType && (
          <p className="text-xs text-destructive">{errors.shiftType.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`startTime-${staffId}-${shiftDate}`} className="text-xs">
            Inicio
          </Label>
          <Input
            id={`startTime-${staffId}-${shiftDate}`}
            type="time"
            {...register('startTime')}
            aria-invalid={!!errors.startTime}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`endTime-${staffId}-${shiftDate}`} className="text-xs">
            Fin
          </Label>
          <Input
            id={`endTime-${staffId}-${shiftDate}`}
            type="time"
            {...register('endTime')}
            aria-invalid={!!errors.endTime}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`totalHours-${staffId}-${shiftDate}`} className="text-xs">
            Total horas
          </Label>
          <Input
            id={`totalHours-${staffId}-${shiftDate}`}
            type="number"
            min={1}
            max={12}
            {...register('totalHours', { valueAsNumber: true })}
            aria-invalid={!!errors.totalHours}
          />
          {errors.totalHours && (
            <p className="text-xs text-destructive">{errors.totalHours.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`notes-${staffId}-${shiftDate}`} className="text-xs">
            Notas
          </Label>
          <Input
            id={`notes-${staffId}-${shiftDate}`}
            type="text"
            {...register('notes')}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
