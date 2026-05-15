import { z } from 'zod'

export const upsertShiftSchema = z.object({
  staffId: z.uuid({ error: 'ID de colaborador no valido' }),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida'),
  shiftType: z.enum(['diurno_completo', 'noche', 'posturno'], {
    error: 'Tipo de turno no valido',
  }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora invalida (HH:MM)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora invalida (HH:MM)'),
  totalHours: z
    .number()
    .int()
    .min(1, 'Minimo 1 hora')
    .max(12, 'Maximo 12 horas por turno'),
  isOvernight: z.boolean(),
  notes: z.string().optional(),
})

export type UpsertShiftInput = z.infer<typeof upsertShiftSchema>
