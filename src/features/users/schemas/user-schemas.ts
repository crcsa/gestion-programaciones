import { z } from 'zod'
import { VALID_ROLES, type Role } from '@/types/roles'
import { VALID_AREAS, type Area } from '@/types/areas'

const roleEnum = z.enum(VALID_ROLES as readonly [Role, ...Role[]])
const areaEnum = z.enum(VALID_AREAS as readonly [Area, ...Area[]])

// Requisitos mínimos: 8 caracteres, al menos un dígito y una letra. Suficiente
// para descartar contraseñas triviales tipo "12345678" sin volverlo inviable
// dictar por canal seguro.
const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/\d/, 'Debe incluir al menos un número')
  .regex(/[A-Za-z]/, 'Debe incluir al menos una letra')

export const createUserSchema = z
  .object({
    email: z.string().email('Correo electrónico inválido'),
    password: passwordSchema,
    fullName: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
    role: roleEnum,
    /**
     * Área del usuario. Obligatoria para todos los roles excepto `admin`
     * (super-admin global, va con area=NULL).
     */
    area: areaEnum.nullable().optional(),
    staffMemberId: z.string().uuid().nullable().optional(),
  })
  .refine((d) => d.role === 'admin' || (d.staffMemberId != null && d.staffMemberId !== ''), {
    message: 'Personal es obligatorio para roles distintos de admin',
    path: ['staffMemberId'],
  })
  .refine((d) => d.role === 'admin' || (d.area != null), {
    message: 'Área es obligatoria para roles distintos de admin',
    path: ['area'],
  })

export const linkUserToStaffSchema = z.object({
  profileId: z.string().uuid(),
  staffMemberId: z.string().uuid(),
})

export const unlinkUserFromStaffSchema = z.object({
  staffMemberId: z.string().uuid(),
})

export const resetUserPasswordSchema = z.object({
  profileId: z.string().uuid(),
  newPassword: passwordSchema,
})

export const deactivateUserSchema = z.object({
  profileId: z.string().uuid(),
})

export const updateUserRoleSchema = z
  .object({
    profileId: z.string().uuid(),
    role: roleEnum,
    area: areaEnum.nullable().optional(),
  })
  .refine((d) => d.role === 'admin' || (d.area != null), {
    message: 'Área es obligatoria para roles distintos de admin',
    path: ['area'],
  })

export type CreateUserInput = z.infer<typeof createUserSchema>
export type LinkUserToStaffInput = z.infer<typeof linkUserToStaffSchema>
export type UnlinkUserFromStaffInput = z.infer<typeof unlinkUserFromStaffSchema>
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>
export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>
