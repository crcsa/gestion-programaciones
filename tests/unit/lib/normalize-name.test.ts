import { describe, it, expect } from 'vitest'
import { normalizeName } from '@/lib/text/normalize-name'

describe('normalizeName', () => {
  it('quita acentos y baja a minúsculas', () => {
    expect(normalizeName('MEDELLÍN')).toBe('medellin')
    expect(normalizeName('Medellin')).toBe('medellin')
    expect(normalizeName('MEDELLÍN')).toBe(normalizeName('medellin'))
  })

  it('colapsa espacios y recorta bordes', () => {
    expect(normalizeName('  ACME   Inc  ')).toBe('acme inc')
    expect(normalizeName('ACME Inc')).toBe('acme inc')
  })

  it('trata ñ y diéresis', () => {
    expect(normalizeName('Niño')).toBe('nino')
    expect(normalizeName('Güiza')).toBe('guiza')
  })

  it('maneja null/undefined/no-string', () => {
    expect(normalizeName(null)).toBe('')
    expect(normalizeName(undefined)).toBe('')
    expect(normalizeName(123)).toBe('123')
  })

  it('considera iguales variantes típicas del CRM', () => {
    expect(normalizeName('Fundación Jardín Botánico')).toBe(
      normalizeName('FUNDACION JARDIN BOTANICO'),
    )
  })
})
