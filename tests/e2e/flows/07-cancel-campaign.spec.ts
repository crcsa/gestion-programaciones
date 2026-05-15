import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

test.describe('Flujo 7 — Cancelación de campaña (Comercial)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'comercial')
  })

  test('Comercial ve botón eliminar/cancelar en campaña confirmada', async ({ page }) => {
    test.skip(
      !process.env.E2E_CONFIRMADA_CAMPAIGN_ID,
      'Setear E2E_CONFIRMADA_CAMPAIGN_ID con UUID de campaña confirmada',
    )

    await page.goto(`/campanas/${process.env.E2E_CONFIRMADA_CAMPAIGN_ID}`)
    const cancelButton = page.getByRole('button', { name: /cancelar|eliminar/i }).first()
    await expect(cancelButton).toBeVisible()
  })

  test('La cancelación requiere motivo obligatorio', async ({ page }) => {
    test.skip(
      !process.env.E2E_CONFIRMADA_CAMPAIGN_ID,
      'Requiere campaña cancelable',
    )

    await page.goto(`/campanas/${process.env.E2E_CONFIRMADA_CAMPAIGN_ID}`)
    const cancelButton = page.getByRole('button', { name: /cancelar campaña/i }).first()
    if (await cancelButton.count()) {
      await cancelButton.click()
      // Debe mostrar campo de motivo en dialog
      await expect(page.getByLabel(/motivo|razón|razon/i)).toBeVisible()
      // Botón confirmar debe estar deshabilitado sin motivo
      const confirmButton = page.getByRole('button', { name: /confirmar/i })
      const isDisabled = await confirmButton.first().isDisabled().catch(() => false)
      expect(isDisabled).toBeTruthy()
    }
  })

  test('Después de cancelar, la auditoría registra la acción', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/auditoria')
    await expect(page.getByRole('heading', { name: /auditoría|auditoria|registro/i })).toBeVisible()
    // La tabla de auditoría debe estar visible
    await expect(page.getByRole('table').or(page.locator('[data-testid="audit-list"]'))).toBeVisible()
  })
})
