export const CAMPAIGN_SIZE_LABELS = {
  S: 'S',
  S_PLUS: 'S+',
  M: 'M',
  L: 'L',
} as const

export const CAMPAIGN_SIZE_COMPOSITION = {
  S: { bacteriologos: 1, tecnicos: 2, total: 3 },
  S_PLUS: { bacteriologos: 1, tecnicos: 3, total: 4 },
  M: { bacteriologos: 2, tecnicos: 4, total: 6 },
  L: { bacteriologos: 3, tecnicos: 6, total: 9 },
} as const

export const CAMPAIGN_STATUS_LABELS = {
  tentativa: 'Tentativa',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
} as const

export const CAMPAIGN_STATUS_COLORS = {
  tentativa: 'yellow',
  confirmada: 'green',
  cancelada: 'red',
} as const

export const CAMPAIGN_MODALITY_LABELS = {
  corporativa: 'Corporativa',
  carpa: 'Carpa',
  unidad_movil: 'Unidad Móvil',
  municipal: 'Municipal',
  combinada: 'Combinada',
} as const

export const SHIFT_TYPE_LABELS = {
  completo: 'Completo',
  noche: 'Noche',
  posturno: 'Posturno',
} as const

export const PROFILE_TYPE_LABELS = {
  bacteriologo: 'Bacteriólogo',
  medico: 'Médico',
  tecnico_operativo: 'Técnico Operativo',
  tecnico_administrativo: 'Técnico Administrativo',
} as const
