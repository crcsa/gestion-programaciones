import { requireUserContext, type UserContext } from './user-context'
import { PermissionError } from '@/lib/errors/app-errors'
import { canAccess, type AccessRequirement, type CanAccessResult } from './can-access'
import type { Scope } from '@/types/scope'

export type { AccessRequirement, CanAccessResult }

/**
 * Resultado de `requireAccess`: el contexto completo del usuario más el
 * `scope` derivado (global si admin/comercial-cross, área puntual si admin
 * de área u operativo).
 */
export interface AccessResult extends UserContext {
  scope: Scope
}

type DenyReason = Extract<CanAccessResult, { allowed: false }>['reason']

const DENY_MESSAGES: Record<DenyReason, string> = {
  role: 'No tienes permiso para realizar esta accion.',
  requireOperationalArea: 'Esta accion solo aplica a areas operativas.',
  area: 'No tienes permiso para esta area.',
}

/**
 * Verifica que el usuario autenticado cumple los requisitos de acceso y
 * retorna su contexto completo más el `scope` derivado. Lanza
 * `PermissionError` si no cumple, `AuthError` si no hay sesión.
 *
 * Server-only (consume cookies vía `requireUserContext`). Para chequeos
 * desde client components usar `canAccess` directamente.
 */
export async function requireAccess(req: AccessRequirement): Promise<AccessResult> {
  const ctx = await requireUserContext()
  const result = canAccess(ctx, req)

  if (!result.allowed) {
    const reason = DENY_MESSAGES[result.reason]
    console.warn('[requireAccess] denied', {
      userId: ctx.userId,
      role: ctx.role,
      area: ctx.area,
      required: req,
      reason: result.reason,
    })
    throw new PermissionError(reason)
  }

  return { ...ctx, scope: result.scope }
}
