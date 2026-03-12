import { pgEnum } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'banco_sangre',
  'comercial',
  'operativo',
])

export const profileTypeEnum = pgEnum('profile_type', [
  'bacteriologo',
  'medico',
  'tecnico_operativo',
  'tecnico_administrativo',
])

export const campaignSizeEnum = pgEnum('campaign_size', [
  'S',
  'S_PLUS',
  'M',
  'L',
])

export const campaignModalityEnum = pgEnum('campaign_modality', [
  'corporativa',
  'carpa',
  'unidad_movil',
  'municipal',
  'combinada',
])

export const campaignStatusEnum = pgEnum('campaign_status', [
  'tentativa',
  'confirmada',
  'cancelada',
])

export const shiftTypeEnum = pgEnum('shift_type', [
  'completo',
  'noche',
  'posturno',
])

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'asignado',
  'confirmado',
  'completado',
  'no_asistio',
])

export const hoursEntryTypeEnum = pgEnum('hours_entry_type', [
  'jornada_regular',
  'campana',
  'capacitacion',
  'turno_noche',
  'otro',
])

export const availabilityTypeEnum = pgEnum('availability_type', [
  'disponible',
  'no_disponible',
  'vacaciones',
  'incapacidad',
  'permiso',
  'jornada_regular',
])
