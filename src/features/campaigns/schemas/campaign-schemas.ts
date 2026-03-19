import { z } from 'zod'

export const createCampaignSchema = z.object({
  code: z.string().min(3, 'El codigo debe tener al menos 3 caracteres'),
  companyId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  campaignDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida (YYYY-MM-DD)'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora invalida (HH:MM)').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora invalida (HH:MM)').optional(),
  size: z.enum(['S', 'S_plus', 'M', 'L'], { error: 'Tamano no valido' }),
  modality: z.enum(
    ['presencial', 'virtual', 'mixta', 'movil', 'institucional'],
    { error: 'Modalidad no valida' },
  ),
  municipality: z.string().min(2, 'El municipio debe tener al menos 2 caracteres'),
  expectedDonations: z.number().int().min(1).optional(),
  trainingAreaId: z.uuid().optional(),
  observations: z.string().optional(),
})

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  id: z.uuid({ error: 'ID de campaña no válido' }),
})

export const cancelCampaignSchema = z.object({
  id: z.uuid({ error: 'ID de campaña no válido' }),
  cancelReason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
})

export const importExcelRowSchema = z.object({
  code: z.string().min(1),
  companyName: z.string().min(1),
  municipality: z.string().min(1),
  campaignDate: z.string(),
  size: z.enum(['S', 'S_plus', 'M', 'L']),
  modality: z.enum(['presencial', 'virtual', 'mixta', 'movil', 'institucional']),
  expectedDonations: z.number().int().min(1).optional(),
  observations: z.string().optional(),
})

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
export type CancelCampaignInput = z.infer<typeof cancelCampaignSchema>
export type ImportExcelRow = z.infer<typeof importExcelRowSchema>
