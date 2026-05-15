import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

/**
 * Flujo 9 — Logística (módulo de vehículos y conductores).
 *
 * Requiere variables de entorno adicionales para que se ejecuten los tests
 * completos:
 * - E2E_ADMIN_LOGISTICA_EMAIL / _PASSWORD: usuario con role=banco_sangre +
 *   area=logistica.
 * - E2E_LOGISTICS_CAMPAIGN_ID: UUID de una campaña en estado 'confirmada' o
 *   'ejecutada' para probar el panel de logística.
 *
 * Los tests que no pueden ejecutarse sin esas variables se omiten con
 * `test.skip()`.
 */

test.describe('Flujo 9 — Logística (vehículos y conductores)', () => {
  test('Admin global puede acceder a /vehiculos', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/vehiculos')
    await expect(page.getByRole('heading', { name: /vehículos/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /nuevo vehículo/i })).toBeVisible()
  })

  test('Admin logística ve "Vehículos" en sidebar y accede a la lista', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_ADMIN_LOGISTICA_EMAIL,
      'Setear E2E_ADMIN_LOGISTICA_EMAIL / _PASSWORD para correr este test',
    )
    // Usa la fachada generic envFor — añadimos un nuevo rol mediante creds.
    const email = process.env.E2E_ADMIN_LOGISTICA_EMAIL!
    const password = process.env.E2E_ADMIN_LOGISTICA_PASSWORD!
    await page.goto('/login')
    await page.getByLabel(/correo|email/i).fill(email)
    await page.getByLabel(/contraseña|password/i).fill(password)
    await page.getByRole('button', { name: /iniciar sesión|ingresar|login/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15_000,
    })

    await expect(page.getByText('Vehículos', { exact: false })).toBeVisible()
    await page.goto('/vehiculos')
    await expect(page.getByRole('heading', { name: /vehículos/i })).toBeVisible()
  })

  test('Admin global puede crear un vehículo nuevo', async ({ page }) => {
    test.skip(
      !process.env.E2E_TEST_CREATES,
      'Setear E2E_TEST_CREATES=1 si la BD de E2E acepta inserts (crea placa única).',
    )
    await login(page, 'admin')
    await page.goto('/vehiculos/nuevo')
    await expect(page.getByRole('heading', { name: /nuevo vehículo/i })).toBeVisible()
    const uniquePlate = `E2E-${Date.now()}`
    await page.getByLabel(/placa/i).fill(uniquePlate)
    await page.getByLabel(/modelo/i).fill('Test Hilux')
    await page.getByLabel(/capacidad/i).fill('6')
    await page.getByRole('button', { name: /crear vehículo|guardar/i }).click()
    await page.waitForURL((url) => url.pathname === '/vehiculos', {
      timeout: 15_000,
    })
    await expect(page.getByText(uniquePlate.toUpperCase())).toBeVisible()
  })

  test('Página de campaña muestra panel de logística cuando confirmada', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_LOGISTICS_CAMPAIGN_ID,
      'Setear E2E_LOGISTICS_CAMPAIGN_ID con UUID de campaña confirmada',
    )
    await login(page, 'admin')
    await page.goto(`/campanas/${process.env.E2E_LOGISTICS_CAMPAIGN_ID}`)
    await expect(
      page.getByText(/Logística — Vehículos y conductores/i),
    ).toBeVisible()
  })

  test('Comercial NO ve el botón "Nuevo vehículo" en /vehiculos', async ({
    page,
  }) => {
    await login(page, 'comercial')
    await page.goto('/vehiculos')
    // Comercial debería ser redirigido (middleware) — verificamos que NO está
    // en /vehiculos.
    await expect(page).not.toHaveURL(/\/vehiculos$/)
  })
})
