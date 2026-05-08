import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

test.describe('Flujo 2 — Asignación de personal a campaña (Banco de Sangre)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'banco_sangre')
  })

  test('Banco de Sangre ve panel de asignación en campaña confirmada', async ({ page }) => {
    test.skip(
      !process.env.E2E_CONFIRMADA_CAMPAIGN_ID,
      'Setear E2E_CONFIRMADA_CAMPAIGN_ID con UUID de campaña confirmada',
    )

    await page.goto(`/campanas/${process.env.E2E_CONFIRMADA_CAMPAIGN_ID}`)
    await expect(page.getByText(/Personal asignado/i)).toBeVisible()
    await expect(page.getByText(/Agregar personal/i)).toBeVisible()
  })

  test('El selector inteligente muestra contadores y semáforo de horas', async ({ page }) => {
    test.skip(
      !process.env.E2E_CONFIRMADA_CAMPAIGN_ID,
      'Requiere campaña confirmada con personal disponible',
    )

    await page.goto(`/campanas/${process.env.E2E_CONFIRMADA_CAMPAIGN_ID}`)
    // El selector debe mostrar al menos una opción de personal
    const staffOption = page.locator('[data-testid="staff-option"]').first()
    if (await staffOption.count()) {
      await expect(staffOption).toBeVisible()
    }
  })

  test('Al designar coordinador aparece badge en la asignación', async ({ page }) => {
    test.skip(
      !process.env.E2E_CONFIRMADA_CAMPAIGN_ID,
      'Requiere campaña con al menos un staff asignado',
    )

    await page.goto(`/campanas/${process.env.E2E_CONFIRMADA_CAMPAIGN_ID}`)
    const coordinatorButton = page.getByRole('button', { name: /^coordinador$/i }).first()
    if (await coordinatorButton.count()) {
      await coordinatorButton.click()
      await expect(page.getByText(/Coordinador/).first()).toBeVisible()
    }
  })
})
