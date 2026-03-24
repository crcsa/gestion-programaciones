import { z } from 'zod'

export const createSedeShiftSchema = z.object({
  staffId: z.string().uuid({ message: 'ID de funcionario no válido' }),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  shiftType: z.enum(['diurno_completo', 'noche', 'posturno'], {
    message: 'Tipo de turno inválido',
  }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
  isOvernight: z.boolean(),
  notes: z.string().max(300, 'Las notas no pueden superar los 300 caracteres').optional(),
})

export const updateSedeShiftSchema = createSedeShiftSchema
  .partial()
  .omit({ staffId: true, shiftDate: true })

export type CreateSedeShiftInput = z.infer<typeof createSedeShiftSchema>
export type UpdateSedeShiftInput = z.infer<typeof updateSedeShiftSchema>
