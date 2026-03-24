export type Role = 'admin' | 'banco_sangre' | 'comercial' | 'operativo'

export const ROLES = {
  ADMIN: 'admin' as const,
  BANCO_SANGRE: 'banco_sangre' as const,
  COMERCIAL: 'comercial' as const,
  OPERATIVO: 'operativo' as const,
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  banco_sangre: 'Banco de Sangre',
  comercial: 'Comercial',
  operativo: 'Operativo',
}

export const VALID_ROLES: readonly Role[] = ['admin', 'banco_sangre', 'comercial', 'operativo']

export function parseRole(value: unknown): Role | null {
  if (typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value)) {
    return value as Role
  }
  return null
}
