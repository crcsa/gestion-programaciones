import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

test.describe('Flujo 4 — Línea de tiempo registrada por coordinador', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'operativo')
  })

  test('Operativo ve /horas con campañas donde es coordinador', async ({ page }) => {
    await page.goto('/horas')
    await expect(page.getByRole('heading', { name: /horas|tiempos|coordinador/i })).toBeVisible()
  })

  test('El formulario de timeline tiene los 9 momentos del documento', async ({ page }) => {
    test.skip(
      !process.env.E2E_TIMELINE_CAMPAIGN_ID,
      'Setear E2E_TIMELINE_CAMPAIGN_ID con UUID de campaña donde el operativo es coordinador',
    )

    await page.goto(`/horas/${process.env.E2E_TIMELINE_CAMPAIGN_ID}`)
    const expectedLabels = [
      /salida.*sede/i,
      /llegada.*punto/i,
      /inicio.*campaña/i,
      /almuerzo/i,
      /finalización|finalizacion/i,
      /recogida/i,
      /llegada.*sede/i,
    ]
    for (const label of expectedLabels) {
      await expect(page.getByText(label).first()).toBeVisible()
    }
  })
})
