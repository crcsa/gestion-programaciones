import { describe, it, expect } from 'vitest'
import { getTimelineScheduleWarnings } from '@/features/hours/lib/timeline-schedule-warnings'

// Día Martes–Viernes: 9.5h totales planificadas.
const PLANNED_TUE_FRI = 9.5

describe('getTimelineScheduleWarnings', () => {
  it('no advierte cuando todos los eventos caen dentro de 07:00–17:00 y dentro del lapso', () => {
    const result = getTimelineScheduleWarnings({
      plannedHours: PLANNED_TUE_FRI,
      events: [
        { eventType: 'inicio', scheduledTime: '08:00' },
        { eventType: 'fin', scheduledTime: '16:30' },
      ],
    })
    expect(result).toEqual([])
  })

  it('advierte cuando un evento es anterior a las 07:00', () => {
    const result = getTimelineScheduleWarnings({
      plannedHours: PLANNED_TUE_FRI,
      events: [
        { eventType: 'salida', scheduledTime: '06:00' },
        { eventType: 'fin', scheduledTime: '15:00' },
      ],
    })
    expect(result.some((w) => w.includes('fuera del horario laboral'))).toBe(true)
    expect(result.find((w) => w.includes('fuera del horario laboral'))).toContain('07:00–17:00')
  })

  it('advierte cuando un evento es posterior a las 17:00', () => {
    const result = getTimelineScheduleWarnings({
      plannedHours: PLANNED_TUE_FRI,
      events: [
        { eventType: 'inicio', scheduledTime: '08:00' },
        { eventType: 'fin', scheduledTime: '19:00' },
      ],
    })
    expect(result.some((w) => w.includes('fuera del horario laboral'))).toBe(true)
  })

  it('advierte cuando el lapso supera las horas planificadas del día', () => {
    // 07:00 → 19:00 = 12h, supera las 9.5h planificadas (Mar–Vie).
    const result = getTimelineScheduleWarnings({
      plannedHours: PLANNED_TUE_FRI,
      events: [
        { eventType: 'salida', scheduledTime: '07:00' },
        { eventType: 'fin', scheduledTime: '19:00' },
      ],
    })
    expect(result.some((w) => w.includes('supera las 9.5 h planificadas'))).toBe(true)
    expect(result.some((w) => w.includes('abarca 12 h'))).toBe(true)
  })

  it('usa las horas del día (Lunes 8.5h) como referencia del lapso', () => {
    // 07:00 → 16:00 = 9h, supera las 8.5h planificadas del lunes.
    const result = getTimelineScheduleWarnings({
      plannedHours: 8.5,
      events: [
        { eventType: 'salida', scheduledTime: '07:00' },
        { eventType: 'fin', scheduledTime: '16:00' },
      ],
    })
    expect(result.some((w) => w.includes('supera las 8.5 h planificadas'))).toBe(true)
  })

  it('no evalúa el lapso cuando no hay regla canónica del día (plannedHours = 0)', () => {
    // Sábado/Domingo: plannedHours 0 → no se compara el lapso, pero sí el horario.
    const result = getTimelineScheduleWarnings({
      plannedHours: 0,
      events: [
        { eventType: 'inicio', scheduledTime: '08:00' },
        { eventType: 'fin', scheduledTime: '16:00' },
      ],
    })
    expect(result).toEqual([])
  })

  it('ignora eventos sin hora programada', () => {
    const result = getTimelineScheduleWarnings({
      plannedHours: PLANNED_TUE_FRI,
      events: [
        { eventType: 'inicio', scheduledTime: '08:00' },
        { eventType: 'pendiente', scheduledTime: null },
      ],
    })
    expect(result).toEqual([])
  })

  it('no advierte cuando no hay eventos programados', () => {
    const result = getTimelineScheduleWarnings({
      plannedHours: PLANNED_TUE_FRI,
      events: [
        { eventType: 'a', scheduledTime: null },
        { eventType: 'b', scheduledTime: null },
      ],
    })
    expect(result).toEqual([])
  })
})
