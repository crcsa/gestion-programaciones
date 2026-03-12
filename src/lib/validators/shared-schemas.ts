import { z } from 'zod'

export const idSchema = z.string().uuid()

export const emailSchema = z.string().email({ error: 'Correo electrónico inválido' })

export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s()-]{7,20}$/, { error: 'Teléfono inválido' })
  .optional()

export const documentNumberSchema = z
  .string()
  .min(5, { error: 'Documento debe tener al menos 5 caracteres' })
  .max(20)

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Formato de fecha inválido (YYYY-MM-DD)' })

export const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, { error: 'Formato de hora inválido (HH:MM)' })

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
