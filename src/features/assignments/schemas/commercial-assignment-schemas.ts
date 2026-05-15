import { z } from 'zod'

/**
 * Asignación de operativos comerciales (staff con area='comercial' AND
 * staffProfile='comercial') a una campaña. Espejo del schema `assignStaff`
 * para mantener simetría entre los paneles.
 */
export const assignCommercialStaffSchema = z.object({
  campaignId: z.uuid({ error: 'ID de campaña no válido' }),
  staffIds: z.array(z.uuid()).min(1, 'Debe seleccionar al menos un operativo comercial'),
})

export type AssignCommercialStaffInput = z.infer<typeof assignCommercialStaffSchema>
