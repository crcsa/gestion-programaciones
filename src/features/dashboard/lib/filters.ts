/**
 * Filtros globales del dashboard admin. Se persisten en la URL como search params
 * para soportar deep-linking y back/forward del navegador.
 */

import { addDays, format, startOfMonth, startOfWeek } from 'date-fns'
import { parseArea, type Area } from '@/types/areas'
import type { StaffProfile } from '@/features/staff/lib/constants'

export type { StaffProfile }

export type DashboardPeriod = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'last30d'

export interface DashboardFilters {
  period: DashboardPeriod
  profile: StaffProfile | null
  municipality: string | null
  /**
   * Área a la que se restringe la consulta. null = sin restricción (todas las áreas).
   * Para admins de área se setea forzosamente desde el contexto del usuario en la
   * page; admin global y comercial pueden cambiarlo desde el toolbar.
   */
  area: Area | null
}

export const DEFAULT_FILTERS: DashboardFilters = {
  period: 'thisWeek',
  profile: null,
  municipality: null,
  area: null,
}

const VALID_PERIODS: ReadonlyArray<DashboardPeriod> = [
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'last30d',
]

// Solo perfiles operacionales son seleccionables en el toolbar (sin
// 'administrador'). Si llega otro valor en la URL se descarta a null.
const VALID_PROFILES: ReadonlyArray<StaffProfile> = [
  'bacteriologo',
  'tecnico',
  'medico',
  'auxiliar',
  'comercial',
  'conductor',
]

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  thisWeek: 'Esta semana',
  lastWeek: 'Semana pasada',
  thisMonth: 'Este mes',
  last30d: 'Últimos 30 días',
}

// Subconjunto de labels para el toolbar y dashboards (no incluye
// 'administrador' porque no se filtra ni grafica por separado).
export const PROFILE_LABELS: Partial<Record<StaffProfile, string>> = {
  bacteriologo: 'Bacteriólogo',
  tecnico: 'Técnico',
  medico: 'Médico',
  auxiliar: 'Auxiliar',
  comercial: 'Comercial',
  conductor: 'Conductor',
}

export interface DashboardDateRange {
  /** Inicio inclusivo, formato YYYY-MM-DD. */
  start: string
  /** Fin inclusivo, formato YYYY-MM-DD. */
  end: string
  /** Lunes (YYYY-MM-DD) que aplica al periodo, usado para queries de weekly_balance. */
  weekStart: string
}

export function parseDashboardFilters(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
): DashboardFilters {
  const get = (key: string): string | null => {
    if (sp instanceof URLSearchParams) return sp.get(key)
    const raw = sp[key]
    if (Array.isArray(raw)) return raw[0] ?? null
    return raw ?? null
  }

  const periodRaw = get('period')
  const period = (VALID_PERIODS as ReadonlyArray<string>).includes(periodRaw ?? '')
    ? (periodRaw as DashboardPeriod)
    : DEFAULT_FILTERS.period

  const profileRaw = get('profile')
  const profile =
    profileRaw && (VALID_PROFILES as ReadonlyArray<string>).includes(profileRaw)
      ? (profileRaw as StaffProfile)
      : null

  const municipalityRaw = get('municipality')
  const municipality = municipalityRaw && municipalityRaw.trim().length > 0
    ? municipalityRaw
    : null

  const area = parseArea(get('area'))

  return { period, profile, municipality, area }
}

export function serializeDashboardFilters(f: DashboardFilters): URLSearchParams {
  const sp = new URLSearchParams()
  if (f.period !== DEFAULT_FILTERS.period) sp.set('period', f.period)
  if (f.profile) sp.set('profile', f.profile)
  if (f.municipality) sp.set('municipality', f.municipality)
  if (f.area) sp.set('area', f.area)
  return sp
}

/**
 * Convierte un periodo simbólico a un rango concreto de fechas, anclado a `now`.
 * `weekStart` siempre es el lunes correspondiente al inicio del periodo y se usa
 * para alinear con `weekly_balance.week_start` (que se indexa por lunes).
 */
export function periodToDateRange(
  period: DashboardPeriod,
  now: Date = new Date(),
): DashboardDateRange {
  const monday = (d: Date) => startOfWeek(d, { weekStartsOn: 1 })

  if (period === 'thisWeek') {
    const start = monday(now)
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(addDays(start, 6), 'yyyy-MM-dd'),
      weekStart: format(start, 'yyyy-MM-dd'),
    }
  }

  if (period === 'lastWeek') {
    const start = addDays(monday(now), -7)
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(addDays(start, 6), 'yyyy-MM-dd'),
      weekStart: format(start, 'yyyy-MM-dd'),
    }
  }

  if (period === 'thisMonth') {
    const start = startOfMonth(now)
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(now, 'yyyy-MM-dd'),
      weekStart: format(monday(start), 'yyyy-MM-dd'),
    }
  }

  // last30d
  const start = addDays(now, -29)
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(now, 'yyyy-MM-dd'),
    weekStart: format(monday(start), 'yyyy-MM-dd'),
  }
}
