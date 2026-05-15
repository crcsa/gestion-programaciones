import { z } from 'zod'

const currentYear = new Date().getFullYear()

export const createVehicleSchema = z.object({
  plate: z
    .string()
    .min(3, 'La placa debe tener al menos 3 caracteres')
    .max(20, 'La placa debe tener máximo 20 caracteres')
    .regex(/^[A-Z0-9-]+$/i, 'La placa solo admite letras, números y guiones'),
  mobileNumber: z
    .string()
    .min(1, 'Indique el número de móvil')
    .max(20, 'El número de móvil debe tener máximo 20 caracteres')
    .optional(),
  model: z.string().max(120).optional(),
  year: z
    .number()
    .int('El año debe ser entero')
    .min(1980, 'El año mínimo es 1980')
    .max(currentYear + 1, 'El año excede el rango permitido')
    .optional(),
  capacity: z
    .number()
    .int('La capacidad debe ser un entero')
    .min(1, 'La capacidad mínima es 1')
    .max(99, 'La capacidad máxima es 99')
    .optional(),
  notes: z.string().max(500).optional(),
})

export const updateVehicleSchema = z.object({
  id: z.string().uuid('ID de vehículo no válido'),
  plate: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9-]+$/i)
    .optional(),
  mobileNumber: z.string().max(20).optional(),
  model: z.string().max(120).optional(),
  year: z.number().int().min(1980).max(currentYear + 1).optional(),
  capacity: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
})

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>
