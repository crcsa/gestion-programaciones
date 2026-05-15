import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

test.describe('Flujo 1 — Carga y confirmación de campañas (Comercial)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'comercial')
  })

  test('Comercial accede a /campanas y ve botón de importar Excel', async ({ page }) => {
    await page.goto('/campanas')
    await expect(page.getByRole('heading', { name: /campañas|campanas/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /importar/i })).toBeVisible()
  })

  test('Diálogo de importación muestra columnas requeridas', async ({ page }) => {
    await page.goto('/campanas')
    await page.getByRole('button', { name: /importar/i }).click()
    await expect(page.getByRole('dialog')).toContainText(/Código/i)
    await expect(page.getByRole('dialog')).toContainText(/Empresa/i)
    await expect(page.getByRole('dialog')).toContainText(/Modalidad/i)
  })

  test('Una campaña tentativa puede ser confirmada', async ({ page }) => {
    test.skip(
      !process.env.E2E_TENTATIVA_CAMPAIGN_ID,
      'Setear E2E_TENTATIVA_CAMPAIGN_ID con UUID de una campaña tentativa para probar este flujo',
    )

    await page.goto(`/campanas/${process.env.E2E_TENTATIVA_CAMPAIGN_ID}`)
    await page.getByRole('button', { name: /confirmar/i }).click()
    await expect(page.getByText(/confirmada/i)).toBeVisible()
  })
})
