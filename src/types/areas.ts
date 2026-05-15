export type Area = 'banco_sangre' | 'comercial' | 'logistica'

export const AREAS = {
  BANCO_SANGRE: 'banco_sangre' as const,
  COMERCIAL: 'comercial' as const,
  LOGISTICA: 'logistica' as const,
}

export const AREA_LABELS: Record<Area, string> = {
  banco_sangre: 'Banco de Sangre',
  comercial: 'Comercial',
  logistica: 'Logística',
}

export const VALID_AREAS: readonly Area[] = ['banco_sangre', 'comercial', 'logistica']

export const OPERATIONAL_AREAS: readonly Area[] = ['banco_sangre', 'logistica']

export function parseArea(value: unknown): Area | null {
  if (typeof value === 'string' && (VALID_AREAS as readonly string[]).includes(value)) {
    return value as Area
  }
  return null
}

export function isOperationalArea(area: Area): boolean {
  return area === 'banco_sangre' || area === 'logistica'
}
