import { z } from 'zod'
import { passwordSchema } from './user-schemas'

export const updateMyProfileSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  email: z.string().email('Correo electrónico inválido'),
})

export const changeMyPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>
export type ChangeMyPasswordInput = z.infer<typeof changeMyPasswordSchema>
