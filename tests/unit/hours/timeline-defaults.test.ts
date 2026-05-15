import { describe, it, expect } from 'vitest'
import {
  computeTimelineDefaults,
  getNormalDayHours,
} from '@/features/hours/lib/timeline-defaults'

describe('getNormalDayHours', () => {
  it('LUNES devuelve 8h + 0.5h = 8.5h', () => {
    // 2026-05-11 fue un lunes
    expect(getNormalDayHours('2026-05-11')).toEqual({
      laborales: 8,
      almuerzo: 0.5,
      total: 8.5,
      dayLabel: 'Lunes',
    })
  })

  it('MARTES-VIERNES devuelve 9h + 0.5h = 9.5h', () => {
    expect(getNormalDayHours('2026-05-12').total).toBe(9.5)
    expect(getNormalDayHours('2026-05-13').total).toBe(9.5)
    expect(getNormalDayHours('2026-05-14').total).toBe(9.5)
    expect(getNormalDayHours('2026-05-15').total).toBe(9.5)
    expect(getNormalDayHours('2026-05-15').dayLabel).toBe('Martes–Viernes')
  })

  it('SÁBADO/DOMINGO devuelve total 0 con label informativo', () => {
    expect(getNormalDayHours('2026-05-16').dayLabel).toBe('Sábado–Domingo')
    expect(getNormalDayHours('2026-05-17').total).toBe(0)
  })
})

describe('computeTimelineDefaults', () => {
  it('LUNES 07:00 → 12:30 produce span salida_sede→fin = 8.5h', () => {
    const d = computeTimelineDefaults({
      campaignDate: '2026-05-11',
      startTime: '07:00',
      endTime: '12:30',
    })

    expect(formatHhMm(d.salida_sede)).toBe('06:00')
    expect(formatHhMm(d.llegada_punto)).toBe('06:30')
    expect(formatHhMm(d.inicio_donaciones)).toBe('07:00')
    expect(formatHhMm(d.fin_donaciones)).toBe('12:30')
    expect(formatHhMm(d.recogida)).toBe('13:00')
    expect(formatHhMm(d.llegada_sede)).toBe('14:00')
    expect(formatHhMm(d.fin)).toBe('14:30')

    const spanMs = d.fin.getTime() - d.salida_sede.getTime()
    expect(spanMs / 3_600_000).toBe(8.5)
  })

  it('MARTES 07:00 → 13:30 produce span = 9.5h', () => {
    const d = computeTimelineDefaults({
      campaignDate: '2026-05-12',
      startTime: '07:00',
      endTime: '13:30',
    })
    const spanMs = d.fin.getTime() - d.salida_sede.getTime()
    expect(spanMs / 3_600_000).toBe(9.5)
  })

  it('almuerzo centrado y duración exacta de 30min', () => {
    const d = computeTimelineDefaults({
      campaignDate: '2026-05-11',
      startTime: '07:00',
      endTime: '12:30',
    })
    // duracion = 5.5h, mid = 09:45. salida = 09:30, regreso = 10:00.
    expect(formatHhMm(d.salida_almuerzo)).toBe('09:30')
    expect(formatHhMm(d.regreso_almuerzo)).toBe('10:00')
    const lunchMs = d.regreso_almuerzo.getTime() - d.salida_almuerzo.getTime()
    expect(lunchMs / 60_000).toBe(30)
  })

  it('horarios atípicos (14:00 → 19:00) genera 9 timestamps coherentes', () => {
    const d = computeTimelineDefaults({
      campaignDate: '2026-05-12',
      startTime: '14:00',
      endTime: '19:00',
    })
    expect(formatHhMm(d.salida_sede)).toBe('13:00')
    expect(formatHhMm(d.fin)).toBe('21:00')
    // almuerzo en el medio: 16:30 - 0:15 = 16:15
    expect(formatHhMm(d.salida_almuerzo)).toBe('16:15')
  })

  it('rechaza endTime ≤ startTime', () => {
    expect(() =>
      computeTimelineDefaults({
        campaignDate: '2026-05-11',
        startTime: '12:00',
        endTime: '08:00',
      }),
    ).toThrow('endTime debe ser posterior a startTime')
  })

  it('rechaza formato de hora inválido', () => {
    expect(() =>
      computeTimelineDefaults({
        campaignDate: '2026-05-11',
        startTime: '7am',
        endTime: '12:00',
      }),
    ).toThrow(/Hora inválida/)
  })

  it('respeta la fecha de la campaña (no usa new Date()) — D+0', () => {
    const d = computeTimelineDefaults({
      campaignDate: '2027-01-15',
      startTime: '08:00',
      endTime: '13:00',
    })
    expect(d.inicio_donaciones.getFullYear()).toBe(2027)
    expect(d.inicio_donaciones.getMonth()).toBe(0) // enero
    expect(d.inicio_donaciones.getDate()).toBe(15)
  })

  it('siempre incluye los 9 eventos', () => {
    const d = computeTimelineDefaults({
      campaignDate: '2026-05-11',
      startTime: '07:00',
      endTime: '12:30',
    })
    const keys = Object.keys(d).sort()
    expect(keys).toEqual([
      'fin',
      'fin_donaciones',
      'inicio_donaciones',
      'llegada_punto',
      'llegada_sede',
      'recogida',
      'regreso_almuerzo',
      'salida_almuerzo',
      'salida_sede',
    ])
  })
})

function formatHhMm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
