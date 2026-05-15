import { AppError } from './app-errors'

/**
 * Patrón estándar de catch en server actions:
 *
 * ```ts
 * try {
 *   // ...
 * } catch (error) {
 *   rethrowOrLog(error, 'createCampaign', 'Error al crear la campaña')
 * }
 * ```
 *
 * - Si `error` es un `AppError` (permission, validation, not-found, conflict,
 *   auth), lo re-lanza tal cual para que el cliente reciba el mensaje
 *   específico y tipado.
 * - Si no, loggea el error completo server-side y lanza un `Error` genérico
 *   con `userFriendlyMessage` (evita filtrar detalles internos al cliente).
 */
export function rethrowOrLog(
  error: unknown,
  context: string,
  userFriendlyMessage: string,
): never {
  if (error instanceof AppError) throw error
  console.error(`[${context}]`, error)
  throw new Error(userFriendlyMessage)
}
