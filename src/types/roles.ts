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
