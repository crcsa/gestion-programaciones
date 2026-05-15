import { z } from 'zod'

export const weeklyAvailabilityGridSchema = z.object({
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  staffProfile: z
    .enum(['bacteriologo', 'tecnico', 'medico', 'auxiliar', 'comercial'])
    .optional(),
  trainingAreaId: z.uuid().optional(),
})

export const setAvailabilityOverrideSchema = z.object({
  staffId: z.uuid({ error: 'ID de colaborador no válido' }),
  availabilityDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  status: z.enum(['vacaciones', 'incapacidad', 'licencia']),
  notes: z.string().max(500).optional(),
})

export type WeeklyAvailabilityGridInput = z.infer<typeof weeklyAvailabilityGridSchema>
export type SetAvailabilityOverrideInput = z.infer<typeof setAvailabilityOverrideSchema>
