/**
 * Errores tipados para distinguir clases de fallos en server actions sin
 * recurrir a matching frágil por substring del mensaje.
 *
 * Convención de uso en server actions:
 *
 * ```ts
 * try {
 *   // ...
 * } catch (error) {
 *   if (error instanceof AppError) throw error  // re-throw tipado
 *   console.error('[actionName]', error)
 *   throw new Error('Mensaje genérico user-friendly')
 * }
 * ```
 */

export class AppError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

export class AuthError extends AppError {
  constructor(message = 'No autenticado. Por favor inicia sesion.') {
    super(message, 'NOT_AUTHENTICATED')
    this.name = 'AuthError'
  }
}

export class PermissionError extends AppError {
  constructor(message = 'No tienes permiso para esta operación.') {
    super(message, 'PERMISSION_DENIED')
    this.name = 'PermissionError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_FAILED')
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT')
    this.name = 'ConflictError'
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError
}
