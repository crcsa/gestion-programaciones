export type Role = 'admin' | 'admin_area' | 'comercial' | 'operativo'

export const ROLES = {
  ADMIN: 'admin' as const,
  /** Admin de un área operativa (banco_sangre o logistica). Antes `banco_sangre`. */
  ADMIN_AREA: 'admin_area' as const,
  COMERCIAL: 'comercial' as const,
  OPERATIVO: 'operativo' as const,
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  admin_area: 'Administrador de Área',
  comercial: 'Comercial',
  operativo: 'Operativo',
}

export const VALID_ROLES: readonly Role[] = ['admin', 'admin_area', 'comercial', 'operativo']

export function parseRole(value: unknown): Role | null {
  if (typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value)) {
    return value as Role
  }
  return null
}
