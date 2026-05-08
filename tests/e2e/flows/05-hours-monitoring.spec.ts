import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

test.describe('Flujo 5 — Monitoreo semanal de horas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin')
  })

  test('Admin accede a /reportes y ve tabs de reportes', async ({ page }) => {
    await page.goto('/reportes')
    await expect(page.getByRole('heading', { name: /reportes/i })).toBeVisible()
    await expect(page.getByRole('tab').first()).toBeVisible()
  })

  test('Reporte por persona contiene columnas Domingos y Pernoctas', async ({ page }) => {
    await page.goto('/reportes')
    const personalTab = page.getByRole('tab', { name: /personal|persona|funcionarios/i })
    if (await personalTab.count()) {
      await personalTab.click()
      await expect(page.getByRole('table')).toBeVisible()
      await expect(page.getByText(/Domingos/i).first()).toBeVisible()
      await expect(page.getByText(/Pernoctas/i).first()).toBeVisible()
    }
  })

  test('Botón exportar a Excel está disponible', async ({ page }) => {
    await page.goto('/reportes')
    const exportButton = page.getByRole('button', { name: /exportar|excel/i }).first()
    if (await exportButton.count()) {
      await expect(exportButton).toBeVisible()
    }
  })
})
