export const CAMPAIGN_SIZE_COMPOSITION = {
  S:      { bacteriologos: 1, tecnicos: 2 },
  S_plus: { bacteriologos: 1, tecnicos: 3 },
  M:      { bacteriologos: 2, tecnicos: 4 },
  L:      { bacteriologos: 3, tecnicos: 6 },
} as const

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  tentativa:  'Tentativa',
  confirmada: 'Confirmada',
  cancelada:  'Cancelada',
  ejecutada:  'Ejecutada',
}

export const CAMPAIGN_SIZE_LABELS: Record<string, string> = {
  S:      'S',
  S_plus: 'S+',
  M:      'M',
  L:      'L',
}

export const CAMPAIGN_MODALITY_LABELS: Record<string, string> = {
  presencial:    'Presencial',
  virtual:       'Virtual',
  mixta:         'Mixta',
  movil:         'Movil',
  institucional: 'Institucional',
}

export const PAGE_LIMIT = 20
