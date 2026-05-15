/**
 * Helpers timezone-safe para calcular semanas a partir de fechas YYYY-MM-DD.
 *
 * El bug histórico: mezclar `new Date()` (tiempo absoluto) con `getDay()`
 * (día local) y `toISOString().slice(0,10)` (UTC) en países con offset negativo
 * (Colombia UTC-5) corre la fecha un día hacia adelante cuando el reloj local
 * está después de las 19:00. Resultado: el balance se guarda con
 * `weekStart='2026-05-11'` pero la página lo busca con `weekStart='2026-05-12'`
 * → cero filas devueltas, conteos en 0h aunque haya asignaciones.
 *
 * Estos helpers operan SIEMPRE sobre strings ISO de fecha (`YYYY-MM-DD`) y
 * computan el lunes manipulando los componentes de fecha sin tocar timezones.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Day-of-week (0=Sun … 6=Sat) de una fecha ISO date-only. Usa epoch para
 * evitar discrepancias entre `getDay()` local y la fecha real.
 *
 * Anchor: 2025-01-06 fue lunes, así que `Math.floor(epochDays - anchor)` mod 7
 * con offset estable nos da el day-of-week sin involucrar zonas horarias.
 */
function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  // Construimos un Date en UTC para que los cálculos sean estables sin
  // depender del huso horario del proceso (Node en local vs Vercel UTC).
  const utc = Date.UTC(y, m - 1, d)
  return new Date(utc).getUTCDay()
}

function addDaysToIsoDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const epoch = Date.UTC(y, m - 1, d) + days * DAY_MS
  return new Date(epoch).toISOString().slice(0, 10)
}

/**
 * Lunes (inclusive) de la semana que contiene `dateStr`. Para domingo retrocede
 * 6 días (la semana ISO va lun→dom), no avanza al siguiente lunes.
 */
export function getMondayOfIsoDate(dateStr: string): string {
  const dow = getDayOfWeek(dateStr) // 0=Sun … 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow
  return addDaysToIsoDate(dateStr, diff)
}

/**
 * Lunes de la semana en curso, evaluado por la zona horaria del cliente del
 * proceso. Reemplazo directo de los `getCurrentMondayISO()` duplicados.
 *
 * Se usa la fecha local porque las semanas las definen los usuarios humanos
 * en su huso; basta con extraer YYYY-MM-DD local y delegar a
 * `getMondayOfIsoDate`.
 */
export function getCurrentMondayIso(): string {
  const now = new Date()
  const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return getMondayOfIsoDate(local)
}

/** Domingo (último día) de la semana que arranca el lunes `weekStart`. */
export function getSundayOfWeek(weekStart: string): string {
  return addDaysToIsoDate(weekStart, 6)
}

/** Lunes de la semana anterior. */
export function getPreviousMonday(weekStart: string): string {
  return addDaysToIsoDate(weekStart, -7)
}
