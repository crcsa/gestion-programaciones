import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

/**
 * Flujo 10 — Aislamiento entre áreas.
 *
 * Verifica que los admins de área no puedan acceder a rutas o datos de
 * otras áreas, y que el super-admin global pase todos los chequeos.
 */

test.describe('Flujo 10 — Aislamiento por área', () => {
  test('banco_sangre intenta /vehiculos → redirect', async ({ page }) => {
    await login(page, 'banco_sangre')
    await page.goto('/vehiculos')
    await expect(page).not.toHaveURL(/\/vehiculos$/)
  })

  test('comercial intenta /vehiculos → redirect', async ({ page }) => {
    await login(page, 'comercial')
    await page.goto('/vehiculos')
    await expect(page).not.toHaveURL(/\/vehiculos$/)
  })

  test('operativo intenta /vehiculos → redirect', async ({ page }) => {
    await login(page, 'operativo')
    await page.goto('/vehiculos')
    await expect(page).not.toHaveURL(/\/vehiculos$/)
  })

  test('comercial intenta /personal → redirect a /campanas', async ({
    page,
  }) => {
    await login(page, 'comercial')
    await page.goto('/personal')
    // Middleware redirige a /campanas.
    await expect(page).toHaveURL(/\/campanas/)
  })

  test('admin global puede acceder a /vehiculos sin importar área', async ({
    page,
  }) => {
    await login(page, 'admin')
    await page.goto('/vehiculos')
    await expect(page.getByRole('heading', { name: /vehículos/i })).toBeVisible()
  })

  test('admin global puede acceder a /personal', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/personal')
    await expect(
      page.getByRole('heading', { name: /personal|colaboradores/i }),
    ).toBeVisible()
  })

  test('banco_sangre ve dashboard con KPIs de su área (no logística)', async ({
    page,
  }) => {
    await login(page, 'banco_sangre')
    await page.goto('/')
    // No debe aparecer el KPI "Vehículos activos" (que es de logística).
    await expect(page.getByText(/vehículos activos/i)).not.toBeVisible()
  })

  test('comercial ve toolbar con selector de área (cross-área)', async ({
    page,
  }) => {
    await login(page, 'comercial')
    await page.goto('/')
    // El selector "Área" debe estar visible para comercial (admin y comercial).
    await expect(page.getByLabel(/área/i).or(page.getByText('Área'))).toBeVisible()
  })
})
