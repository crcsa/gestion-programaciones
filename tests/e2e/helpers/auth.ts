import type { Page } from '@playwright/test'

export type E2ERole = 'admin' | 'banco_sangre' | 'comercial' | 'operativo'

interface RoleCredentials {
  email: string
  password: string
}

function envFor(role: E2ERole): RoleCredentials {
  const upper = role.toUpperCase()
  const email = process.env[`E2E_${upper}_EMAIL`]
  const password = process.env[`E2E_${upper}_PASSWORD`]
  if (!email || !password) {
    throw new Error(
      `Faltan credenciales E2E para rol ${role}: setear E2E_${upper}_EMAIL y E2E_${upper}_PASSWORD`,
    )
  }
  return { email, password }
}

/**
 * Inicia sesión a través del formulario de login.
 * Asume que /login existe con campos email/password y botón submit.
 */
export async function login(page: Page, role: E2ERole): Promise<void> {
  const { email, password } = envFor(role)
  await page.goto('/login')
  await page.getByLabel(/correo|email/i).fill(email)
  await page.getByLabel(/contraseña|password/i).fill(password)
  await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  })
}

export async function logout(page: Page): Promise<void> {
  await page.goto('/login?signout=1').catch(() => undefined)
  await page.context().clearCookies()
}
