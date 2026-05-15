import { z } from 'zod'

export const assignStaffSchema = z.object({
  campaignId: z.uuid({ error: 'ID de campaña no válido' }),
  staffIds: z.array(z.uuid()).min(1, 'Debe seleccionar al menos un colaborador'),
})

export const setCoordinatorSchema = z.object({
  campaignId: z.uuid({ error: 'ID de campaña no válido' }),
  staffId: z.uuid({ error: 'ID de colaborador no válido' }),
})

export type AssignStaffInput = z.infer<typeof assignStaffSchema>
export type SetCoordinatorInput = z.infer<typeof setCoordinatorSchema>
