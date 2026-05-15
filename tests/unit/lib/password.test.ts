import { describe, it, expect } from 'vitest'
import { generateSecurePassword, SECURE_ALPHABET } from '@/lib/security/password'

describe('generateSecurePassword', () => {
  it('produce contraseñas de longitud 16 por defecto', () => {
    expect(generateSecurePassword()).toHaveLength(16)
  })

  it('respeta una longitud custom', () => {
    expect(generateSecurePassword(24)).toHaveLength(24)
  })

  it('rechaza longitudes menores a 8', () => {
    expect(() => generateSecurePassword(7)).toThrow(/Mínimo 8|mínima/)
  })

  it('solo usa caracteres del alfabeto seguro', () => {
    const pwd = generateSecurePassword(64)
    for (const ch of pwd) {
      expect(SECURE_ALPHABET).toContain(ch)
    }
  })

  it('no incluye caracteres ambiguos', () => {
    const pwd = generateSecurePassword(256)
    expect(pwd).not.toMatch(/[0Ol1I]/)
  })

  it('genera contraseñas distintas en llamadas consecutivas', () => {
    const set = new Set(Array.from({ length: 20 }, () => generateSecurePassword()))
    // 20 strings de 16 chars sobre un alfabeto de 60 → colisión casi imposible
    expect(set.size).toBe(20)
  })
})
