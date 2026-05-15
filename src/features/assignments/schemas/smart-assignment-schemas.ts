import { z } from 'zod'

export const assignWithValidationSchema = z.object({
  campaignId: z.uuid({ error: 'ID de campaña no válido' }),
  staffId: z.uuid({ error: 'ID de colaborador no válido' }),
  forceOverride: z.boolean().default(false),
})

export type AssignWithValidationInput = z.infer<typeof assignWithValidationSchema>

export const assignBatchWithValidationSchema = z.object({
  campaignId: z.uuid({ error: 'ID de campaña no válido' }),
  staffIds: z.array(z.uuid({ error: 'ID de colaborador no válido' })).min(1, 'Debe seleccionar al menos un colaborador'),
  forceOverride: z.boolean().default(false),
})

export type AssignBatchWithValidationInput = z.infer<typeof assignBatchWithValidationSchema>
