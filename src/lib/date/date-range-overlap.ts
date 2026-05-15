import { and, lte, sql, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * Predicado SQL para detectar solapes entre el rango de una fila (columnas
 * `startCol`/`endCol`, donde `endCol` puede ser NULL → se interpreta como =
 * `startCol`) y un rango externo `[rangeStart, rangeEnd]`.
 *
 * Equivalente a: `start <= rangeEnd AND COALESCE(end, start) >= rangeStart`.
 *
 * Centraliza la lógica que antes vivía inline en logistics y evita bugs de
 * off-by-one cuando se replica.
 */
export function dateRangeOverlapSql(
  startCol: AnyPgColumn,
  endCol: AnyPgColumn,
  range: { start: string; end: string },
): SQL {
  const overlap = and(
    lte(startCol, range.end),
    sql`COALESCE(${endCol}, ${startCol}) >= ${range.start}`,
  )
  // `and()` con dos predicados nunca devuelve undefined, pero TS lo modela así.
  if (!overlap) throw new Error('Unreachable: dateRangeOverlapSql produced undefined')
  return overlap
}

/** Helper de plain JS para los predicados de overlap por fechas (YYYY-MM-DD). */
export function dateRangesOverlap(
  a: { start: string; end?: string | null },
  b: { start: string; end: string },
): boolean {
  const aEnd = a.end ?? a.start
  return a.start <= b.end && aEnd >= b.start
}
