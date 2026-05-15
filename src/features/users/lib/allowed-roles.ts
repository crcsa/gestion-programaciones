import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'

/**
 * Roles que el caller puede asignar al crear/actualizar otro usuario.
 *
 * - Super-admin (`role='admin'`): puede crear cualquier rol (admin global,
 *   admin de área, comercial o operativo).
 * - admin_area: puede crear solo `admin_area` (otro admin de su misma área)
 *   u `operativo` (dar credenciales a un staff de su área). NO puede crear
 *   `admin` global ni `comercial`.
 *
 * Es la **única fuente de verdad** para el dropdown de roles tanto en
 * `user-form-client` como en `CreateCredentialsModal` y para la guarda del
 * server action `createUser`.
 */
export function getAllowedRolesForCaller(
  callerRole: Role,
  _callerArea: Area | null,
): readonly Role[] {
  if (callerRole === 'admin') {
    return ['admin', 'admin_area', 'comercial', 'operativo']
  }
  if (callerRole === 'admin_area') {
    return ['admin_area', 'operativo']
  }
  return []
}
