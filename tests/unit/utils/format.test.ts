import { describe, it, expect } from 'vitest'
import {
  formatFullName,
  formatDocumentNumber,
  formatHours,
} from '@/lib/utils/format'

describe('formatFullName', () => {
  it('joins first and last name', () => {
    expect(formatFullName('Juan', 'Pérez')).toBe('Juan Pérez')
  })

  it('trims whitespace', () => {
    expect(formatFullName('  Ana  ', '  López  ')).toBe('Ana     López')
  })
})

describe('formatDocumentNumber', () => {
  it('formats with dots', () => {
    expect(formatDocumentNumber('1234567')).toBe('1.234.567')
  })

  it('formats long numbers', () => {
    expect(formatDocumentNumber('1234567890')).toBe('1.234.567.890')
  })

  it('leaves short numbers as-is', () => {
    expect(formatDocumentNumber('123')).toBe('123')
  })
})

describe('formatHours', () => {
  it('formats whole hours', () => {
    expect(formatHours(8)).toBe('8h')
  })

  it('formats hours with minutes', () => {
    expect(formatHours(8.5)).toBe('8h 30m')
  })

  it('formats zero', () => {
    expect(formatHours(0)).toBe('0h')
  })

  it('formats fractional hours', () => {
    expect(formatHours(2.25)).toBe('2h 15m')
  })
})
