import { z } from 'zod'
import {
  effectiveShiftHours,
  MIN_EFFECTIVE_HOURS_DIURNO,
  SEDE_SHIFT_DEFAULTS,
  type ShiftType,
} from '@/features/sede/lib/shift-defaults'

// Tipos de turno diurno que descuentan 1h de almuerzo y exigen el mínimo de
// 8h efectivas. `servicios_transfusionales` se comporta exactamente como
// `diurno_completo` (07:00–17:00, 9h efectivas, no pernocta).
const MIN_HOURS_SHIFT_TYPES = ['diurno_completo', 'servicios_transfusionales'] as const

function requiresMinEffectiveHours(shiftType: string): boolean {
  return (MIN_HOURS_SHIFT_TYPES as readonly string[]).includes(shiftType)
}

/**
 * Refine compartido: turnos diurnos (`diurno_completo` /
 * `servicios_transfusionales`) deben tener al menos 8h efectivas (después de
 * descontar 1h de almuerzo). Bloquear desde Zod nos da un error temprano
 * consistente create/update/bulk; el server action es defensa profunda.
 */
function diurnoMinHoursIssue(
  startTime: string,
  endTime: string,
  isOvernight: boolean,
  shiftType: ShiftType,
): string | null {
  const eff = effectiveShiftHours(startTime, endTime, isOvernight, shiftType)
  if (eff < MIN_EFFECTIVE_HOURS_DIURNO) {
    return `El turno debe tener al menos ${MIN_EFFECTIVE_HOURS_DIURNO}h efectivas (descontando 1h de almuerzo). Actualmente: ${eff}h.`
  }
  return null
}

export const createSedeShiftSchema = z
  .object({
    staffId: z.string().uuid({ message: 'ID de colaborador no válido' }),
    shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
    shiftType: z.enum(['diurno_completo', 'noche', 'posturno', 'servicios_transfusionales'], {
      message: 'Tipo de turno inválido',
    }),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
    isOvernight: z.boolean(),
    extraHours: z.coerce
      .number()
      .int('Las horas extras deben ser un número entero')
      .min(0, 'Las horas extras no pueden ser negativas')
      .max(6, 'Las horas extras no pueden superar 6h')
      .optional()
      .default(0),
    notes: z.string().max(300, 'Las notas no pueden superar los 300 caracteres').optional(),
  })
  .refine((d) => d.isOvernight || (d.extraHours ?? 0) === 0, {
    message: 'Solo los turnos con pernocta pueden registrar horas extras',
    path: ['extraHours'],
  })
  .superRefine((d, ctx) => {
    if (!requiresMinEffectiveHours(d.shiftType)) return
    const msg = diurnoMinHoursIssue(d.startTime, d.endTime, d.isOvernight, d.shiftType)
    if (msg) ctx.addIssue({ code: 'custom', message: msg, path: ['endTime'] })
  })

export const updateSedeShiftSchema = z
  .object({
    shiftType: z
      .enum(['diurno_completo', 'noche', 'posturno', 'servicios_transfusionales'], { message: 'Tipo de turno inválido' })
      .optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido').optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido').optional(),
    isOvernight: z.boolean().optional(),
    extraHours: z.coerce
      .number()
      .int('Las horas extras deben ser un número entero')
      .min(0, 'Las horas extras no pueden ser negativas')
      .max(6, 'Las horas extras no pueden superar 6h')
      .optional(),
    notes: z.string().max(300, 'Las notas no pueden superar los 300 caracteres').optional(),
  })
  .refine(
    (d) => {
      if (d.extraHours === undefined || d.extraHours === 0) return true
      return d.isOvernight === true
    },
    {
      message: 'Solo los turnos con pernocta pueden registrar horas extras',
      path: ['extraHours'],
    },
  )

export const dayAssignmentItemSchema = z
  .object({
    staffId: z.string().uuid({ message: 'ID de colaborador no válido' }),
    shiftType: z.enum(['diurno_completo', 'noche', 'posturno', 'servicios_transfusionales'], {
      message: 'Tipo de turno inválido',
    }),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido').optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido').optional(),
    isOvernight: z.boolean().optional(),
    extraHours: z.coerce
      .number()
      .int()
      .min(0)
      .max(6)
      .optional(),
    notes: z.string().max(300).optional(),
  })
  .refine((d) => (d.extraHours ?? 0) === 0 || d.isOvernight === true, {
    message: 'Solo turnos con pernocta pueden tener horas extras',
    path: ['extraHours'],
  })
  .superRefine((d, ctx) => {
    if (!requiresMinEffectiveHours(d.shiftType)) return
    // En bulk los campos son opcionales: si no vienen, usamos los defaults del
    // tipo (07:00–17:00) — eso siempre cumple 8h. Solo evaluamos cuando el
    // caller envió tiempos custom.
    const start = d.startTime ?? SEDE_SHIFT_DEFAULTS[d.shiftType as ShiftType].startTime
    const end = d.endTime ?? SEDE_SHIFT_DEFAULTS[d.shiftType as ShiftType].endTime
    const overnight = d.isOvernight ?? SEDE_SHIFT_DEFAULTS[d.shiftType as ShiftType].isOvernight
    const msg = diurnoMinHoursIssue(start, end, overnight, d.shiftType as ShiftType)
    if (msg) ctx.addIssue({ code: 'custom', message: msg, path: ['endTime'] })
  })

export const bulkUpsertDayShiftsSchema = z.object({
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  assignments: z.array(dayAssignmentItemSchema).max(200),
})

export type CreateSedeShiftInput = z.input<typeof createSedeShiftSchema>
export type UpdateSedeShiftInput = z.input<typeof updateSedeShiftSchema>
export type DayAssignmentItem = z.input<typeof dayAssignmentItemSchema>
export type BulkUpsertDayShiftsInput = z.input<typeof bulkUpsertDayShiftsSchema>
