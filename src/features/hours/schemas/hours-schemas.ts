import { z } from 'zod'

export const weekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
  .refine(
    (d) => new Date(`${d}T00:00:00`).getDay() === 1,
    'La fecha debe ser un lunes',
  )

export const registerTimelineEventSchema = z.object({
  campaignId: z.uuid({ error: 'ID de campaña no válido' }),
  eventType: z.enum([
    'salida_sede',
    'llegada_punto',
    'inicio_donaciones',
    'salida_almuerzo',
    'regreso_almuerzo',
    'fin_donaciones',
    'recogida',
    'llegada_sede',
    'fin',
  ]),
  eventTime: z.string().datetime({ message: 'Formato de fecha y hora inválido' }),
  notes: z.string().max(500).optional(),
})

export type RegisterTimelineEventInput = z.infer<typeof registerTimelineEventSchema>
