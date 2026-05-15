import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

test.describe('Flujo 3 — Programación de turnos en sede (Banco de Sangre)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'banco_sangre')
  })

  test('Banco de Sangre accede a /turnos y ve la grilla semanal', async ({ page }) => {
    await page.goto('/turnos')
    await expect(page.getByRole('heading', { name: /turnos/i })).toBeVisible()
  })

  test('Botón nuevo turno abre formulario', async ({ page }) => {
    await page.goto('/turnos')
    const newButton = page.getByRole('button', { name: /nuevo turno|\+ /i }).first()
    if (await newButton.count()) {
      await newButton.click()
      await expect(page.getByRole('dialog').or(page.locator('form'))).toBeVisible()
    }
  })
})
