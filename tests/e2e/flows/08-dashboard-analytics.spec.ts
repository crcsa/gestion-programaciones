import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

test.describe('Flujo 8 — Dashboard analítico', () => {
  test('Admin entra al dashboard y ve KPIs + gráficas', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/')

    // KPIs (4 cards)
    await expect(page.getByText(/personal activo/i)).toBeVisible()
    await expect(page.getByText(/campañas esta semana/i)).toBeVisible()
    await expect(page.getByText(/en sede hoy/i)).toBeVisible()
    await expect(page.getByText(/alertas del mes/i)).toBeVisible()

    // Charts — basta con verificar los títulos (cards)
    await expect(page.getByText(/tendencia de campañas/i)).toBeVisible()
    await expect(page.getByText(/horas semanales/i)).toBeVisible()
    await expect(page.getByText(/utilización del personal/i)).toBeVisible()
    await expect(page.getByText(/estado de campañas/i)).toBeVisible()
    await expect(page.getByText(/pernoctas y domingos/i)).toBeVisible()
  })

  test('Comercial ve sus KPIs y modality pie', async ({ page }) => {
    await login(page, 'comercial')
    await page.goto('/')

    await expect(page.getByText(/tentativas pendientes/i).first()).toBeVisible()
    await expect(page.getByText(/ratio de confirmación/i)).toBeVisible()
    await expect(page.getByText(/distribución por modalidad/i)).toBeVisible()
  })

  test('Operativo ve su tendencia personal de horas', async ({ page }) => {
    await login(page, 'operativo')
    await page.goto('/')

    await expect(page.getByText(/horas esta semana/i)).toBeVisible()
    await expect(page.getByText(/domingos del mes/i)).toBeVisible()
    await expect(page.getByText(/pernoctas del mes/i)).toBeVisible()
    await expect(page.getByText(/mis horas trabajadas/i)).toBeVisible()
  })
})
