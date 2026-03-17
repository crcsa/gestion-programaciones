import { pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'banco_sangre', 'comercial', 'operativo'])

export const staffProfileEnum = pgEnum('staff_profile', ['bacteriologo', 'tecnico', 'medico', 'auxiliar', 'coordinador'])

export const contractTypeEnum = pgEnum('contract_type', ['indefinido', 'fijo', 'prestacion_servicios', 'aprendizaje'])

export const shiftTypeEnum = pgEnum('shift_type', ['diurno_completo', 'noche', 'posturno'])

export const campaignStatusEnum = pgEnum('campaign_status', ['tentativa', 'confirmada', 'cancelada', 'ejecutada'])

export const campaignSizeEnum = pgEnum('campaign_size', ['S', 'S_plus', 'M', 'L'])

export const campaignModalityEnum = pgEnum('campaign_modality', ['presencial', 'virtual', 'mixta', 'movil', 'institucional'])

export const availabilityStatusEnum = pgEnum('availability_status', ['disponible', 'en_sede', 'en_campana', 'vacaciones', 'incapacidad', 'licencia'])

export const timelineEventTypeEnum = pgEnum('timeline_event_type', ['inicio', 'llegada_sede', 'inicio_donaciones', 'fin_donaciones', 'regreso', 'fin'])

export const auditActionEnum = pgEnum('audit_action', ['create', 'update', 'delete', 'login', 'logout'])
