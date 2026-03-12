import type { UserRole } from '@/types/roles'

export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/personal': ['admin', 'banco_sangre'],
  '/personal/nuevo': ['admin', 'banco_sangre'],
  '/campanas': ['admin', 'banco_sangre', 'comercial'],
  '/campanas/nueva': ['admin', 'comercial'],
  '/campanas/importar': ['admin', 'banco_sangre', 'comercial'],
  '/sede': ['admin', 'banco_sangre'],
  '/programacion': ['admin', 'banco_sangre', 'operativo'],
  '/disponibilidad': ['admin', 'banco_sangre', 'comercial'],
  '/reportes/horas': ['admin', 'banco_sangre'],
  '/reportes/campanas': ['admin', 'banco_sangre', 'comercial'],
  '/reportes/mensuales': ['admin', 'banco_sangre'],
  '/directorio': ['admin', 'comercial'],
  '/configuracion': ['admin'],
}

export function assertRole(
  session: { user: { role: string } } | null,
  allowedRoles: UserRole[],
): asserts session is { user: { role: UserRole } } {
  if (!session) {
    throw new Error('No autenticado')
  }
  if (!allowedRoles.includes(session.user.role as UserRole)) {
    throw new Error('No autorizado')
  }
}

export function hasPermission(role: UserRole, path: string): boolean {
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
    .sort((a, b) => b.length - a.length)
    .find((route) => path.startsWith(route))

  if (!matchedRoute) return true
  return ROUTE_PERMISSIONS[matchedRoute].includes(role)
}
