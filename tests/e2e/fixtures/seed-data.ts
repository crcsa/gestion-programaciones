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
