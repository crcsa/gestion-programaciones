import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'

/**
 * Helpers de visibilidad compartidos por middleware, sidebar y server actions.
 * Centralizan la regla "admin global pasa siempre; admin de área debe coincidir".
 *
 * Si la regla cambia (p.ej. renombrar `banco_sangre` a `admin_area`), se ajusta
 * solo aquí.
 */

export function isAreaAdmin(role: Role | string | null | undefined): boolean {
  return role === 'admin' || role === 'admin_area'
}

export function canAccessLogistics(
  role: Role | string | null | undefined,
  area: Area | null | undefined,
): boolean {
  if (role === 'admin') return true
  return role === 'admin_area' && area === 'logistica'
}

export function canAccessBancoSangre(
  role: Role | string | null | undefined,
  area: Area | null | undefined,
): boolean {
  if (role === 'admin') return true
  return role === 'admin_area' && area === 'banco_sangre'
}

/**
 * "Puede editar lo comercial": admin global, role=comercial, o admin_area+comercial.
 * Es una alias semántica de `isCommercialAdmin` extendida con admin global
 * (canAccess hace lo mismo internamente — esto es el predicate UI-friendly).
 */
export function canAccessCommercial(
  role: Role | string | null | undefined,
  area: Area | null | undefined,
): boolean {
  if (role === 'admin') return true
  return isCommercialAdmin(role, area)
}

export function canAccessAdminOnly(role: Role | string | null | undefined): boolean {
  return role === 'admin'
}

/**
 * "Admin del área comercial" — cualquiera de las dos formas válidas:
 *   1) `role='comercial' + area='comercial'` (forma legacy)
 *   2) `role='admin_area' + area='comercial'` (forma simétrica)
 *
 * Es la fuente única de verdad para el predicate; consumido por `canAccess`,
 * por la decisión de `canEditCommercial` en panels y por server actions de
 * notificaciones / reportes que comparten esta regla.
 */
export function isCommercialAdmin(
  role: Role | string | null | undefined,
  area: Area | null | undefined,
): boolean {
  return role === 'comercial' || (role === 'admin_area' && area === 'comercial')
}
