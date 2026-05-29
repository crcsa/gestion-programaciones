/**
 * Validación NO bloqueante de la línea de tiempo programada de un día de campaña.
 *
 * Compara las horas programadas de cada evento (`scheduledTime`) contra la
 * ventana horaria del día de campaña (`dayStart`–`dayEnd`, con convención de
 * pernocta cuando `isOvernight`). Devuelve mensajes de advertencia en español
 * (Colombia); un array vacío significa que no hay nada que advertir.
 *
 * Función PURA: sin efectos secundarios, sin mutación, determinista.
 */

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR

export interface TimelineScheduleEvent {
  eventType?: string
  scheduledTime: string | null
}

export interface TimelineScheduleInput {
  dayStart: string
  dayEnd: string
  isOvernight: boolean
  events: TimelineScheduleEvent[]
}

/** Convierte 'HH:mm' a minutos desde medianoche; null si el formato es inválido. */
function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * MINUTES_PER_HOUR + m
}

/** Minutos planificados del día respetando la convención de pernocta. */
function plannedSpanMinutes(startMins: number, endMins: number, isOvernight: boolean): number {
  let span = endMins - startMins
  if (span < 0 || isOvernight) span += MINUTES_PER_DAY
  return span
}

/** Posición de un evento dentro de la ventana (0 = inicio del día). */
function offsetFromStart(eventMins: number, startMins: number): number {
  let offset = eventMins - startMins
  if (offset < 0) offset += MINUTES_PER_DAY
  return offset
}

function formatHours(minutes: number): string {
  const hours = minutes / MINUTES_PER_HOUR
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

export function getTimelineScheduleWarnings(input: TimelineScheduleInput): string[] {
  const startMins = toMinutes(input.dayStart)
  const endMins = toMinutes(input.dayEnd)
  if (startMins === null || endMins === null) return []

  const offsets = input.events
    .map((e) => (e.scheduledTime ? toMinutes(e.scheduledTime) : null))
    .filter((m): m is number => m !== null)
    .map((m) => offsetFromStart(m, startMins))

  if (offsets.length === 0) return []

  const span = plannedSpanMinutes(startMins, endMins, input.isOvernight)
  const warnings: string[] = []

  const outsideWindow = offsets.some((offset) => offset > span)
  if (outsideWindow) {
    warnings.push(
      `Hay eventos programados fuera del horario del día (${input.dayStart}–${input.dayEnd}).`,
    )
  }

  const eventSpan = Math.max(...offsets) - Math.min(...offsets)
  if (eventSpan > span) {
    warnings.push(
      `La programación abarca ${formatHours(eventSpan)} h, supera las ${formatHours(span)} h planificadas del día.`,
    )
  }

  return warnings
}
