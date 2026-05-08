import {
  MAX_EXTRA_HOURS_WEEK,
  MAX_OVERNIGHTS_MONTH,
  MAX_SHIFT_HOURS,
  MAX_SUNDAYS_MONTH,
  MIN_REST_HOURS,
  MUNICIPAL_CUTOFF_TIME,
  SEDE_MUNICIPALITY,
  WEEKLY_HOURS_CONTRACT,
} from './validation-constants'

// ---- Types ----------------------------------------------------------------

export type ValidationSeverity = 'block' | 'warn' | 'ok'

export type ValidationCode =
  | 'SUPERPOSICION_HORARIA'
  | 'TURNO_EXCESIVO'
  | 'AREA_NO_HABILITADA'
  | 'EXCESO_HORAS_EXTRAS'
  | 'NO_DISPONIBLE'
  | 'DESCANSO_INSUFICIENTE'
  | 'LIMITE_DOMINGOS'
  | 'LIMITE_PERNOCTAS'
  | 'RESTRICCION_MUNICIPIO'

export interface ValidationResult {
  code: ValidationCode
  severity: ValidationSeverity
  message: string
}

export interface ExistingActivity {
  date: string       // 'YYYY-MM-DD'
  startTime: string  // 'HH:mm'
  endTime: string    // 'HH:mm'
}

export interface StaffValidationContext {
  staffId: string
  campaignDate: string             // 'YYYY-MM-DD'
  campaignStartTime: string        // 'HH:mm'
  campaignEndTime: string          // 'HH:mm'
  campaignMunicipality: string
  campaignTrainingAreaId: string | null
  staffTrainingAreaIds: string[]
  staffAvailabilityStatus: string | null
  existingActivities: ExistingActivity[]
  weeklyExtraHours: number
  monthlyCounters: { sundayCount: number; overnightCount: number }
  previousDayLastEndTime: string | null  // 'HH:mm' or null
}

/**
 * Runtime config for the engine. All fields optional — when omitted, falls back
 * to compile-time defaults from validation-constants.ts. Server actions should
 * load this from system_config (via loadValidationRuntimeConfig) and pass it
 * down so admin edits in /configuracion take effect without redeploy.
 */
export interface ValidationConfig {
  weeklyHours?: number
  maxExtraHoursWeek?: number
  maxShiftHours?: number
  minRestHours?: number
  maxSundaysMonth?: number
  maxOvernightsMonth?: number
  municipalCutoffTime?: string
  sedeMunicipality?: string
}

interface ResolvedConfig {
  weeklyHours: number
  maxExtraHoursWeek: number
  maxShiftHours: number
  minRestHours: number
  maxSundaysMonth: number
  maxOvernightsMonth: number
  municipalCutoffTime: string
  sedeMunicipality: string
}

function resolveConfig(cfg?: ValidationConfig): ResolvedConfig {
  return {
    weeklyHours: cfg?.weeklyHours ?? WEEKLY_HOURS_CONTRACT,
    maxExtraHoursWeek: cfg?.maxExtraHoursWeek ?? MAX_EXTRA_HOURS_WEEK,
    maxShiftHours: cfg?.maxShiftHours ?? MAX_SHIFT_HOURS,
    minRestHours: cfg?.minRestHours ?? MIN_REST_HOURS,
    maxSundaysMonth: cfg?.maxSundaysMonth ?? MAX_SUNDAYS_MONTH,
    maxOvernightsMonth: cfg?.maxOvernightsMonth ?? MAX_OVERNIGHTS_MONTH,
    municipalCutoffTime: cfg?.municipalCutoffTime ?? MUNICIPAL_CUTOFF_TIME,
    sedeMunicipality: cfg?.sedeMunicipality ?? SEDE_MUNICIPALITY,
  }
}

// ---- Time helpers ---------------------------------------------------------

function parseMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function durationHours(startTime: string, endTime: string): number {
  const start = parseMinutes(startTime)
  let end = parseMinutes(endTime)
  if (end <= start) end += 24 * 60  // overnight
  return (end - start) / 60
}

function rangesOverlap(
  start1: string, end1: string,
  start2: string, end2: string,
): boolean {
  const s1 = parseMinutes(start1)
  let e1 = parseMinutes(end1)
  const s2 = parseMinutes(start2)
  let e2 = parseMinutes(end2)
  if (e1 <= s1) e1 += 24 * 60
  if (e2 <= s2) e2 += 24 * 60
  return s1 < e2 && e1 > s2
}

