import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/

export const campaignDayScheduleSchema = z.object({
  dayDate: z.string().regex(dateRegex, 'Fecha inválida (YYYY-MM-DD)'),
  startTime: z.string().regex(timeRegex, 'Hora inválida (HH:MM)').transform((v) => v.slice(0, 5)),
  endTime: z.string().regex(timeRegex, 'Hora inválida (HH:MM)').transform((v) => v.slice(0, 5)),
  isOvernight: z.boolean().optional(),
})

export const createCampaignSchema = z
  .object({
    code: z.string().min(3, 'El codigo debe tener al menos 3 caracteres'),
    companyId: z.uuid().optional(),
    locationId: z.uuid().optional(),
    campaignDate: z.string().regex(dateRegex, 'Fecha invalida (YYYY-MM-DD)'),
    endDate: z.string().regex(dateRegex, 'Fecha invalida (YYYY-MM-DD)').optional(),
    startTime: z.string().regex(timeRegex, 'Hora invalida (HH:MM)').transform((v) => v.slice(0, 5)).optional(),
    endTime: z.string().regex(timeRegex, 'Hora invalida (HH:MM)').transform((v) => v.slice(0, 5)).optional(),
    dailySchedules: z.array(campaignDayScheduleSchema).optional(),
    size: z.enum(['S', 'S_plus', 'M', 'L'], { error: 'Tamano no valido' }),
    modality: z.enum(
      ['corporativa', 'carpa', 'unidad_movil', 'municipal', 'combinada'],
      { error: 'Modalidad no valida' },
    ),
    municipality: z.string().min(2, 'El municipio debe tener al menos 2 caracteres'),
    expectedDonations: z.number().int().min(1).optional(),
    trainingAreaId: z.uuid().optional(),
    observations: z.string().optional(),
    hexabankCode: z.string().max(50).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.endDate && d.endDate < d.campaignDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
        path: ['endDate'],
      })
    }
    if (d.endDate && d.endDate > d.campaignDate) {
      const expected = expandedDayCount(d.campaignDate, d.endDate)
      const provided = d.dailySchedules?.length ?? 0
      if (provided !== expected) {
        ctx.addIssue({
          code: 'custom',
          message: `Se requieren ${expected} horarios diarios (uno por cada día del rango), recibidos ${provided}`,
          path: ['dailySchedules'],
        })
      }
    }
  })

function expandedDayCount(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  return Math.round((e.getTime() - s.getTime()) / (24 * 3600 * 1000)) + 1
}

export const updateCampaignSchema = z.object({
  id: z.uuid({ error: 'ID de campaña no válido' }),
  code: z.string().min(3).optional(),
  companyId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  campaignDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  startTime: z.string().regex(timeRegex).transform((v) => v.slice(0, 5)).optional(),
  endTime: z.string().regex(timeRegex).transform((v) => v.slice(0, 5)).optional(),
  dailySchedules: z.array(campaignDayScheduleSchema).optional(),
  size: z.enum(['S', 'S_plus', 'M', 'L']).optional(),
  modality: z.enum(['corporativa', 'carpa', 'unidad_movil', 'municipal', 'combinada']).optional(),
  municipality: z.string().min(2).optional(),
  expectedDonations: z.number().int().min(1).optional(),
  trainingAreaId: z.uuid().optional(),
  observations: z.string().optional(),
  hexabankCode: z.string().max(50).optional(),
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
  modality: z.enum(['corporativa', 'carpa', 'unidad_movil', 'municipal', 'combinada']),
  expectedDonations: z.number().int().min(1).optional(),
  observations: z.string().optional(),
})

export type CampaignDaySchedule = z.infer<typeof campaignDayScheduleSchema>
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
export type CancelCampaignInput = z.infer<typeof cancelCampaignSchema>
export type ImportExcelRow = z.infer<typeof importExcelRowSchema>
