/**
 * Validación NO bloqueante de la línea de tiempo programada de un día de campaña.
 *
 * Dos reglas, ambas contra referencias FIJAS del régimen de campañas (no contra
 * el horario específico de la campaña):
 *
 *  1. Fuera de horario: los eventos deben caer dentro de la jornada laboral
 *     estándar 07:00–17:00. Cualquier evento antes de las 07:00 o después de
 *     las 17:00 dispara la advertencia.
 *  2. Horas planificadas: el lapso entre el primer y el último evento no debería
 *     superar las horas TOTALES planificadas para ese día de la semana
 *     (Lunes 8.5h, Martes–Viernes 9.5h — ver `getNormalDayHours`). Este total
 *     coincide con el lapso canónico salida_sede→fin de un día normal.
 *
 * Devuelve mensajes de advertencia en español (Colombia); array vacío = nada
 * que advertir. Función PURA: sin efectos secundarios, sin mutación.
 */

const MINUTES_PER_HOUR = 60

/** Jornada laboral estándar para campañas (referencia fija de la operación). */
export const WORKDAY_START = '07:00'
export const WORKDAY_END = '17:00'

export interface TimelineScheduleEvent {
  eventType?: string
  scheduledTime: string | null
}

export interface TimelineScheduleInput {
  events: TimelineScheduleEvent[]
  /** Horas TOTALES planificadas del día según el día de la semana (0 = sin regla). */
  plannedHours: number
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

function formatHours(minutes: number): string {
  const hours = minutes / MINUTES_PER_HOUR
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

export function getTimelineScheduleWarnings(input: TimelineScheduleInput): string[] {
  const dayStart = toMinutes(WORKDAY_START) as number
  const dayEnd = toMinutes(WORKDAY_END) as number

  const times = input.events
    .map((e) => (e.scheduledTime ? toMinutes(e.scheduledTime) : null))
    .filter((m): m is number => m !== null)

  if (times.length === 0) return []

  const warnings: string[] = []

  const outsideWorkday = times.some((m) => m < dayStart || m > dayEnd)
  if (outsideWorkday) {
    warnings.push(
      `Hay eventos programados fuera del horario laboral (${WORKDAY_START}–${WORKDAY_END}).`,
    )
  }

  // Solo evaluamos el lapso si hay una regla canónica para el día (Lun–Vie).
  if (input.plannedHours > 0) {
    const spanMinutes = Math.max(...times) - Math.min(...times)
    const plannedMinutes = input.plannedHours * MINUTES_PER_HOUR
    if (spanMinutes > plannedMinutes) {
      warnings.push(
        `La programación abarca ${formatHours(spanMinutes)} h, supera las ${formatHours(plannedMinutes)} h planificadas del día.`,
      )
    }
  }

  return warnings
}
