import { z } from 'zod'

export const importStaffRowSchema = z.object({
  cedula: z.string().min(5, 'Cedula invalida (minimo 5 caracteres)'),
  firstName: z.string().min(2, 'Nombres invalido'),
  lastName: z.string().min(2, 'Apellidos invalido'),
  staffProfile: z.enum(['bacteriologo', 'tecnico', 'medico', 'auxiliar', 'comercial'], {
    message: 'Perfil invalido',
  }),
  contractType: z.enum(['indefinido', 'fijo', 'prestacion_servicios', 'aprendizaje']).optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalido').optional(),
  hireDate: z.string().optional(),
})

export type ImportStaffRowInput = z.infer<typeof importStaffRowSchema>