function isSunday(dateStr: string): boolean {
  return new Date(`${dateStr}T00:00:00`).getDay() === 0
}

function isOvernightCampaign(startTime: string, endTime: string): boolean {
  return parseMinutes(endTime) < parseMinutes(startTime)
}

// ---- Validation rules -----------------------------------------------------

export function checkSuperposicion(ctx: StaffValidationContext): ValidationResult {
  const sameDay = ctx.existingActivities.filter((a) => a.date === ctx.campaignDate)
  const overlaps = sameDay.some((a) =>
    rangesOverlap(ctx.campaignStartTime, ctx.campaignEndTime, a.startTime, a.endTime),
  )

  if (overlaps) {
    return {
      code: 'SUPERPOSICION_HORARIA',
      severity: 'block',
      message: 'El funcionario ya tiene una actividad que se superpone con el horario de esta campaña.',
    }
  }
  return { code: 'SUPERPOSICION_HORARIA', severity: 'ok', message: '' }
}

export function checkTurnoExcesivo(
  ctx: StaffValidationContext,
  config?: ValidationConfig,
): ValidationResult {
  const cfg = resolveConfig(config)
  const campaignHours = durationHours(ctx.campaignStartTime, ctx.campaignEndTime)

  if (campaignHours > cfg.maxShiftHours) {
    return {
      code: 'TURNO_EXCESIVO',
      severity: 'block',
      message: `La campaña dura ${campaignHours.toFixed(1)}h, lo que supera el máximo permitido de ${cfg.maxShiftHours}h por turno.`,
    }
  }

  const sameDay = ctx.existingActivities.filter((a) => a.date === ctx.campaignDate)
  const existingHours = sameDay.reduce(
    (sum, a) => sum + durationHours(a.startTime, a.endTime),
    0,
  )
  const totalHours = existingHours + campaignHours

  if (totalHours > cfg.maxShiftHours) {
    return {
      code: 'TURNO_EXCESIVO',
      severity: 'block',
      message: `El total de horas ese día sería ${totalHours.toFixed(1)}h, superando el máximo de ${cfg.maxShiftHours}h.`,
    }
  }

  return { code: 'TURNO_EXCESIVO', severity: 'ok', message: '' }
}

export function checkAreaHabilitada(ctx: StaffValidationContext): ValidationResult {
  if (
    ctx.campaignTrainingAreaId !== null &&
    !ctx.staffTrainingAreaIds.includes(ctx.campaignTrainingAreaId)
  ) {
    return {
      code: 'AREA_NO_HABILITADA',
      severity: 'block',
      message: 'El funcionario no está habilitado para el área de formación requerida por esta campaña.',
    }
  }
  return { code: 'AREA_NO_HABILITADA', severity: 'ok', message: '' }
}

export function checkExcesoHorasExtras(
  ctx: StaffValidationContext,
  config?: ValidationConfig,
): ValidationResult {
  const cfg = resolveConfig(config)
  const campaignHours = durationHours(ctx.campaignStartTime, ctx.campaignEndTime)

  if (ctx.weeklyExtraHours + campaignHours > cfg.maxExtraHoursWeek) {
    return {
      code: 'EXCESO_HORAS_EXTRAS',
      severity: 'warn',
      message: `Asignar esta campaña llevaría las horas extras semanales a ${(ctx.weeklyExtraHours + campaignHours).toFixed(1)}h (máx. ${cfg.maxExtraHoursWeek}h).`,
    }
  }

  return { code: 'EXCESO_HORAS_EXTRAS', severity: 'ok', message: '' }
}

export function checkDisponibilidad(ctx: StaffValidationContext): ValidationResult {
  const unavailableStatuses = ['vacaciones', 'incapacidad', 'licencia']
  if (
    ctx.staffAvailabilityStatus !== null &&
    unavailableStatuses.includes(ctx.staffAvailabilityStatus)
  ) {
    return {
      code: 'NO_DISPONIBLE',
      severity: 'warn',
      message: `El funcionario tiene estado "${ctx.staffAvailabilityStatus}" para la fecha de la campaña.`,
    }
  }
  return { code: 'NO_DISPONIBLE', severity: 'ok', message: '' }
}

