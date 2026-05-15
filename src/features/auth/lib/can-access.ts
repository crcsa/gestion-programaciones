import { isOperationalArea, type Area } from '@/types/areas'
import type { Role } from '@/types/roles'
import type { Scope } from '@/types/scope'
import { isCommercialAdmin } from '@/lib/auth/area-gates'

export interface AccessRequirement {
  /** Roles permitidos. El usuario debe tener uno de estos. */
  roles: Role[]
  /**
   * Áreas permitidas. Si se especifica, el área del usuario debe estar en la
   * lista, o el usuario debe pasar otro check (admin global, comercial con
   * `allowCrossArea`).
   */
  areas?: Area[]
  /**
   * Si true, comercial pasa cross-area aunque su área (`comercial`) no esté en
   * `areas`. Útil para endpoints de lectura donde comercial ve todo.
   */
  allowCrossArea?: boolean
  /** Si true, el área debe ser banco_sangre o logistica (descarta comercial). */
  requireOperationalArea?: boolean
}

export type CanAccessResult =
  | { allowed: true; scope: Scope }
  | { allowed: false; reason: 'role' | 'requireOperationalArea' | 'area' }

/**
 * Predicate puro de autorización. NO lanza, NO usa cookies, NO toca DB.
 *
 * Es la **única fuente de verdad** para decidir si un contexto puede ejecutar
 * una operación. Tres consumers:
 *
 * 1. `requireAccess` (server-only): la envuelve para lanzar `PermissionError`.
 * 2. `<AreaGate>` (client): la consume para decidir si renderizar children.
 * 3. `middleware` y `sidebar`: la consumen para gates de UI / redirects.
 *
 * Devuelve además el `Scope` resuelto cuando `allowed: true` para que el
 * consumer no tenga que re-derivarlo.
 */
export function canAccess(
  ctx: { role: Role; area: Area | null },
  req: AccessRequirement,
): CanAccessResult {
  if (!req.roles.includes(ctx.role)) {
    return { allowed: false, reason: 'role' }
  }

  // Admin global: pasa todos los checks de área. Scope global.
  if (ctx.role === 'admin') {
    return { allowed: true, scope: { kind: 'global' } }
  }

  // Comercial cross-área: scope global (lee todas las áreas) en endpoints donde
  // el caller habilita `allowCrossArea`. Resolvemos ANTES del check de `areas`
  // para que comercial no caiga al final con scope acotado a `comercial`.
  if (req.allowCrossArea && isCommercialAdmin(ctx.role, ctx.area)) {
    return { allowed: true, scope: { kind: 'global' } }
  }

  if (req.requireOperationalArea) {
    if (!ctx.area || !isOperationalArea(ctx.area)) {
      return { allowed: false, reason: 'requireOperationalArea' }
    }
  }

  if (req.areas && req.areas.length > 0) {
    const inAllowed = ctx.area && req.areas.includes(ctx.area)
    if (!inAllowed) {
      return { allowed: false, reason: 'area' }
    }
  }

  // Si llegamos acá el área es válida; scope acotado al área del usuario.
  // Si no tiene área (no debería ocurrir para non-admin), tratamos como global.
  return ctx.area
    ? { allowed: true, scope: { kind: 'area', area: ctx.area } }
    : { allowed: true, scope: { kind: 'global' } }
}
