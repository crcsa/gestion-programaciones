import { pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'admin_area', 'comercial', 'operativo'])

export const areaEnum = pgEnum('area', ['banco_sangre', 'comercial', 'logistica'])

// El valor 'coordinador' está deprecado desde la migración 0025: ya no es un
// perfil — es solo un flag de asignación de campaña (`campaign_assignments.is_coordinator`).
// Se mantiene en el enum por compatibilidad histórica (Postgres no admite drop
// fácil de enum values); el trigger `sm_validate_profile_area_trigger` (0024
// actualizado en 0025) impide nuevas inserciones con `coordinador`.
export const staffProfileEnum = pgEnum('staff_profile', ['bacteriologo', 'tecnico', 'medico', 'auxiliar', 'coordinador', 'comercial', 'conductor', 'administrador'])

export const contractTypeEnum = pgEnum('contract_type', ['indefinido', 'fijo', 'prestacion_servicios', 'aprendizaje'])

export const shiftTypeEnum = pgEnum('shift_type', ['diurno_completo', 'noche', 'posturno', 'servicios_transfusionales'])

export const campaignStatusEnum = pgEnum('campaign_status', ['tentativa', 'confirmada', 'cancelada', 'ejecutada'])

export const campaignSizeEnum = pgEnum('campaign_size', ['S', 'S_plus', 'M', 'L'])

export const campaignModalityEnum = pgEnum('campaign_modality', ['corporativa', 'carpa', 'unidad_movil', 'municipal', 'combinada'])

export const availabilityStatusEnum = pgEnum('availability_status', ['disponible', 'en_sede', 'en_campana', 'vacaciones', 'incapacidad', 'licencia'])

export const timelineEventTypeEnum = pgEnum('timeline_event_type', [
  'salida_sede',       // 1. Hora salida sede
  'llegada_punto',     // 2. Hora llegada punto
  'inicio_donaciones', // 3. Hora inicio campaña
  'salida_almuerzo',   // 4. Hora salida almuerzo
  'regreso_almuerzo',  // 5. Hora regreso almuerzo
  'fin_donaciones',    // 6. Hora finalización campaña
  'recogida',          // 7. Hora recogida
  'llegada_sede',      // 8. Hora llegada sede
  'fin',               // 9. Hora salida sede (fin)
])

export const auditActionEnum = pgEnum('audit_action', ['create', 'update', 'delete', 'login', 'logout'])
