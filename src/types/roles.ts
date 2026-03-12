export const USER_ROLES = ['admin', 'banco_sangre', 'comercial', 'operativo'] as const

export type UserRole = (typeof USER_ROLES)[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  banco_sangre: 'Banco de Sangre',
  comercial: 'Comercial',
  operativo: 'Operativo',
}
