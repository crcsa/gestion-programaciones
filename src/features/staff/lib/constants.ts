import type { Area } from '@/types/areas'

export const PAGE_LIMIT = 20

// 'coordinador' NO es un perfil — es solo una asignación de campaña
// (`campaign_assignments.is_coordinator`) que se otorga a un bacteriólogo o
// técnico del banco de sangre por campaña específica. Si aparece como valor
// en `staff_profile` (datos legacy), la migración 0025 lo convierte a 'tecnico'.
export const STAFF_PROFILE_VALUES = [
  'bacteriologo',
  'tecnico',
  'medico',
  'auxiliar',
  'comercial',
  'conductor',
  'administrador',
] as const

export type StaffProfile = (typeof STAFF_PROFILE_VALUES)[number]

/**
 * Single source of truth: qué perfiles `staff_profile` son válidos para cada
 * `area`. Consumido por:
 *  - Schema Zod (`staff-schemas.applyProfileAreaInvariant`)
 *  - Server actions (`createStaff`, `updateStaff`, `importStaffFromExcel`)
 *  - UI (`staff-form.tsx` filtra el dropdown de perfil según el área)
 *  - Trigger DB `sm_validate_profile_area_trigger` (migración 0024)
 *
 * El orden dentro de cada array define el orden de presentación en la UI.
 */
export const ALLOWED_PROFILES_BY_AREA: Record<Area, readonly StaffProfile[]> = {
  banco_sangre: ['bacteriologo', 'tecnico', 'medico', 'auxiliar', 'administrador'],
  comercial: ['comercial', 'administrador'],
  logistica: ['conductor', 'administrador'],
}

/**
 * Perfiles que pueden ser asignados como **coordinador de campaña** (flag
 * `campaign_assignments.is_coordinator`). El coordinador es responsable de
 * reportar la línea de tiempo real y las horas ejecutadas. Solo bacteriólogos
 * y técnicos del banco de sangre pueden serlo.
 */
export const COORDINATOR_ELIGIBLE_PROFILES: readonly StaffProfile[] = ['bacteriologo', 'tecnico']

/**
 * Acepta `string` para que callers puedan pasar valores Drizzle del enum
 * `staff_profile` (que incluye legacy como `'coordinador'`) sin casts. El
 * predicado siempre retorna `false` para esos valores legacy, lo que sirve
 * de validación defensiva.
 */
export function isCoordinatorEligible(profile: string): boolean {
  return (COORDINATOR_ELIGIBLE_PROFILES as readonly string[]).includes(profile)
}

export function isProfileAllowedForArea(profile: StaffProfile, area: Area): boolean {
  return (ALLOWED_PROFILES_BY_AREA[area] as readonly string[]).includes(profile)
}

// Perfiles operacionales de banco_sangre (legacy alias retro-compatible).
// Se mantiene como derivación para no romper imports existentes.
export type OperationalStaffProfile =
  (typeof ALLOWED_PROFILES_BY_AREA.banco_sangre)[number]

export const OPERATIONAL_STAFF_PROFILES: readonly OperationalStaffProfile[] =
  ALLOWED_PROFILES_BY_AREA.banco_sangre

export const STAFF_PROFILE_LABELS: Record<StaffProfile, string> = {
  bacteriologo: 'Bacteriólogo',
  tecnico: 'Técnico',
  medico: 'Médico',
  auxiliar: 'Auxiliar',
  comercial: 'Comercial',
  conductor: 'Conductor',
  administrador: 'Administrador de Área',
}

/**
 * Label legacy para el valor 'coordinador' del enum DB (deprecado en 0025).
 * La migración convierte rows existentes a 'tecnico', pero hasta confirmar
 * que no quedan filas se mantiene este label para evitar `undefined` en UI.
 * Los consumers que indexan por `staff_profile` pueden hacer fallback con
 * `STAFF_PROFILE_LABELS[p] ?? LEGACY_STAFF_PROFILE_LABELS[p] ?? p`.
 */
export const LEGACY_STAFF_PROFILE_LABELS: Record<string, string> = {
  coordinador: 'Coordinador (legacy)',
}

/** Helper seguro para obtener el label de un perfil (incluye legacy). */
export function getStaffProfileLabel(profile: string): string {
  return (
    (STAFF_PROFILE_LABELS as Record<string, string>)[profile] ??
    LEGACY_STAFF_PROFILE_LABELS[profile] ??
    profile
  )
}

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  indefinido: 'Indefinido',
  fijo: 'Fijo',
  prestacion_servicios: 'Prestación de Servicios',
  aprendizaje: 'Aprendizaje',
}

export const SHIFT_LABELS: Record<string, string> = {
  diurno_completo: 'Diurno Completo',
  noche: 'Noche',
  posturno: 'Posturno',
}