export function checkDescansoInsuficiente(
  ctx: StaffValidationContext,
  config?: ValidationConfig,
): ValidationResult {
  if (ctx.previousDayLastEndTime === null) {
    return { code: 'DESCANSO_INSUFICIENTE', severity: 'ok', message: '' }
  }
  const cfg = resolveConfig(config)

  // Hours from previous activity end to today campaign start.
  // If prevEnd <= campStart the shift ended in early hours of today (overnight);
  // use simple subtraction. Otherwise shift ended "yesterday"; add 24h.
  const prevEnd = parseMinutes(ctx.previousDayLastEndTime)
  const campStart = parseMinutes(ctx.campaignStartTime)
  const gapMinutes =
    prevEnd <= campStart ? campStart - prevEnd : campStart + 24 * 60 - prevEnd
  const gapHours = gapMinutes / 60

  if (gapHours < cfg.minRestHours) {
    return {
      code: 'DESCANSO_INSUFICIENTE',
      severity: 'warn',
      message: `Solo hay ${gapHours.toFixed(1)}h de descanso desde la última actividad del día anterior (mínimo ${cfg.minRestHours}h).`,
    }
  }
  return { code: 'DESCANSO_INSUFICIENTE', severity: 'ok', message: '' }
}

export function checkLimiteDomingos(
  ctx: StaffValidationContext,
  config?: ValidationConfig,
): ValidationResult {
  const cfg = resolveConfig(config)
  if (
    isSunday(ctx.campaignDate) &&
    ctx.monthlyCounters.sundayCount >= cfg.maxSundaysMonth
  ) {
    return {
      code: 'LIMITE_DOMINGOS',
      severity: 'warn',
      message: `El funcionario ya ha trabajado ${ctx.monthlyCounters.sundayCount} domingos este mes (máx. ${cfg.maxSundaysMonth}).`,
    }
  }
  return { code: 'LIMITE_DOMINGOS', severity: 'ok', message: '' }
}

export function checkLimitePernoctas(
  ctx: StaffValidationContext,
  config?: ValidationConfig,
): ValidationResult {
  const cfg = resolveConfig(config)
  if (
    isOvernightCampaign(ctx.campaignStartTime, ctx.campaignEndTime) &&
    ctx.monthlyCounters.overnightCount >= cfg.maxOvernightsMonth
  ) {
    return {
      code: 'LIMITE_PERNOCTAS',
      severity: 'warn',
      message: `El funcionario ya tiene ${ctx.monthlyCounters.overnightCount} pernocta(s) este mes (máx. ${cfg.maxOvernightsMonth}).`,
    }
  }
  return { code: 'LIMITE_PERNOCTAS', severity: 'ok', message: '' }
}

export function checkRestriccionMunicipio(
  ctx: StaffValidationContext,
  config?: ValidationConfig,
): ValidationResult {
  const cfg = resolveConfig(config)
  if (
    ctx.campaignMunicipality !== cfg.sedeMunicipality &&
    ctx.previousDayLastEndTime !== null &&
    parseMinutes(ctx.previousDayLastEndTime) > parseMinutes(cfg.municipalCutoffTime)
  ) {
    return {
      code: 'RESTRICCION_MUNICIPIO',
      severity: 'warn',
      message: `La campaña es fuera de ${cfg.sedeMunicipality} y el funcionario terminó después de las ${cfg.municipalCutoffTime} el día anterior.`,
    }
  }
  return { code: 'RESTRICCION_MUNICIPIO', severity: 'ok', message: '' }
}

// ---- Aggregate ------------------------------------------------------------

export function runAllValidations(
  ctx: StaffValidationContext,
  config?: ValidationConfig,
): {
  results: ValidationResult[]
  overallSeverity: ValidationSeverity
  canAssign: boolean
} {
  const all = [
    checkSuperposicion(ctx),
    checkTurnoExcesivo(ctx, config),
    checkAreaHabilitada(ctx),
    checkExcesoHorasExtras(ctx, config),
    checkDisponibilidad(ctx),
    checkDescansoInsuficiente(ctx, config),
    checkLimiteDomingos(ctx, config),
    checkLimitePernoctas(ctx, config),
    checkRestriccionMunicipio(ctx, config),
  ]

  const results = all.filter((r) => r.severity !== 'ok')
  const hasBlock = results.some((r) => r.severity === 'block')
  const overallSeverity: ValidationSeverity = hasBlock
    ? 'block'
    : results.length > 0
      ? 'warn'
      : 'ok'

  return { results, overallSeverity, canAssign: !hasBlock }
}

export function getHoursTrafficColor(
  workedHours: number,
  config?: ValidationConfig,
): 'green' | 'yellow' | 'red' {
  const cfg = resolveConfig(config)
  if (workedHours <= cfg.weeklyHours) return 'green'
  if (workedHours <= cfg.weeklyHours + cfg.maxExtraHoursWeek) return 'yellow'
  return 'red'
}
