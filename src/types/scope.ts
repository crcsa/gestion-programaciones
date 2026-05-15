import type { Area } from './areas'

/**
 * Resolución del scope de área para una operación. Producido por
 * `requireAccess` y consumido por server actions para evitar las ramas
 * `if (ctx.role === 'admin') ... else ...` repartidas por el código.
 *
 * - `{ kind: 'global' }` → super-admin u operación cross-área (lectura
 *   comercial). El consumer NO filtra por área.
 * - `{ kind: 'area', area }` → operación acotada a un área concreta. El
 *   consumer agrega `WHERE area = scope.area` o equivalente.
 *
 * Uso típico:
 *
 * ```ts
 * const { scope } = await requireAccess({ roles: [...], areas: [...] })
 * const conditions = scope.kind === 'area'
 *   ? eq(staffMembers.area, scope.area)
 *   : undefined
 * ```
 */
export type Scope =
  | { kind: 'global' }
  | { kind: 'area'; area: Area }

/** Helper para aplicar el scope a queries de Drizzle (devuelve undefined si global). */
export function scopeToAreaFilter<T>(
  scope: Scope,
  builder: (area: Area) => T,
): T | undefined {
  return scope.kind === 'area' ? builder(scope.area) : undefined
}
