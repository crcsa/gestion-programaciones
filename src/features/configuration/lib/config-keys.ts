export const CONFIG_KEYS = {
  WEEKLY_HOURS: 'weekly_hours',
  MAX_EXTRA_HOURS_WEEK: 'max_extra_hours_week',
  MAX_SHIFT_HOURS: 'max_shift_hours',
  MIN_REST_HOURS: 'min_rest_hours',
  MAX_SUNDAYS_MONTH: 'max_sundays_month',
  MAX_OVERNIGHTS_MONTH: 'max_overnights_month',
  MUNICIPAL_CUTOFF_TIME: 'municipal_cutoff_time',
  SEDE_MUNICIPALITY: 'sede_municipality',
} as const

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS]

export interface ConfigParameterDef {
  key: ConfigKey
  label: string
  description: string
  type: 'integer' | 'time' | 'text'
  min?: number
  max?: number
  defaultValue: string
}

export const CONFIG_PARAMETERS: ConfigParameterDef[] = [
  {
    key: CONFIG_KEYS.WEEKLY_HOURS,
    label: 'Jornada semanal (horas)',
    description: 'Horas ordinarias semanales por contrato.',
    type: 'integer',
    min: 1,
    max: 80,
    defaultValue: '44',
  },
  {
    key: CONFIG_KEYS.MAX_EXTRA_HOURS_WEEK,
    label: 'Maximo horas extras por semana',
    description: 'Limite de horas extras por empleado por semana.',
    type: 'integer',
    min: 0,
    max: 40,
    defaultValue: '12',
  },
  {
    key: CONFIG_KEYS.MAX_SHIFT_HOURS,
    label: 'Maximo horas por turno',
    description: 'Duracion maxima de un turno continuo.',
    type: 'integer',
    min: 1,
    max: 24,
    defaultValue: '12',
  },
  {
    key: CONFIG_KEYS.MIN_REST_HOURS,
    label: 'Descanso minimo entre turnos (horas)',
    description: 'Horas de descanso obligatorio entre jornadas.',
    type: 'integer',
    min: 0,
    max: 24,
    defaultValue: '8',
  },
  {
    key: CONFIG_KEYS.MAX_SUNDAYS_MONTH,
    label: 'Maximo domingos por mes',
    description: 'Domingos trabajados por empleado al mes.',
    type: 'integer',
    min: 0,
    max: 5,
    defaultValue: '2',
  },
  {
    key: CONFIG_KEYS.MAX_OVERNIGHTS_MONTH,
    label: 'Maximo pernoctas por mes',
    description: 'Pernoctas por empleado al mes.',
    type: 'integer',
    min: 0,
    max: 10,
    defaultValue: '1',
  },
  {
    key: CONFIG_KEYS.MUNICIPAL_CUTOFF_TIME,
    label: 'Hora limite dia previo a campaña municipal',
    description: 'Hora maxima de jornada el dia previo a campaña en otro municipio (HH:MM).',
    type: 'time',
    defaultValue: '17:00',
  },
  {
    key: CONFIG_KEYS.SEDE_MUNICIPALITY,
    label: 'Municipio de la sede principal',
    description: 'Municipio donde se ubica la sede principal (referencia para validaciones de pernocta).',
    type: 'text',
    defaultValue: 'Medellín',
  },
]
