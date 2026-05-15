import { describe, it, expect } from 'vitest'
import {
  effectiveShiftHours,
  grossShiftHours,
  MIN_EFFECTIVE_HOURS_DIURNO,
  LUNCH_BREAK_HOURS_BY_TYPE,
} from '@/features/sede/lib/shift-defaults'

describe('grossShiftHours', () => {
  it('07:00-17:00 mismo día = 10h brutas', () => {
    expect(grossShiftHours('07:00', '17:00', false)).toBe(10)
  })

  it('06:30-16:30 = 10h brutas', () => {
    expect(grossShiftHours('06:30', '16:30', false)).toBe(10)
  })

  it('07:00-16:00 = 9h brutas', () => {
    expect(grossShiftHours('07:00', '16:00', false)).toBe(9)
  })

  it('18:00-06:00 overnight = 12h brutas', () => {
    expect(grossShiftHours('18:00', '06:00', true)).toBe(12)
  })

  it('end <= start sin overnight devuelve 0 (no inventa horas)', () => {
    expect(grossShiftHours('17:00', '07:00', false)).toBe(0)
    expect(grossShiftHours('10:00', '10:00', false)).toBe(0)
  })
})

describe('effectiveShiftHours — descuento de almuerzo', () => {
  it('diurno_completo 07:00-17:00 = 9h efectivas (10h brutas - 1h almuerzo)', () => {
    expect(effectiveShiftHours('07:00', '17:00', false, 'diurno_completo')).toBe(9)
  })

  it('diurno_completo 06:00-16:00 = 9h efectivas', () => {
    expect(effectiveShiftHours('06:00', '16:00', false, 'diurno_completo')).toBe(9)
  })

  it('diurno_completo 07:00-16:00 = 8h efectivas (mínimo legal)', () => {
    expect(effectiveShiftHours('07:00', '16:00', false, 'diurno_completo')).toBe(8)
  })

  it('diurno_completo 07:00-14:00 = 6h efectivas (bajo el mínimo)', () => {
    const eff = effectiveShiftHours('07:00', '14:00', false, 'diurno_completo')
    expect(eff).toBe(6)
    expect(eff).toBeLessThan(MIN_EFFECTIVE_HOURS_DIURNO)
  })

  it('noche 18:00-06:00 overnight = 12h efectivas (sin descuento)', () => {
    expect(effectiveShiftHours('18:00', '06:00', true, 'noche')).toBe(12)
  })

  it('posturno 14:00-22:00 = 8h efectivas (sin descuento)', () => {
    expect(effectiveShiftHours('14:00', '22:00', false, 'posturno')).toBe(8)
  })
})

describe('Jornada laboral colombiana — 44h semanales', () => {
  it('combo legal: 4 días diurno 07:00-17:00 + 1 día 07:00-16:00 = 44h', () => {
    const fourLong = 4 * effectiveShiftHours('07:00', '17:00', false, 'diurno_completo')
    const oneShort = effectiveShiftHours('07:00', '16:00', false, 'diurno_completo')
    expect(fourLong + oneShort).toBe(44)
  })

  it('5 días diurno 07:00-17:00 da 45h (1h extra), NO 50h', () => {
    const total = 5 * effectiveShiftHours('07:00', '17:00', false, 'diurno_completo')
    expect(total).toBe(45)
  })

  it('regresión: sin el descuento de almuerzo serían 50h', () => {
    const gross = 5 * grossShiftHours('07:00', '17:00', false)
    expect(gross).toBe(50)
  })
})

describe('LUNCH_BREAK_HOURS_BY_TYPE', () => {
  it('diurno_completo descuenta 1h, los demás 0', () => {
    expect(LUNCH_BREAK_HOURS_BY_TYPE.diurno_completo).toBe(1)
    expect(LUNCH_BREAK_HOURS_BY_TYPE.noche).toBe(0)
    expect(LUNCH_BREAK_HOURS_BY_TYPE.posturno).toBe(0)
  })
})
