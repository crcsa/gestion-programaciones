/**
 * Utilidades puras para duplicar la programación de una semana origen a una
 * semana destino: mapeo día-a-día preservando el día de la semana (L→L, M→M,
 * etc.), expansión de los 7 días de una semana ISO y detección de colisiones.
 *
 * Todas las funciones son puras y trabajan con strings ISO `YYYY-MM-DD`. NO
 * importan `db` ni dependen de `'use server'`. Pensadas para ser testeables
 * sin mocks de DB y reusables tanto en server actions como en componentes
 * cliente (preview de duplicar).
 */

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDateUTC(iso: string): number {
  if (!DATE_RE.test(iso)) {
    throw new Error(`Fecha ISO inválida: ${iso}`)
  }
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function formatDateUTC(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}

/**
 * Mapea un shift de la semana origen a la fecha equivalente en la semana
 * destino, preservando el día de la semana (offset desde el lunes origen ==
 * offset desde el lunes destino).
 *
 * Ej: origen lunes `2026-01-12`, destino lunes `2026-01-19`. Un shift del
 * `2026-01-14` (X) → `2026-01-21` (X).
 *
 * @throws si alguna fecha no cumple el formato `YYYY-MM-DD`.
 */
export function mapDateToTargetWeek(
  sourceDate: string,
  sourceWeekStart: string,
  targetWeekStart: string,
): string {
  const src = parseDateUTC(sourceDate)
  const srcStart = parseDateUTC(sourceWeekStart)
  const tgtStart = parseDateUTC(targetWeekStart)
  const offsetDays = Math.round((src - srcStart) / DAY_MS)
  return formatDateUTC(tgtStart + offsetDays * DAY_MS)
}

/**
 * Devuelve los 7 días (lunes a domingo) de una semana dado el lunes ISO.
 */
export function weekDaysFromMonday(weekStart: string): string[] {
  const start = parseDateUTC(weekStart)
  const out: string[] = []
  for (let i = 0; i < 7; i += 1) {
    out.push(formatDateUTC(start + i * DAY_MS))
  }
  return out
}

/**
 * Colisión detectada al duplicar una semana: el destino ya tiene un shift
 * para el mismo `(staffId, targetDate)` que el origen mapea.
 */
export interface DuplicateCollision {
  targetDate: string
  staffId: string
  existingShiftType: string
}

/**
 * Detecta colisiones celda-a-celda entre el origen (mapeado al destino) y los
 * shifts existentes en la semana destino. La UI usa este resultado para que
 * el admin decida `skip` (preserva destino) o `overwrite` (reemplaza con
 * origen) en cada celda.
 */
export function findCollisions(
  sourceShifts: Array<{ staffId: string; shiftDate: string }>,
  existingDestination: Array<{
    staffId: string
    shiftDate: string
    shiftType: string
  }>,
  sourceWeekStart: string,
  targetWeekStart: string,
): DuplicateCollision[] {
  if (sourceShifts.length === 0 || existingDestination.length === 0) return []

  // Index destino por (staffId|shiftDate) para lookup O(1).
  const destIndex = new Map<string, string>()
  for (const d of existingDestination) {
    destIndex.set(`${d.staffId}|${d.shiftDate}`, d.shiftType)
  }

  const collisions: DuplicateCollision[] = []
  const seen = new Set<string>()
  for (const s of sourceShifts) {
    const targetDate = mapDateToTargetWeek(s.shiftDate, sourceWeekStart, targetWeekStart)
    const key = `${s.staffId}|${targetDate}`
    if (seen.has(key)) continue
    seen.add(key)
    const existingShiftType = destIndex.get(key)
    if (existingShiftType !== undefined) {
      collisions.push({ targetDate, staffId: s.staffId, existingShiftType })
    }
  }
  return collisions
}
