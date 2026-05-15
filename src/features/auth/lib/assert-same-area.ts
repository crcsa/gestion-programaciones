import { PermissionError } from '@/lib/errors/app-errors'
import type { Area } from '@/types/areas'
import type { Role } from '@/types/roles'

/**
 * Verifica que el caller pueda tocar un recurso del área `resourceArea`.
 * Admin global (`ctx.role === 'admin'`) pasa siempre; admins de área solo si
 * coincide.
 *
 * Lanza `PermissionError` si la regla no se cumple.
 */
export function assertSameArea(
  ctx: { role: Role; area: Area | null },
  resourceArea: Area | null | undefined,
  resourceLabel = 'recurso',
): void {
  if (ctx.role === 'admin') return
  if (resourceArea == null) {
    throw new PermissionError(`No tienes permiso para modificar este ${resourceLabel}.`)
  }
  if (resourceArea !== ctx.area) {
    throw new PermissionError(`No tienes permiso para modificar ${resourceLabel} de otra área.`)
  }
}
