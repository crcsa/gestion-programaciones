import { z } from 'zod'

export const assignWithValidationSchema = z.object({
  campaignId: z.uuid({ error: 'ID de campaña no válido' }),
  staffId: z.uuid({ error: 'ID de funcionario no válido' }),
  forceOverride: z.boolean().default(false),
})

export type AssignWithValidationInput = z.infer<typeof assignWithValidationSchema>
