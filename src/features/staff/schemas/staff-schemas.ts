import { z } from 'zod'
import { VALID_AREAS, AREA_LABELS, type Area } from '@/types/areas'
import {
  STAFF_PROFILE_VALUES,
  STAFF_PROFILE_LABELS,
  ALLOWED_PROFILES_BY_AREA,
  isProfileAllowedForArea,
} from '@/features/staff/lib/constants'

const areaEnum = z.enum(VALID_AREAS as readonly [Area, ...Area[]])

const staffProfileEnum = z.enum(STAFF_PROFILE_VALUES, { error: 'Perfil de staff no valido' })

const contractTypeEnum = z.enum(
  ['indefinido', 'fijo', 'prestacion_servicios', 'aprendizaje'],
  { error: 'Tipo de contrato no valido' },
)

const defaultShiftEnum = z.enum(['diurno_completo', 'noche', 'posturno'], {
  error: 'Turno no valido',
})

/**
 * Cross-field invariant compartido por create y update:
 * el `staffProfile` debe estar en `ALLOWED_PROFILES_BY_AREA[area]`.
 *
 * - `banco_sangre`: bacteriologo, tecnico, medico, auxiliar.
 * - `comercial`: comercial.
 * - `logistica`: conductor.
 *
 * Aplicado vía `superRefine` para que update también valide (los campos son
 * opcionales en update; sólo se valida cuando ambos están presentes).
 */
function applyProfileAreaInvariant(
  data: { staffProfile?: (typeof STAFF_PROFILE_VALUES)[number]; area?: Area },
  ctx: z.RefinementCtx,
) {
  if (!data.staffProfile || !data.area) return
  if (isProfileAllowedForArea(data.staffProfile, data.area)) return

  const profileLabel = STAFF_PROFILE_LABELS[data.staffProfile]
  const areaLabel = AREA_LABELS[data.area]
  const allowed = ALLOWED_PROFILES_BY_AREA[data.area]
    .map((p) => STAFF_PROFILE_LABELS[p])
    .join(', ')

  ctx.addIssue({
    code: 'custom',
    path: ['staffProfile'],
    message: `El perfil "${profileLabel}" no es válido para el área "${areaLabel}". Permitidos: ${allowed}.`,
  })
}

export const createStaffSchema = z
  .object({
    firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    lastName: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
    cedula: z
      .string()
      .min(5, 'La cedula debe tener entre 5 y 12 caracteres')
      .max(12, 'La cedula debe tener entre 5 y 12 caracteres')
      .regex(/^\d+$/, 'La cedula debe contener solo numeros'),
    phone: z.string().optional(),
    email: z.string().email('El correo electronico no es valido'),
    staffProfile: staffProfileEnum,
    contractType: contractTypeEnum.optional(),
    weeklyHours: z
      .number()
      .int('Las horas semanales deben ser un numero entero')
      .min(20, 'Las horas semanales minimas son 20')
      .max(48, 'Las horas semanales maximas son 48'),
    defaultShift: defaultShiftEnum.optional(),
    hireDate: z.string().optional(),
    notes: z.string().optional(),
    trainingAreaIds: z.array(z.string().uuid()).optional(),
    // Solo admins globales pueden especificar área distinta a la suya. Si el
    // caller es admin de área, este campo se ignora y se fuerza al área del caller.
    area: areaEnum.optional(),
  })
  .superRefine(applyProfileAreaInvariant)

export const updateStaffSchema = z
  .object({
    id: z.string().uuid('ID de colaborador no valido'),
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
    staffProfile: staffProfileEnum.optional(),
    contractType: contractTypeEnum.optional(),
    weeklyHours: z
      .number()
      .int()
      .min(20, 'Las horas semanales minimas son 20')
      .max(48, 'Las horas semanales maximas son 48')
      .optional(),
    defaultShift: defaultShiftEnum.optional(),
    hireDate: z.string().optional(),
    notes: z.string().optional(),
    trainingAreaIds: z.array(z.string().uuid()).optional(),
    area: areaEnum.optional(),
  })
  .superRefine(applyProfileAreaInvariant)

export type CreateStaffInput = z.infer<typeof createStaffSchema>
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>
