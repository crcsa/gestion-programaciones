/**
 * Datos de referencia para los tests E2E.
 *
 * Para que los tests pasen, la BD de E2E debe tener al menos:
 * - 1 usuario por rol (admin, banco_sangre, comercial, operativo)
 *   con credenciales en .env (E2E_<ROLE>_EMAIL / _PASSWORD)
 * - 4+ staff_members activos cubriendo perfiles bacteriologo y tecnico
 * - 1+ training_areas habilitadas para esos staff
 * - 1 campaign en estado 'tentativa'
 * - 1 campaign en estado 'confirmada' sin asignaciones aún
 * - 1 company y 1 location de referencia
 *
 * Para los flujos de logística (09-logistica-flow, 10-area-isolation) además:
 * - 1 usuario con role=banco_sangre + area=logistica (E2E_ADMIN_LOGISTICA_*)
 * - 1+ vehicles activos (opcional, los tests skip si no hay)
 * - 1 staff con area=logistica + staff_profile=conductor
 * - E2E_LOGISTICS_CAMPAIGN_ID: UUID de una campaña confirmada para probar el
 *   panel de logística (opcional, skip si no se provee)
 *
 * En CI se debe seedear con `pnpm db:seed` apuntando a la BD de E2E.
 */

export const TEST_CAMPAIGN_TENTATIVA_CODE = 'E2E-TENT-001'
export const TEST_CAMPAIGN_CONFIRMADA_CODE = 'E2E-CONF-001'

export const E2E_REQUIRED_ENV_VARS = [
  'E2E_BASE_URL',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_BANCO_SANGRE_EMAIL',
  'E2E_BANCO_SANGRE_PASSWORD',
  'E2E_COMERCIAL_EMAIL',
  'E2E_COMERCIAL_PASSWORD',
  'E2E_OPERATIVO_EMAIL',
  'E2E_OPERATIVO_PASSWORD',
] as const

/**
 * Variables opcionales para los flujos de logística. Los tests que las
 * requieren se omiten con test.skip() si no están definidas.
 */
export const E2E_OPTIONAL_ENV_VARS = [
  'E2E_ADMIN_LOGISTICA_EMAIL',
  'E2E_ADMIN_LOGISTICA_PASSWORD',
  'E2E_LOGISTICS_CAMPAIGN_ID',
  'E2E_TENTATIVA_CAMPAIGN_ID',
  'E2E_TEST_CREATES',
] as const
