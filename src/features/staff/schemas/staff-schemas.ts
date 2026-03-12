import { z } from 'zod'
import {
  documentNumberSchema,
  phoneSchema,
  paginationSchema,
} from '@/lib/validators/shared-schemas'

const PROFILE_TYPES = ['bacteriologo', 'medico', 'tecnico_operativo', 'tecnico_administrativo'] as const
const SHIFT_TYPES = ['completo', 'noche', 'posturno'] as const

export const createStaffSchema = z.object({
  documentNumber: documentNumberSchema,
  firstName: z
    .string()
    .min(2, { error: 'Nombre debe tener al menos 2 caracteres' })
    .max(100),
  lastName: z
    .string()
    .min(2, { error: 'Apellido debe tener al menos 2 caracteres' })
    .max(100),
  phone: phoneSchema,
  profileType: z.enum(PROFILE_TYPES, {
    error: 'Tipo de perfil inválido',
  }),
  contractType: z.string().max(50).optional(),
  weeklyContractHours: z.coerce
    .number()
    .int()
    .min(1, { error: 'Mínimo 1 hora' })
    .max(48, { error: 'Máximo 48 horas' })
    .default(44),
  maxOvertimeWeekly: z.coerce
    .number()
    .int()
    .min(0)
    .max(24)
    .default(12),
  maxShiftHours: z.coerce
    .number()
    .int()
    .min(4)
    .max(16)
    .default(12),
  defaultShiftType: z.enum(SHIFT_TYPES).optional(),
  trainingAreaIds: z.array(z.string().uuid()).optional(),
})

export const updateStaffSchema = createStaffSchema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
})

export const staffFilterSchema = paginationSchema.extend({
  search: z.string().optional(),
  profileType: z.enum(PROFILE_TYPES).optional(),
  isActive: z.coerce.boolean().optional(),
  trainingAreaId: z.string().uuid().optional(),
  sortBy: z
    .enum(['firstName', 'lastName', 'documentNumber', 'profileType', 'createdAt'])
    .default('lastName'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
})

export type CreateStaffInput = z.infer<typeof createStaffSchema>
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>
export type StaffFilterInput = z.infer<typeof staffFilterSchema>
