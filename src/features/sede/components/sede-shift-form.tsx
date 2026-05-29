'use client'

import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createSedeShiftSchema,
  type CreateSedeShiftInput,
} from '@/features/sede/schemas/sede-shift-schemas'
import type {
  SedeShiftRow,
  StaffListItem,
} from '@/features/sede/actions/sede-shift-actions'

// ---- Constants ------------------------------------------------------------

const SHIFT_TYPE_OPTIONS = [
  { value: 'diurno_completo', label: 'Diurno completo', startTime: '07:00', endTime: '17:00' },
  { value: 'noche', label: 'Noche', startTime: '19:00', endTime: '07:00' },
  { value: 'posturno', label: 'Posturno', startTime: '07:00', endTime: '13:00' },
  { value: 'servicios_transfusionales', label: 'Servicios transfusionales', startTime: '07:00', endTime: '17:00' },
] as const

const STAFF_PROFILE_LABELS: Record<string, string> = {
  bacteriologo: 'Bacteriologo',
  tecnico: 'Tecnico',
  medico: 'Medico',
  auxiliar: 'Auxiliar',
}

const DAYS_IN_WEEK = 6

// ---- Helpers --------------------------------------------------------------

function getWeekEndDate(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() + DAYS_IN_WEEK)
  return d.toISOString().slice(0, 10)
}

function formatStaffLabel(staff: StaffListItem): string {
  const profileLabel = STAFF_PROFILE_LABELS[staff.staffProfile] ?? staff.staffProfile
  return `${staff.lastName}, ${staff.firstName} (${profileLabel})`
}

// ---- Props ----------------------------------------------------------------

interface SedeShiftFormProps {
  staffList: StaffListItem[]
  weekShifts?: SedeShiftRow[]
  editingShiftId?: string
  defaultValues?: Partial<CreateSedeShiftInput>
  onSubmit: (data: CreateSedeShiftInput) => Promise<void>
  isLoading?: boolean
  weekStart: string
}

// ---- Component ------------------------------------------------------------

export function SedeShiftForm({
  staffList,
  weekShifts,
  editingShiftId,
  defaultValues,
  onSubmit,
  isLoading = false,
  weekStart,
}: SedeShiftFormProps) {
  const weekEnd = getWeekEndDate(weekStart)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateSedeShiftInput>({
    resolver: zodResolver(createSedeShiftSchema),
    defaultValues: {
      isOvernight: false,
      extraHours: 0,
      ...defaultValues,
    },
  })

  const selectedStaffId = watch('staffId')
  const selectedShiftType = watch('shiftType')
  const selectedShiftDate = watch('shiftDate')
  const isOvernight = watch('isOvernight')

  const availableStaff = useMemo(() => {
    if (!selectedShiftDate || !weekShifts || weekShifts.length === 0) return staffList
    const assignedIds = new Set(
      weekShifts
        .filter((s) => s.shiftDate === selectedShiftDate && s.id !== editingShiftId)
        .map((s) => s.staffId),
    )
    return staffList.filter((s) => !assignedIds.has(s.id))
  }, [staffList, weekShifts, selectedShiftDate, editingShiftId])

  const hiddenCount = staffList.length - availableStaff.length

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Staff selector */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="staffId">Colaborador</Label>
          <Select
            value={selectedStaffId ?? ''}
            onValueChange={(v) =>
              setValue('staffId', v as string, { shouldValidate: true })
            }
          >
            <SelectTrigger id="staffId" aria-invalid={!!errors.staffId} className="w-full">
              <SelectValue placeholder="Seleccionar colaborador">
                {selectedStaffId
                  ? (() => {
                      const found = staffList.find((s) => s.id === selectedStaffId)
                      return found ? formatStaffLabel(found) : undefined
                    })()
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableStaff.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  {selectedShiftDate
                    ? 'Todos los colaboradores activos ya tienen turno este día.'
                    : 'Selecciona una fecha primero.'}
                </div>
              ) : (
                availableStaff.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {formatStaffLabel(staff)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {selectedShiftDate && hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {hiddenCount} colaborador{hiddenCount === 1 ? '' : 'es'} oculto{hiddenCount === 1 ? '' : 's'}:
              ya tienen turno este día.
            </p>
          )}
          {errors.staffId && (
            <p className="text-sm text-destructive">{errors.staffId.message}</p>
          )}
        </div>

        {/* Shift date */}
        <div className="space-y-1.5">
          <Label htmlFor="shiftDate">Fecha</Label>
          <Input
            id="shiftDate"
            type="date"
            min={weekStart}
            max={weekEnd}
            {...register('shiftDate')}
            aria-invalid={!!errors.shiftDate}
          />
          {errors.shiftDate && (
            <p className="text-sm text-destructive">{errors.shiftDate.message}</p>
          )}
        </div>

        {/* Shift type */}
        <div className="space-y-1.5">
          <Label htmlFor="shiftType">Tipo de turno</Label>
          <Select
            value={selectedShiftType ?? ''}
            onValueChange={(v) => {
              setValue('shiftType', v as CreateSedeShiftInput['shiftType'], { shouldValidate: true })
              const opt = SHIFT_TYPE_OPTIONS.find((o) => o.value === v)
              if (opt) {
                setValue('startTime', opt.startTime, { shouldValidate: true })
                setValue('endTime', opt.endTime, { shouldValidate: true })
              }
            }}
          >
            <SelectTrigger id="shiftType" aria-invalid={!!errors.shiftType} className="w-full">
              <SelectValue placeholder="Seleccionar tipo">
                {selectedShiftType
                  ? (SHIFT_TYPE_OPTIONS.find((o) => o.value === selectedShiftType)?.label)
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SHIFT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.shiftType && (
            <p className="text-sm text-destructive">{errors.shiftType.message}</p>
          )}
        </div>

        {/* Start time */}
        <div className="space-y-1.5">
          <Label htmlFor="startTime">Hora inicio</Label>
          <Input
            id="startTime"
            type="time"
            {...register('startTime')}
            aria-invalid={!!errors.startTime}
          />
          {errors.startTime && (
            <p className="text-sm text-destructive">{errors.startTime.message}</p>
          )}
        </div>

        {/* End time */}
        <div className="space-y-1.5">
          <Label htmlFor="endTime">Hora fin</Label>
          <Input
            id="endTime"
            type="time"
            {...register('endTime')}
            aria-invalid={!!errors.endTime}
          />
          {errors.endTime && (
            <p className="text-sm text-destructive">{errors.endTime.message}</p>
          )}
        </div>

        {/* Is overnight */}
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="isOvernight"
            type="checkbox"
            {...register('isOvernight', {
              onChange: (e) => {
                if (!e.target.checked) {
                  setValue('extraHours', 0, { shouldValidate: true })
                }
              },
            })}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="isOvernight">Pernocta (turno cruza medianoche)</Label>
        </div>

        {/* Extra hours — only when overnight */}
        {isOvernight && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="extraHours">Horas extras (0–6h)</Label>
            <Input
              id="extraHours"
              type="number"
              min={0}
              max={6}
              step={1}
              {...register('extraHours', { valueAsNumber: true })}
              aria-invalid={!!errors.extraHours}
            />
            <p className="text-xs text-muted-foreground">
              Suman al cómputo semanal de extras incluso si la semana no excede 40h.
            </p>
            {errors.extraHours && (
              <p className="text-sm text-destructive">{errors.extraHours.message}</p>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Observaciones adicionales..."
            aria-invalid={!!errors.notes}
          />
          {errors.notes && (
            <p className="text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar turno'}
        </Button>
      </div>
    </form>
  )
}
