import { describe, it, expect } from 'vitest'
import {
  checkSuperposicion,
  checkTurnoExcesivo,
  checkAreaHabilitada,
  checkExcesoHorasExtras,
  checkDisponibilidad,
  checkDescansoInsuficiente,
  checkLimiteDomingos,
  checkLimitePernoctas,
  checkRestriccionMunicipio,
  runAllValidations,
  getHoursTrafficColor,
  type StaffValidationContext,
} from '@/features/assignments/lib/validation-engine'

function baseCtx(overrides: Partial<StaffValidationContext> = {}): StaffValidationContext {
  return {
    staffId: 'staff-1',
    campaignDate: '2026-03-18',       // Wednesday
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

// ---- checkSuperposicion ---------------------------------------------------

describe('checkSuperposicion', () => {
  it('returns ok when no activities on same day', () => {
    const result = checkSuperposicion(baseCtx())
    expect(result.severity).toBe('ok')
  })

  it('returns ok when activity on different day', () => {
    const ctx = baseCtx({
      existingActivities: [{ date: '2026-03-17', startTime: '08:00', endTime: '16:00' }],
    })
    expect(checkSuperposicion(ctx).severity).toBe('ok')
  })

  it('blocks when exact overlap', () => {
    const ctx = baseCtx({
      existingActivities: [{ date: '2026-03-18', startTime: '08:00', endTime: '16:00' }],
    })
    expect(checkSuperposicion(ctx).severity).toBe('block')
    expect(checkSuperposicion(ctx).code).toBe('SUPERPOSICION_HORARIA')
  })

  it('blocks when partial overlap (campaign starts during existing)', () => {
    const ctx = baseCtx({
      existingActivities: [{ date: '2026-03-18', startTime: '06:00', endTime: '10:00' }],
    })
    expect(checkSuperposicion(ctx).severity).toBe('block')
  })

  it('blocks when partial overlap (existing starts during campaign)', () => {
    const ctx = baseCtx({
      existingActivities: [{ date: '2026-03-18', startTime: '14:00', endTime: '18:00' }],
    })
    expect(checkSuperposicion(ctx).severity).toBe('block')
  })

  it('returns ok when activities are adjacent (no gap but no overlap)', () => {
    const ctx = baseCtx({
      existingActivities: [{ date: '2026-03-18', startTime: '16:00', endTime: '20:00' }],
    })
    expect(checkSuperposicion(ctx).severity).toBe('ok')
  })
})

// ---- checkTurnoExcesivo --------------------------------------------------

describe('checkTurnoExcesivo', () => {
  it('returns ok for 8h campaign', () => {
    expect(checkTurnoExcesivo(baseCtx()).severity).toBe('ok')
  })

  it('blocks when campaign > 12h', () => {
    const ctx = baseCtx({ campaignStartTime: '07:00', campaignEndTime: '20:00' })
    expect(checkTurnoExcesivo(ctx).severity).toBe('block')
  })

  it('blocks when total hours that day > 12h', () => {
    const ctx = baseCtx({
      existingActivities: [{ date: '2026-03-18', startTime: '06:00', endTime: '12:00' }],
    })
    // campaign 08:00-16:00 (8h) + existing 06:00-12:00 (6h) = 14h > 12
    expect(checkTurnoExcesivo(ctx).severity).toBe('block')
  })

  it('returns ok when total hours exactly 12h', () => {
    const ctx = baseCtx({
      campaignStartTime: '12:00',
      campaignEndTime: '16:00',
      existingActivities: [{ date: '2026-03-18', startTime: '04:00', endTime: '12:00' }],
    })
    expect(checkTurnoExcesivo(ctx).severity).toBe('ok')
  })
})

// ---- checkAreaHabilitada -------------------------------------------------

describe('checkAreaHabilitada', () => {
  it('returns ok when campaign has no training area requirement', () => {
    expect(checkAreaHabilitada(baseCtx()).severity).toBe('ok')
  })

  it('returns ok when staff has the required area', () => {
    const ctx = baseCtx({
      campaignTrainingAreaId: 'area-1',
      staffTrainingAreaIds: ['area-1', 'area-2'],
    })
    expect(checkAreaHabilitada(ctx).severity).toBe('ok')
  })

  it('blocks when staff does not have the required area', () => {
    const ctx = baseCtx({
      campaignTrainingAreaId: 'area-1',
      staffTrainingAreaIds: ['area-2'],
    })
    expect(checkAreaHabilitada(ctx).severity).toBe('block')
    expect(checkAreaHabilitada(ctx).code).toBe('AREA_NO_HABILITADA')
  })

  it('blocks when staff has no training areas', () => {
    const ctx = baseCtx({
      campaignTrainingAreaId: 'area-1',
      staffTrainingAreaIds: [],
    })
    expect(checkAreaHabilitada(ctx).severity).toBe('block')
  })
})

// ---- checkExcesoHorasExtras ----------------------------------------------

describe('checkExcesoHorasExtras', () => {
  it('returns ok when no extra hours', () => {
    expect(checkExcesoHorasExtras(baseCtx()).severity).toBe('ok')
  })

  it('warns when adding campaign would exceed 12 extra hours', () => {
    // weeklyExtraHours = 10, campaign = 8h → 10+8=18 > 12
    const ctx = baseCtx({ weeklyExtraHours: 10 })
    expect(checkExcesoHorasExtras(ctx).severity).toBe('warn')
    expect(checkExcesoHorasExtras(ctx).code).toBe('EXCESO_HORAS_EXTRAS')
  })

  it('returns ok when extra hours within limit', () => {
    const ctx = baseCtx({ weeklyExtraHours: 2 })
    expect(checkExcesoHorasExtras(ctx).severity).toBe('ok')
  })
})

// ---- checkDisponibilidad -------------------------------------------------

describe('checkDisponibilidad', () => {
  it('returns ok when status is null', () => {
    expect(checkDisponibilidad(baseCtx()).severity).toBe('ok')
  })

  it('returns ok when status is disponible', () => {
    const ctx = baseCtx({ staffAvailabilityStatus: 'disponible' })
    expect(checkDisponibilidad(ctx).severity).toBe('ok')
  })

  it('warns when staff is on vacation', () => {
    const ctx = baseCtx({ staffAvailabilityStatus: 'vacaciones' })
    expect(checkDisponibilidad(ctx).severity).toBe('warn')
    expect(checkDisponibilidad(ctx).code).toBe('NO_DISPONIBLE')
  })

  it('warns when staff is on sick leave', () => {
    const ctx = baseCtx({ staffAvailabilityStatus: 'incapacidad' })
    expect(checkDisponibilidad(ctx).severity).toBe('warn')
  })

  it('warns when staff is on license', () => {
    const ctx = baseCtx({ staffAvailabilityStatus: 'licencia' })
    expect(checkDisponibilidad(ctx).severity).toBe('warn')
  })
})

// ---- checkDescansoInsuficiente -------------------------------------------

describe('checkDescansoInsuficiente', () => {
  it('returns ok when no previous day data', () => {
    expect(checkDescansoInsuficiente(baseCtx()).severity).toBe('ok')
  })

  it('returns ok when previous day ended early enough', () => {
    // prev ended 22:00, campaign starts 08:00 = 10h gap ✓
    const ctx = baseCtx({ previousDayLastEndTime: '22:00' })
    expect(checkDescansoInsuficiente(ctx).severity).toBe('ok')
  })

  it('warns when rest is less than 8 hours', () => {
    // prev ended 02:00, campaign starts 08:00 = 6h gap ✗
    const ctx = baseCtx({ previousDayLastEndTime: '02:00' })
    expect(checkDescansoInsuficiente(ctx).severity).toBe('warn')
    expect(checkDescansoInsuficiente(ctx).code).toBe('DESCANSO_INSUFICIENTE')
  })

  it('returns ok when exactly 8h rest', () => {
    // prev ended 00:00, campaign starts 08:00 = 8h gap = ok
    const ctx = baseCtx({ previousDayLastEndTime: '00:00' })
    expect(checkDescansoInsuficiente(ctx).severity).toBe('ok')
  })
})

// ---- checkLimiteDomingos -------------------------------------------------

describe('checkLimiteDomingos', () => {
  it('returns ok when campaign is not on Sunday', () => {
    // 2026-03-18 is Wednesday
    expect(checkLimiteDomingos(baseCtx()).severity).toBe('ok')
  })

  it('returns ok when campaign is Sunday but under limit', () => {
    const ctx = baseCtx({
      campaignDate: '2026-03-15',  // Sunday
      monthlyCounters: { sundayCount: 1, overnightCount: 0 },
    })
    expect(checkLimiteDomingos(ctx).severity).toBe('ok')
  })

  it('warns when campaign is Sunday and limit reached', () => {
    const ctx = baseCtx({
      campaignDate: '2026-03-15',  // Sunday
      monthlyCounters: { sundayCount: 2, overnightCount: 0 },
    })
    expect(checkLimiteDomingos(ctx).severity).toBe('warn')
    expect(checkLimiteDomingos(ctx).code).toBe('LIMITE_DOMINGOS')
  })
})

// ---- checkLimitePernoctas ------------------------------------------------

describe('checkLimitePernoctas', () => {
  it('returns ok when campaign is not overnight', () => {
    expect(checkLimitePernoctas(baseCtx()).severity).toBe('ok')
  })

  it('returns ok when overnight but no previous overnight this month', () => {
    const ctx = baseCtx({
      campaignStartTime: '22:00',
      campaignEndTime: '06:00',
      monthlyCounters: { sundayCount: 0, overnightCount: 0 },
    })
    expect(checkLimitePernoctas(ctx).severity).toBe('ok')
  })

  it('warns when overnight and limit reached', () => {
    const ctx = baseCtx({
      campaignStartTime: '22:00',
      campaignEndTime: '06:00',
      monthlyCounters: { sundayCount: 0, overnightCount: 1 },
    })
    expect(checkLimitePernoctas(ctx).severity).toBe('warn')
    expect(checkLimitePernoctas(ctx).code).toBe('LIMITE_PERNOCTAS')
  })
})

// ---- checkRestriccionMunicipio ------------------------------------------

describe('checkRestriccionMunicipio', () => {
  it('returns ok when campaign is in Medellín', () => {
    const ctx = baseCtx({ previousDayLastEndTime: '20:00' })
    expect(checkRestriccionMunicipio(ctx).severity).toBe('ok')
  })

  it('returns ok when campaign outside Medellín but prev day ended early', () => {
    const ctx = baseCtx({
      campaignMunicipality: 'Bello',
      previousDayLastEndTime: '16:00',
    })
    expect(checkRestriccionMunicipio(ctx).severity).toBe('ok')
  })

  it('warns when outside Medellín and prev day ended after 17:00', () => {
    const ctx = baseCtx({
      campaignMunicipality: 'Envigado',
      previousDayLastEndTime: '18:00',
    })
    expect(checkRestriccionMunicipio(ctx).severity).toBe('warn')
    expect(checkRestriccionMunicipio(ctx).code).toBe('RESTRICCION_MUNICIPIO')
  })

  it('returns ok when no previous day data', () => {
    const ctx = baseCtx({ campaignMunicipality: 'Rionegro' })
    expect(checkRestriccionMunicipio(ctx).severity).toBe('ok')
  })
})

// ---- runAllValidations ---------------------------------------------------

describe('runAllValidations', () => {
  it('returns ok overall with no issues', () => {
    const result = runAllValidations(baseCtx())
    expect(result.overallSeverity).toBe('ok')
    expect(result.canAssign).toBe(true)
    expect(result.results).toHaveLength(0)
  })

  it('returns block when blocking rule fires', () => {
    const ctx = baseCtx({
      campaignTrainingAreaId: 'area-1',
      staffTrainingAreaIds: [],
    })
    const result = runAllValidations(ctx)
    expect(result.overallSeverity).toBe('block')
    expect(result.canAssign).toBe(false)
    expect(result.results.some((r) => r.severity === 'block')).toBe(true)
  })

  it('returns warn when only warnings fire', () => {
    const ctx = baseCtx({
      staffAvailabilityStatus: 'vacaciones',
      campaignMunicipality: 'Envigado',
      previousDayLastEndTime: '20:00',
    })
    const result = runAllValidations(ctx)
    expect(result.overallSeverity).toBe('warn')
    expect(result.canAssign).toBe(true)
  })

  it('block takes precedence over warn', () => {
    const ctx = baseCtx({
      campaignTrainingAreaId: 'area-1',
      staffTrainingAreaIds: [],
      staffAvailabilityStatus: 'vacaciones',
    })
    const result = runAllValidations(ctx)
    expect(result.overallSeverity).toBe('block')
    expect(result.canAssign).toBe(false)
  })

  it('excludes ok results from returned array', () => {
    const result = runAllValidations(baseCtx())
    expect(result.results.every((r) => r.severity !== 'ok')).toBe(true)
  })
})

// ---- getHoursTrafficColor ------------------------------------------------

describe('getHoursTrafficColor', () => {
  it('green for hours <= 44', () => {
    expect(getHoursTrafficColor(0)).toBe('green')
    expect(getHoursTrafficColor(44)).toBe('green')
  })

  it('yellow for hours > 44 and <= 56', () => {
    expect(getHoursTrafficColor(45)).toBe('yellow')
    expect(getHoursTrafficColor(56)).toBe('yellow')
  })

  it('red for hours > 56', () => {
    expect(getHoursTrafficColor(57)).toBe('red')
    expect(getHoursTrafficColor(100)).toBe('red')
  })
})
