export type TimelineEventType =
  | 'salida_sede'
  | 'llegada_punto'
  | 'inicio_donaciones'
  | 'salida_almuerzo'
  | 'regreso_almuerzo'
  | 'fin_donaciones'
  | 'recogida'
  | 'llegada_sede'
  | 'fin'

export const TIMELINE_EVENT_LABELS: Record<TimelineEventType, string> = {
  salida_sede:       'Hora salida sede',
  llegada_punto:     'Hora llegada punto',
  inicio_donaciones: 'Hora inicio campaña',
  salida_almuerzo:   'Hora salida almuerzo',
  regreso_almuerzo:  'Hora regreso almuerzo',
  fin_donaciones:    'Hora finalización campaña',
  recogida:          'Hora recogida',
  llegada_sede:      'Hora llegada sede',
  fin:               'Hora salida sede (fin)',
}

export const TIMELINE_EVENT_ORDER: TimelineEventType[] = [
  'salida_sede',
  'llegada_punto',
  'inicio_donaciones',
  'salida_almuerzo',
  'regreso_almuerzo',
  'fin_donaciones',
  'recogida',
  'llegada_sede',
  'fin',
]
