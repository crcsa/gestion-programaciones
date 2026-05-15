import type { Role } from '@/types/roles'
import { requireAccess } from './require-access'

/**
 * @deprecated Usa `requireAccess` directamente. Mantenido sólo como wrapper
 * retro-compatible para integraciones externas; los call sites internos ya
 * fueron migrados.
 */
export async function requireRole(
  allowedRoles: Role[],
): Promise<{ userId: string; role: Role }> {
  const ctx = await requireAccess({ roles: allowedRoles })
  return { userId: ctx.userId, role: ctx.role }
}
