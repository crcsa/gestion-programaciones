import { z } from 'zod'

export const createStaffSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
  cedula: z
    .string()
    .min(5, 'La cedula debe tener entre 5 y 12 caracteres')
    .max(12, 'La cedula debe tener entre 5 y 12 caracteres')
    .regex(/^\d+$/, 'La cedula debe contener solo numeros'),
  phone: z.string().optional(),
  email: z.string().email('El correo electronico no es valido'),
  staffProfile: z.enum(
    ['bacteriologo', 'tecnico', 'medico', 'auxiliar', 'coordinador'],
    { error: 'Perfil de staff no valido' }
  ),
  contractType: z.enum(
    ['indefinido', 'fijo', 'prestacion_servicios', 'aprendizaje'],
    { error: 'Tipo de contrato no valido' }
  ),
  weeklyHours: z
    .number()
    .int('Las horas semanales deben ser un numero entero')
    .min(20, 'Las horas semanales minimas son 20')
    .max(48, 'Las horas semanales maximas son 48'),
  defaultShift: z.enum(
    ['diurno_completo', 'noche', 'posturno'],
    { error: 'Turno no valido' }
  ),
  hireDate: z.string().optional(),
  notes: z.string().optional(),
  trainingAreaIds: z.array(z.string().uuid()).optional().default([]),
})

export const updateStaffSchema = z.object({
  id: z.string().uuid('ID de funcionario no valido'),
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  lastName: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres').optional(),
  cedula: z
    .string()
    .min(5, 'La cedula debe tener entre 5 y 12 caracteres')
    .max(12, 'La cedula debe tener entre 5 y 12 caracteres')
    .regex(/^\d+$/, 'La cedula debe contener solo numeros')
    .optional(),
  phone: z.string().optional(),
  email: z.string().email('El correo electronico no es valido').optional(),
  staffProfile: z
    .enum(['bacteriologo', 'tecnico', 'medico', 'auxiliar', 'coordinador'])
    .optional(),
  contractType: z
    .enum(['indefinido', 'fijo', 'prestacion_servicios', 'aprendizaje'])
    .optional(),
  weeklyHours: z
    .number()
    .int()
    .min(20, 'Las horas semanales minimas son 20')
    .max(48, 'Las horas semanales maximas son 48')
    .optional(),
  defaultShift: z.enum(['diurno_completo', 'noche', 'posturno']).optional(),
  hireDate: z.string().optional(),
  notes: z.string().optional(),
  trainingAreaIds: z.array(z.string().uuid()).optional(),
})

export type CreateStaffInput = z.infer<typeof createStaffSchema>
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>
