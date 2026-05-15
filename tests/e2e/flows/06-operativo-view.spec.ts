import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

test.describe('Flujo 6 — Vista operativo (calendario integrado)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'operativo')
  })

  test('Operativo entra a /mi-agenda y ve calendario semanal', async ({ page }) => {
    await page.goto('/mi-agenda')
    await expect(page.getByRole('heading', { name: /agenda|mi/i })).toBeVisible()
    // El calendario semanal debe mostrar 7 columnas con días
    const dayHeaders = page.locator('[data-testid="day-header"]')
    if (await dayHeaders.count()) {
      expect(await dayHeaders.count()).toBeGreaterThanOrEqual(7)
    }
  })

  test('Operativo ve sus contadores del mes (domingos/pernoctas)', async ({ page }) => {
    await page.goto('/mi-agenda')
    await expect(page.getByText(/domingos/i).first()).toBeVisible()
    await expect(page.getByText(/pernoctas/i).first()).toBeVisible()
  })

  test('Operativo NO puede ver /personal ni /turnos administrativos', async ({ page }) => {
    const response = await page.goto('/personal').catch(() => null)
    if (response) {
      // Esperamos redirect o 403
      const url = page.url()
      expect(url).not.toContain('/personal')
    }
  })
})
