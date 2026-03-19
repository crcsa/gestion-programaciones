import { z } from 'zod'

export const createCompanySchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  nit: z
    .string()
    .regex(/^\d{8,10}-\d$/, 'Formato de NIT inválido (ej: 123456789-0)')
    .optional(),
  contactName: z.string().max(100).optional(),
  contactPhone: z
    .string()
    .regex(/^[0-9+\-\s]{7,20}$/, 'Número de teléfono inválido')
    .optional(),
  contactEmail: z.string().email('Correo electrónico inválido').optional(),
  address: z.string().max(300).optional(),
  municipality: z.string().max(100).optional(),
  department: z.string().max(100).default('Antioquia'),
})

export const updateCompanySchema = createCompanySchema.partial().extend({
  id: z.uuid({ error: 'ID de empresa no válido' }),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
