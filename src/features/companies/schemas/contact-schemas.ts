import { z } from 'zod'

const phoneRegex = /^[0-9+\-\s()]{7,20}$/

export const createContactSchema = z.object({
  companyId: z.uuid({ error: 'ID de empresa no válido' }),
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  position: z.string().max(100).optional(),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')),
  phone: z.string().regex(phoneRegex, 'Número de teléfono inválido').optional().or(z.literal('')),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().max(500).optional(),
})

export const updateContactSchema = createContactSchema.partial().extend({
  id: z.uuid({ error: 'ID de contacto no válido' }),
})

export const importContactRowSchema = z.object({
  companyName: z.string().min(1),
  fullName: z.string().min(1),
  position: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
})

export type CreateContactInput = z.input<typeof createContactSchema>
export type UpdateContactInput = z.input<typeof updateContactSchema>
export type ImportContactRow = z.infer<typeof importContactRowSchema>
