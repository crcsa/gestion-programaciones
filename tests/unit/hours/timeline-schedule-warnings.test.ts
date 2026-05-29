import { describe, it, expect } from 'vitest'
import { getTimelineScheduleWarnings } from '@/features/hours/lib/timeline-schedule-warnings'

const DAY = { dayStart: '07:00', dayEnd: '17:00', isOvernight: false }

describe('getTimelineScheduleWarnings', () => {
  it('returns no warnings when all events fall within the day window', () => {
    const result = getTimelineScheduleWarnings({
      ...DAY,
      events: [
        { eventType: 'inicio', scheduledTime: '07:30' },
        { eventType: 'fin', scheduledTime: '16:30' },
      ],
    })
    expect(result).toEqual([])
  })

  it('warns when an event is scheduled before dayStart', () => {
    const result = getTimelineScheduleWarnings({
      ...DAY,
      events: [
        { eventType: 'inicio', scheduledTime: '06:00' },
        { eventType: 'fin', scheduledTime: '15:00' },
      ],
    })
    expect(result.some((w) => w.includes('fuera del horario del día'))).toBe(true)
    expect(result[0]).toContain('07:00–17:00')
  })

  it('warns when an event is scheduled after dayEnd', () => {
    const result = getTimelineScheduleWarnings({
      ...DAY,
      events: [
        { eventType: 'inicio', scheduledTime: '08:00' },
        { eventType: 'fin', scheduledTime: '18:00' },
      ],
    })
    expect(result.some((w) => w.includes('fuera del horario del día'))).toBe(true)
  })

  it('warns when the span exceeds the planned day hours', () => {
    // Día planificado de 8h (08:00–16:00). El span de eventos abarca 10h.
    const result = getTimelineScheduleWarnings({
      dayStart: '08:00',
      dayEnd: '16:00',
      isOvernight: false,
      events: [
        { eventType: 'inicio', scheduledTime: '08:00' },
        { eventType: 'extra', scheduledTime: '18:00' },
      ],
    })
    expect(result.some((w) => w.includes('supera las 8 h planificadas'))).toBe(true)
  })

  it('ignores events with null scheduledTime', () => {
    const result = getTimelineScheduleWarnings({
      ...DAY,
      events: [
        { eventType: 'inicio', scheduledTime: '08:00' },
        { eventType: 'pendiente', scheduledTime: null },
      ],
    })
    expect(result).toEqual([])
  })

  it('handles an overnight day without false positives for valid events', () => {
    // Día pernocta: 20:00 → 06:00 del día siguiente (10h).
    const result = getTimelineScheduleWarnings({
      dayStart: '20:00',
      dayEnd: '06:00',
      isOvernight: true,
      events: [
        { eventType: 'inicio', scheduledTime: '20:30' },
        { eventType: 'media', scheduledTime: '23:00' },
        { eventType: 'fin', scheduledTime: '05:30' },
      ],
    })
    expect(result).toEqual([])
  })

  it('warns for an event truly outside an overnight window', () => {
    // Día pernocta 20:00 → 06:00 (10h). 10:00 cae fuera (14h tras el inicio).
    const result = getTimelineScheduleWarnings({
      dayStart: '20:00',
      dayEnd: '06:00',
      isOvernight: true,
      events: [
        { eventType: 'inicio', scheduledTime: '20:00' },
        { eventType: 'tarde', scheduledTime: '10:00' },
      ],
    })
    expect(result.some((w) => w.includes('fuera del horario del día'))).toBe(true)
  })

  it('returns no warnings when there are no scheduled events at all', () => {
    const result = getTimelineScheduleWarnings({
      ...DAY,
      events: [
        { eventType: 'a', scheduledTime: null },
        { eventType: 'b', scheduledTime: null },
      ],
    })
    expect(result).toEqual([])
  })
})
