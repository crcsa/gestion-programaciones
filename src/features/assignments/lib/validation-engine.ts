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

export function checkTurnoExcesivo(ctx: StaffValidationContext): ValidationResult {
  const campaignHours = durationHours(ctx.campaignStartTime, ctx.campaignEndTime)

  if (campaignHours > MAX_SHIFT_HOURS) {
    return {
      code: 'TURNO_EXCESIVO',
      severity: 'block',
      message: `La campaña dura ${campaignHours.toFixed(1)}h, lo que supera el máximo permitido de ${MAX_SHIFT_HOURS}h por turno.`,
    }
  }

  const sameDay = ctx.existingActivities.filter((a) => a.date === ctx.campaignDate)
  const existingHours = sameDay.reduce(
    (sum, a) => sum + durationHours(a.startTime, a.endTime),
    0,
  )
  const totalHours = existingHours + campaignHours

  if (totalHours > MAX_SHIFT_HOURS) {
    return {
      code: 'TURNO_EXCESIVO',
      severity: 'block',
      message: `El total de horas ese día sería ${totalHours.toFixed(1)}h, superando el máximo de ${MAX_SHIFT_HOURS}h.`,
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

export function checkExcesoHorasExtras(ctx: StaffValidationContext): ValidationResult {
  const campaignHours = durationHours(ctx.campaignStartTime, ctx.campaignEndTime)
  const projectedExtras = ctx.weeklyExtraHours + Math.max(0, campaignHours - WEEKLY_HOURS_CONTRACT / 5)

  if (ctx.weeklyExtraHours + campaignHours > MAX_EXTRA_HOURS_WEEK) {
    return {
      code: 'EXCESO_HORAS_EXTRAS',
      severity: 'warn',
      message: `Asignar esta campaña llevaría las horas extras semanales a ${(ctx.weeklyExtraHours + campaignHours).toFixed(1)}h (máx. ${MAX_EXTRA_HOURS_WEEK}h).`,
    }
  }

  void projectedExtras  // suppress unused var
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

export function checkDescansoInsuficiente(ctx: StaffValidationContext): ValidationResult {
  if (ctx.previousDayLastEndTime === null) {
    return { code: 'DESCANSO_INSUFICIENTE', severity: 'ok', message: '' }
  }

  // Hours from previous activity end to today campaign start.
  // If prevEnd <= campStart the shift ended in early hours of today (overnight);
  // use simple subtraction. Otherwise shift ended "yesterday"; add 24h.
  const prevEnd = parseMinutes(ctx.previousDayLastEndTime)
  const campStart = parseMinutes(ctx.campaignStartTime)
  const gapMinutes =
    prevEnd <= campStart ? campStart - prevEnd : campStart + 24 * 60 - prevEnd
  const gapHours = gapMinutes / 60

  if (gapHours < MIN_REST_HOURS) {
    return {
      code: 'DESCANSO_INSUFICIENTE',
      severity: 'warn',
      message: `Solo hay ${gapHours.toFixed(1)}h de descanso desde la última actividad del día anterior (mínimo ${MIN_REST_HOURS}h).`,
    }
  }
  return { code: 'DESCANSO_INSUFICIENTE', severity: 'ok', message: '' }
}

export function checkLimiteDomingos(ctx: StaffValidationContext): ValidationResult {
  if (
    isSunday(ctx.campaignDate) &&
    ctx.monthlyCounters.sundayCount >= MAX_SUNDAYS_MONTH
  ) {
    return {
      code: 'LIMITE_DOMINGOS',
      severity: 'warn',
      message: `El funcionario ya ha trabajado ${ctx.monthlyCounters.sundayCount} domingos este mes (máx. ${MAX_SUNDAYS_MONTH}).`,
    }
  }
  return { code: 'LIMITE_DOMINGOS', severity: 'ok', message: '' }
}

export function checkLimitePernoctas(ctx: StaffValidationContext): ValidationResult {
  if (
    isOvernightCampaign(ctx.campaignStartTime, ctx.campaignEndTime) &&
    ctx.monthlyCounters.overnightCount >= MAX_OVERNIGHTS_MONTH
  ) {
    return {
      code: 'LIMITE_PERNOCTAS',
      severity: 'warn',
      message: `El funcionario ya tiene ${ctx.monthlyCounters.overnightCount} pernocta(s) este mes (máx. ${MAX_OVERNIGHTS_MONTH}).`,
    }
  }
  return { code: 'LIMITE_PERNOCTAS', severity: 'ok', message: '' }
}

export function checkRestriccionMunicipio(ctx: StaffValidationContext): ValidationResult {
  if (
    ctx.campaignMunicipality !== SEDE_MUNICIPALITY &&
    ctx.previousDayLastEndTime !== null &&
    parseMinutes(ctx.previousDayLastEndTime) > parseMinutes(MUNICIPAL_CUTOFF_TIME)
  ) {
    return {
      code: 'RESTRICCION_MUNICIPIO',
      severity: 'warn',
      message: `La campaña es fuera de ${SEDE_MUNICIPALITY} y el funcionario terminó después de las ${MUNICIPAL_CUTOFF_TIME} el día anterior.`,
    }
  }
  return { code: 'RESTRICCION_MUNICIPIO', severity: 'ok', message: '' }
}

// ---- Aggregate ------------------------------------------------------------

export function runAllValidations(ctx: StaffValidationContext): {
  results: ValidationResult[]
  overallSeverity: ValidationSeverity
  canAssign: boolean
} {
  const all = [
    checkSuperposicion(ctx),
    checkTurnoExcesivo(ctx),
    checkAreaHabilitada(ctx),
    checkExcesoHorasExtras(ctx),
    checkDisponibilidad(ctx),
    checkDescansoInsuficiente(ctx),
    checkLimiteDomingos(ctx),
    checkLimitePernoctas(ctx),
    checkRestriccionMunicipio(ctx),
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

export function getHoursTrafficColor(workedHours: number): 'green' | 'yellow' | 'red' {
  if (workedHours <= WEEKLY_HOURS_CONTRACT) return 'green'
  if (workedHours <= WEEKLY_HOURS_CONTRACT + MAX_EXTRA_HOURS_WEEK) return 'yellow'
  return 'red'
}
