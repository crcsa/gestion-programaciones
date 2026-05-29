export type ShiftType = 'diurno_completo' | 'noche' | 'posturno' | 'servicios_transfusionales'

export interface ShiftDefaults {
  startTime: string // 'HH:mm'
  endTime: string
  isOvernight: boolean
}

// Horarios base por tipo de turno. Se aplican cuando el bulk action no
// recibe overrides explícitos. Ajustables si la operación de sede cambia.
export const SEDE_SHIFT_DEFAULTS: Record<ShiftType, ShiftDefaults> = {
  diurno_completo:           { startTime: '07:00', endTime: '17:00', isOvernight: false },
  noche:                     { startTime: '18:00', endTime: '06:00', isOvernight: true },
  posturno:                  { startTime: '14:00', endTime: '22:00', isOvernight: false },
  servicios_transfusionales: { startTime: '07:00', endTime: '17:00', isOvernight: false },
}

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  diurno_completo: 'Diurno Completo',
  noche: 'Noche',
  posturno: 'Posturno',
  servicios_transfusionales: 'Servicios transfusionales',
}

export const SHIFT_TYPE_SHORT_LABELS: Record<ShiftType, string> = {
  diurno_completo: 'Diurno',
  noche: 'Noche',
  posturno: 'Posturno',
  servicios_transfusionales: 'Serv. transf.',
}

/**
 * Modalidad de programación de turnos en sede. Banco de sangre gestiona dos
 * flujos separados: la sede regular (diurno/noche/posturno) y servicios
 * transfusionales. Cada flujo se programa por separado para un mismo día (un
 * colaborador tiene a lo sumo un turno por día, de cualquiera de las dos).
 */
export type SedeModality = 'sede' | 'servicios'

export const SEDE_MODALITY_LABELS: Record<SedeModality, string> = {
  sede: 'Sede regular',
  servicios: 'Servicios transfusionales',
}

/** Tipos de turno que pertenecen a cada modalidad. Fuente única de verdad. */
export const SHIFT_TYPES_BY_MODALITY: Record<SedeModality, ShiftType[]> = {
  sede: ['diurno_completo', 'noche', 'posturno'],
  servicios: ['servicios_transfusionales'],
}

export const MODALITY_BY_SHIFT_TYPE: Record<ShiftType, SedeModality> = {
  diurno_completo: 'sede',
  noche: 'sede',
  posturno: 'sede',
  servicios_transfusionales: 'servicios',
}

/** Tipo de turno por defecto al iniciar una programación de cada modalidad. */
export const DEFAULT_SHIFT_TYPE_BY_MODALITY: Record<SedeModality, ShiftType> = {
  sede: 'diurno_completo',
  servicios: 'servicios_transfusionales',
}

/**
 * Horas de almuerzo descontadas por tipo de turno. La jornada legal colombiana
 * (44h/semana) exige 1h de almuerzo en jornadas diurnas continuas ≥ 6h.
 * Noche y posturno no tienen almuerzo formal en este modelo.
 *
 * Si la regulación cambia (p.ej. medio almuerzo de 30min en algún área), el
 * paso siguiente es promover este record a una columna `break_minutes` en
 * `sede_shifts` para granularidad por turno; por ahora un Record por tipo es
 * suficiente y evita una migración de esquema.
 */
export const LUNCH_BREAK_HOURS_BY_TYPE: Record<ShiftType, number> = {
  diurno_completo: 1,
  noche: 0,
  posturno: 0,
  servicios_transfusionales: 1,
}

/**
 * Mínimo de horas EFECTIVAS (post-descuento de almuerzo) que debe tener un
 * turno `diurno_completo` para ser válido. Por debajo del mínimo el turno no
 * cumpliría el régimen laboral típico de jornada completa.
 *
 * No aplica a noche/posturno: pueden ser más cortos por diseño operativo.
 */
export const MIN_EFFECTIVE_HOURS_DIURNO = 8

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * MINUTES_PER_HOUR + m
}

/**
 * Horas brutas entre `startTime` y `endTime` (HH:mm), considerando overnight.
 * Si `isOvernight` y `endTime <= startTime`, suma 24h.
 * Devuelve un float con minutos (e.g. 06:30→16:30 = 10.0; 06:30→17:00 = 10.5).
 */
export function grossShiftHours(
  startTime: string,
  endTime: string,
  isOvernight: boolean,
): number {
  const s = parseMinutes(startTime)
  let e = parseMinutes(endTime)
  if (e <= s) {
    // Si overnight, cruza medianoche; si no, asumimos mismo día y devolvemos 0
    // para no inventar horas (caller debería validar).
    if (isOvernight) e += HOURS_PER_DAY * MINUTES_PER_HOUR
    else return 0
  }
  return (e - s) / MINUTES_PER_HOUR
}

/**
 * Horas EFECTIVAS = horas brutas menos almuerzo según `shiftType`.
 * Esta es la **única** fuente de verdad para "cuántas horas vale un turno".
 * La consumen: server (calcHours), schemas Zod (refine min 8h), UI (preview
 * en modal), tests.
 */
export function effectiveShiftHours(
  startTime: string,
  endTime: string,
  isOvernight: boolean,
  shiftType: ShiftType,
): number {
  const gross = grossShiftHours(startTime, endTime, isOvernight)
  const lunch = LUNCH_BREAK_HOURS_BY_TYPE[shiftType] ?? 0
  return Math.max(0, gross - lunch)
}
