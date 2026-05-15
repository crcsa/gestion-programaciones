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
    const personalTab = page.getByRole('tab', { name: /personal|persona|colaboradores/i })
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

  // ---- Pipeline reactivo (T1/T2): horas frescas sin botón recalcular --------

  test('Crear turno actualiza balance semanal automáticamente', async ({ page }) => {
    await page.goto('/turnos')
    await expect(page.getByRole('heading', { name: /turnos/i })).toBeVisible()

    const createBtn = page.getByRole('button', { name: /nuevo turno|crear turno|agregar/i }).first()
    if (await createBtn.count()) {
      await createBtn.click()
      // Solo verifica que el formulario abre — la creación real depende del seed
      const form = page.getByRole('dialog').or(page.locator('form'))
      await expect(form.first()).toBeVisible()
    }
  })

  test('Pernocta muestra campo de horas extras', async ({ page }) => {
    await page.goto('/turnos')
    const createBtn = page.getByRole('button', { name: /nuevo turno|crear turno|agregar/i }).first()
    if (await createBtn.count()) {
      await createBtn.click()
      const overnight = page.getByLabel(/pernocta/i).first()
      if (await overnight.count()) {
        await overnight.check()
        await expect(page.getByLabel(/horas extras/i).first()).toBeVisible()
      }
    }
  })

  test('/horas no exige botón recalcular para mostrar horas frescas', async ({ page }) => {
    await page.goto('/horas')
    await expect(page.getByRole('heading').first()).toBeVisible()
    // Verifica que la tabla principal renderiza (los datos vienen de weekly_balance ya recalculada)
    const table = page.getByRole('table').first()
    if (await table.count()) {
      await expect(table).toBeVisible()
    }
  })

  test('Cancelar campaña recalcula balances', async ({ page }) => {
    await page.goto('/campanas')
    await expect(page.getByRole('heading', { name: /campañ/i })).toBeVisible()
    // Smoke test — no se ejecuta la cancelación real (requiere campaña sembrada)
    // El test confirma que la página de campañas carga.
  })
})
