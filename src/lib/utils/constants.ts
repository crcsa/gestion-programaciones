import type { Role } from '@/types/roles'

export const APP_NAME = 'Programaciones CRCA'

export const PROTECTED_ROUTES = ['/personal', '/campanas', '/turnos', '/configuracion']
export const PUBLIC_ROUTES = ['/login']

export const ROLE_DEFAULT_ROUTES: Record<Role, string> = {
  admin: '/',
  banco_sangre: '/',
  comercial: '/campanas',
  operativo: '/mi-agenda',
}

export const CAMPAIGN_SIZES = ['S', 'S+', 'M', 'L'] as const
export type CampaignSize = (typeof CAMPAIGN_SIZES)[number]

export const CAMPAIGN_SIZE_COMPOSITION: Record<CampaignSize, { bacteriologos: number; tecnicos: number }> = {
  S: { bacteriologos: 1, tecnicos: 2 },
  'S+': { bacteriologos: 1, tecnicos: 3 },
  M: { bacteriologos: 2, tecnicos: 4 },
  L: { bacteriologos: 3, tecnicos: 6 },
}

export const CAMPAIGN_MODALITIES = [
  'presencial',
  'virtual',
  'mixta',
  'movil',
  'institucional',
] as const
export type CampaignModality = (typeof CAMPAIGN_MODALITIES)[number]

export const SHIFT_TYPES = ['diurno_completo', 'noche', 'posturno'] as const
export type ShiftType = (typeof SHIFT_TYPES)[number]

export const SHIFT_TYPE_LABELS: Record<(typeof SHIFT_TYPES)[number], string> = {
  diurno_completo: 'Completo (Diurno)',
  noche: 'Noche',
  posturno: 'Posturno',
}

export const MAX_SHIFT_HOURS = 12
export const WEEKLY_HOURS = 44
export const MAX_EXTRA_HOURS_MONTH = 12
export const MAX_SUNDAYS_MONTH = 2
export const MAX_OVERNIGHTS_MONTH = 1
