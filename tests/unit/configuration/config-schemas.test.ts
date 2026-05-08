import { describe, it, expect } from 'vitest'
import {
  validateConfigValue,
  updateConfigSchema,
} from '@/features/configuration/schemas/config-schemas'

describe('validateConfigValue', () => {
  it('accepts integer within bounds', () => {
    expect(validateConfigValue('weekly_hours', '44')).toBe('44')
    expect(validateConfigValue('weekly_hours', ' 44 ')).toBe('44') // trim
  })

  it('rejects non-integer values for integer fields', () => {
    expect(() => validateConfigValue('weekly_hours', '44.5')).toThrow('entero')
    expect(() => validateConfigValue('weekly_hours', 'abc')).toThrow('entero')
  })

  it('rejects integers below min', () => {
    expect(() => validateConfigValue('weekly_hours', '0')).toThrow('minimo 1')
  })

  it('rejects integers above max', () => {
    expect(() => validateConfigValue('weekly_hours', '999')).toThrow('maximo 80')
  })

  it('accepts valid HH:MM time', () => {
    expect(validateConfigValue('municipal_cutoff_time', '17:00')).toBe('17:00')
    expect(validateConfigValue('municipal_cutoff_time', '23:59')).toBe('23:59')
  })

  it('rejects invalid time format', () => {
    expect(() => validateConfigValue('municipal_cutoff_time', '17')).toThrow('HH:MM')
    expect(() => validateConfigValue('municipal_cutoff_time', '24:00')).toThrow('hora invalida')
    expect(() => validateConfigValue('municipal_cutoff_time', '17:60')).toThrow('hora invalida')
  })

  it('accepts text with min length', () => {
    expect(validateConfigValue('sede_municipality', 'Medellín')).toBe('Medellín')
  })

  it('rejects too-short text', () => {
    expect(() => validateConfigValue('sede_municipality', 'M')).toThrow('minimo 2')
  })

  it('throws for unknown key', () => {
    expect(() => validateConfigValue('unknown_key', '1')).toThrow('desconocida')
  })
})

describe('updateConfigSchema', () => {
  it('accepts valid input', () => {
    const result = updateConfigSchema.safeParse({
      entries: [{ key: 'weekly_hours', value: '44' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty entries array', () => {
    const result = updateConfigSchema.safeParse({ entries: [] })
    expect(result.success).toBe(false)
  })

  it('rejects invalid key', () => {
    const result = updateConfigSchema.safeParse({
      entries: [{ key: 'totally_made_up_key', value: '44' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty value', () => {
    const result = updateConfigSchema.safeParse({
      entries: [{ key: 'weekly_hours', value: '' }],
    })
    expect(result.success).toBe(false)
  })
})
