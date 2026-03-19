import { describe, it, expect } from 'vitest'
import { createCompanySchema, updateCompanySchema } from '@/features/companies/schemas/company-schemas'

describe('createCompanySchema', () => {
  it('accepts a minimal valid company', () => {
    const result = createCompanySchema.safeParse({ name: 'Empresa Prueba' })
    expect(result.success).toBe(true)
    expect(result.data?.department).toBe('Antioquia')
  })

  it('rejects name shorter than 2 chars', () => {
    const result = createCompanySchema.safeParse({ name: 'A' })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 200 chars', () => {
    const result = createCompanySchema.safeParse({ name: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts valid NIT format', () => {
    const result = createCompanySchema.safeParse({
      name: 'Empresa SA',
      nit: '123456789-0',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid NIT format (no dash)', () => {
    const result = createCompanySchema.safeParse({ name: 'Empresa', nit: '1234567890' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('NIT')
  })

  it('rejects NIT that is too short', () => {
    const result = createCompanySchema.safeParse({ name: 'Empresa', nit: '1234-0' })
    expect(result.success).toBe(false)
  })

  it('accepts valid email', () => {
    const result = createCompanySchema.safeParse({
      name: 'Empresa SA',
      contactEmail: 'contacto@empresa.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = createCompanySchema.safeParse({
      name: 'Empresa',
      contactEmail: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('defaults department to Antioquia', () => {
    const result = createCompanySchema.safeParse({ name: 'Empresa' })
    expect(result.success).toBe(true)
    expect(result.data?.department).toBe('Antioquia')
  })

  it('accepts custom department', () => {
    const result = createCompanySchema.safeParse({ name: 'Empresa', department: 'Cundinamarca' })
    expect(result.success).toBe(true)
    expect(result.data?.department).toBe('Cundinamarca')
  })
})

describe('updateCompanySchema', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts minimal update with just id', () => {
    const result = updateCompanySchema.safeParse({ id: validId })
    expect(result.success).toBe(true)
  })

  it('accepts full update', () => {
    const result = updateCompanySchema.safeParse({
      id: validId,
      name: 'Nueva Empresa',
      nit: '987654321-1',
      contactEmail: 'nuevo@empresa.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID for id', () => {
    const result = updateCompanySchema.safeParse({ id: 'not-a-uuid', name: 'Test' })
    expect(result.success).toBe(false)
  })

  it('still validates NIT format when provided in update', () => {
    const result = updateCompanySchema.safeParse({ id: validId, nit: 'bad-nit' })
    expect(result.success).toBe(false)
  })
})
