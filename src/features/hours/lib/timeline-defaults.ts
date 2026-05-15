/**
 * Calcula los timestamps por defecto de los 9 eventos de la línea de tiempo
 * de una campaña, a partir de su fecha + hora de inicio + hora de fin.
 *
 * Anclado al desglose canónico del Excel CAPACIDAD ROTACIÓN PERSONAL BS:
 *
 *   | Día        | Pre (desplaz+montaje) | Donaciones (incl. almuerzo) | Post (desmontaje+desplaz+descarga) | TOTAL |
 *   |------------|-----------------------|-----------------------------|------------------------------------|-------|
 *   | LUNES      | 1h                    | 5.5h                        | 0.5+1+0.5 = 2h                     | 8.5h  |
 *   | MART-VIERN | 1h                    | 6.5h                        | 0.5+1+0.5 = 2h                     | 9.5h  |
 *
 * Las sugerencias respetan startTime/endTime de la campaña como autoridades:
 * - inicio_donaciones = startTime
 * - fin_donaciones = endTime
 * El pre y post se anclan a esos dos puntos con offsets fijos.
 */

import type { TimelineEventType } from '@/features/campaigns/lib/timeline-constants'
import { ValidationError } from '@/lib/errors/app-errors'

export interface NormalDayHours {
  laborales: number
  almuerzo: number
  total: number
  dayLabel: 'Lunes' | 'Martes–Viernes' | 'Sábado–Domingo'
}

/**
 * Retorna el desglose oficial de horas normales según el día de la campaña.
 * Para sábado/domingo no hay regla canónica; devolvemos 0/0/0 con label informativo.
 */
export function getNormalDayHours(campaignDate: string): NormalDayHours {
  const day = parseDateOnly(campaignDate).getDay()
  if (day === 1) return { laborales: 8, almuerzo: 0.5, total: 8.5, dayLabel: 'Lunes' }
  if (day >= 2 && day <= 5) return { laborales: 9, almuerzo: 0.5, total: 9.5, dayLabel: 'Martes–Viernes' }
  return { laborales: 0, almuerzo: 0, total: 0, dayLabel: 'Sábado–Domingo' }
}

/**
 * Genera los 9 timestamps sugeridos para los eventos de línea de tiempo.
 *
 * Reglas:
 *   - salida_sede       = startTime - 1h     (1h de desplaz + montaje combinados)
 *   - llegada_punto     = startTime - 30min  (mitad del pre)
 *   - inicio_donaciones = startTime
 *   - salida_almuerzo   = midShift - 15min   (almuerzo centrado dentro de las donaciones)
 *   - regreso_almuerzo  = salida_almuerzo + 30min
 *   - fin_donaciones    = endTime
 *   - recogida          = endTime + 30min    (desmontaje)
 *   - llegada_sede      = endTime + 1h 30min (desmontaje + desplaz)
 *   - fin               = endTime + 2h       (desmontaje + desplaz + descarga)
 *
 * @throws Error si startTime/endTime no tienen formato HH:mm válido
 *               o si endTime ≤ startTime (no soporta campañas que cruzan medianoche).
 */
export function computeTimelineDefaults(args: {
  campaignDate: string
  startTime: string
  endTime: string
}): Record<TimelineEventType, Date> {
  const base = parseDateOnly(args.campaignDate)
  const start = withTime(base, parseHhMm(args.startTime))
  const end = withTime(base, parseHhMm(args.endTime))

  if (end.getTime() <= start.getTime()) {
    throw new Error('endTime debe ser posterior a startTime')
  }

  const durationMs = end.getTime() - start.getTime()
  const lunchOut = new Date(start.getTime() + durationMs / 2 - 15 * 60 * 1000)
  const lunchBack = new Date(lunchOut.getTime() + 30 * 60 * 1000)

  return {
    salida_sede:       new Date(start.getTime() - 60 * 60 * 1000),
    llegada_punto:     new Date(start.getTime() - 30 * 60 * 1000),
    inicio_donaciones: start,
    salida_almuerzo:   lunchOut,
    regreso_almuerzo:  lunchBack,
    fin_donaciones:    end,
    recogida:          new Date(end.getTime() + 30 * 60 * 1000),
    llegada_sede:      new Date(end.getTime() + 90 * 60 * 1000),
    fin:               new Date(end.getTime() + 120 * 60 * 1000),
  }
}

// ---- Helpers --------------------------------------------------------------

function parseDateOnly(yyyyMmDd: string): Date {
  // Forzamos T00:00:00 local para que getDay() devuelva el día correcto sin
  // shifting de zona horaria.
  return new Date(`${yyyyMmDd}T00:00:00`)
}

function parseHhMm(hhmm: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!match) throw new ValidationError(`Hora inválida: ${hhmm}`)
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Hora fuera de rango: ${hhmm}`)
  }
  return { hours, minutes }
}

function withTime(date: Date, t: { hours: number; minutes: number }): Date {
  const d = new Date(date)
  d.setHours(t.hours, t.minutes, 0, 0)
  return d
}
