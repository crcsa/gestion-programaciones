import { describe, it, expect } from 'vitest'
import {
  checkTurnoExcesivo,
  checkExcesoHorasExtras,
  checkDescansoInsuficiente,
  checkLimiteDomingos,
  checkLimitePernoctas,
  checkRestriccionMunicipio,
  getHoursTrafficColor,
  runAllValidations,
  type StaffValidationContext,
  type ValidationConfig,
} from '@/features/assignments/lib/validation-engine'

function baseCtx(overrides: Partial<StaffValidationContext> = {}): StaffValidationContext {
  return {
    staffId: 'staff-1',
    campaignDate: '2026-03-18', // Wednesday
    campaignStartTime: '08:00',
    campaignEndTime: '16:00',
    campaignMunicipality: 'Medellín',
    campaignTrainingAreaId: null,
    staffTrainingAreaIds: [],
    staffAvailabilityStatus: null,
    existingActivities: [],
    weeklyExtraHours: 0,
    monthlyCounters: { sundayCount: 0, overnightCount: 0 },
    previousDayLastEndTime: null,
    ...overrides,
  }
}

describe('runtime config overrides — engine respects DB-driven values', () => {
  it('checkTurnoExcesivo blocks when campaign exceeds reduced maxShiftHours', () => {
    const ctx = baseCtx({ campaignStartTime: '08:00', campaignEndTime: '17:00' }) // 9h
    const config: ValidationConfig = { maxShiftHours: 6 }
    const result = checkTurnoExcesivo(ctx, config)
    expect(result.severity).toBe('block')
    expect(result.message).toContain('6h')
  })

  it('checkTurnoExcesivo defaults to constant when config not passed', () => {
    const ctx = baseCtx({ campaignStartTime: '08:00', campaignEndTime: '14:00' }) // 6h
    const result = checkTurnoExcesivo(ctx)
    expect(result.severity).toBe('ok')
  })

  it('checkExcesoHorasExtras warns when above runtime maxExtraHoursWeek', () => {
    const ctx = baseCtx({ weeklyExtraHours: 4 }) // 4 + 8h campaign = 12
    const config: ValidationConfig = { maxExtraHoursWeek: 6 }
    const result = checkExcesoHorasExtras(ctx, config)
    expect(result.severity).toBe('warn')
  })

  it('checkDescansoInsuficiente honors stricter minRestHours', () => {
    // Previous day ended at 23:00, campaign starts 08:00 next day — gap = 9h
    const ctx = baseCtx({
      previousDayLastEndTime: '23:00',
      campaignStartTime: '08:00',
    })
    expect(checkDescansoInsuficiente(ctx).severity).toBe('ok') // default 8h
    const stricter: ValidationConfig = { minRestHours: 12 }
    expect(checkDescansoInsuficiente(ctx, stricter).severity).toBe('warn')
  })

  it('checkLimiteDomingos warns when sunday count >= runtime maxSundaysMonth', () => {
    // 2026-03-22 is Sunday
    const ctx = baseCtx({
      campaignDate: '2026-03-22',
      monthlyCounters: { sundayCount: 1, overnightCount: 0 },
    })
    expect(checkLimiteDomingos(ctx).severity).toBe('ok') // default 2
    const stricter: ValidationConfig = { maxSundaysMonth: 1 }
    expect(checkLimiteDomingos(ctx, stricter).severity).toBe('warn')
  })

  it('checkLimitePernoctas warns when overnight count >= runtime max', () => {
    const ctx = baseCtx({
      campaignStartTime: '20:00',
      campaignEndTime: '04:00', // overnight
      monthlyCounters: { sundayCount: 0, overnightCount: 0 },
    })
    expect(checkLimitePernoctas(ctx).severity).toBe('ok') // default 1, count 0
    const stricter: ValidationConfig = { maxOvernightsMonth: 0 }
    expect(checkLimitePernoctas(ctx, stricter).severity).toBe('warn')
  })

  it('checkRestriccionMunicipio honors custom sedeMunicipality', () => {
    const ctx = baseCtx({
      campaignMunicipality: 'Bogotá',
      previousDayLastEndTime: '18:00',
    })
    // Default sede = Medellín → triggers warn
    expect(checkRestriccionMunicipio(ctx).severity).toBe('warn')
    // Custom sede = Bogotá → no longer "fuera de sede"
    const custom: ValidationConfig = { sedeMunicipality: 'Bogotá' }
    expect(checkRestriccionMunicipio(ctx, custom).severity).toBe('ok')
  })

  it('checkRestriccionMunicipio honors custom municipalCutoffTime', () => {
    const ctx = baseCtx({
      campaignMunicipality: 'Bogotá',
      previousDayLastEndTime: '16:00', // before default 17:00
    })
    expect(checkRestriccionMunicipio(ctx).severity).toBe('ok')
    const earlier: ValidationConfig = { municipalCutoffTime: '15:00' }
    expect(checkRestriccionMunicipio(ctx, earlier).severity).toBe('warn')
  })

  it('getHoursTrafficColor uses runtime weeklyHours and maxExtraHoursWeek', () => {
    expect(getHoursTrafficColor(40)).toBe('green') // default 44+12
    expect(getHoursTrafficColor(40, { weeklyHours: 30 })).toBe('yellow')
    expect(getHoursTrafficColor(50, { weeklyHours: 30, maxExtraHoursWeek: 5 })).toBe('red')
  })

  it('runAllValidations propagates config to every rule', () => {
    const ctx = baseCtx({
      campaignStartTime: '08:00',
      campaignEndTime: '16:00', // 8h
      weeklyExtraHours: 0,
    })
    const config: ValidationConfig = { maxShiftHours: 4 } // forces TURNO_EXCESIVO block
    const { canAssign, results } = runAllValidations(ctx, config)
    expect(canAssign).toBe(false)
    expect(results.some((r) => r.code === 'TURNO_EXCESIVO' && r.severity === 'block')).toBe(true)
  })
})
