import { describe, it, expect } from 'vitest'
import {
  createStaffSchema,
  updateStaffSchema,
  staffFilterSchema,
} from '@/features/staff/schemas/staff-schemas'

describe('createStaffSchema', () => {
  const validInput = {
    documentNumber: '1234567890',
    firstName: 'Juan',
    lastName: 'Pérez',
    profileType: 'bacteriologo' as const,
  }

  it('accepts valid input with required fields', () => {
    const result = createStaffSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('applies default values', () => {
    const result = createStaffSchema.parse(validInput)
    expect(result.weeklyContractHours).toBe(44)
    expect(result.maxOvertimeWeekly).toBe(12)
    expect(result.maxShiftHours).toBe(12)
  })

  it('accepts all optional fields', () => {
    const result = createStaffSchema.safeParse({
      ...validInput,
      phone: '+57 300 123 4567',
      contractType: 'Planta',
      weeklyContractHours: 40,
      defaultShiftType: 'completo',
      trainingAreaIds: ['550e8400-e29b-41d4-a716-446655440000'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects short document number', () => {
    const result = createStaffSchema.safeParse({
      ...validInput,
      documentNumber: '123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid profile type', () => {
    const result = createStaffSchema.safeParse({
      ...validInput,
      profileType: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short first name', () => {
    const result = createStaffSchema.safeParse({
      ...validInput,
      firstName: 'J',
    })
    expect(result.success).toBe(false)
  })

  it('rejects weekly hours over 48', () => {
    const result = createStaffSchema.safeParse({
      ...validInput,
      weeklyContractHours: 50,
    })
    expect(result.success).toBe(false)
  })

  it('accepts all 4 profile types', () => {
    const profiles = ['bacteriologo', 'medico', 'tecnico_operativo', 'tecnico_administrativo']
    for (const profile of profiles) {
      const result = createStaffSchema.safeParse({ ...validInput, profileType: profile })
      expect(result.success).toBe(true)
    }
  })
})

describe('updateStaffSchema', () => {
  it('requires id', () => {
    const result = updateStaffSchema.safeParse({ firstName: 'Test' })
    expect(result.success).toBe(false)
  })

  it('accepts partial update with id', () => {
    const result = updateStaffSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      firstName: 'Updated',
    })
    expect(result.success).toBe(true)
  })

  it('accepts isActive field', () => {
    const result = updateStaffSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      isActive: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe(false)
    }
  })
})

describe('staffFilterSchema', () => {
  it('applies defaults', () => {
    const result = staffFilterSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.sortBy).toBe('lastName')
    expect(result.sortDirection).toBe('asc')
  })

  it('accepts all filter options', () => {
    const result = staffFilterSchema.safeParse({
      search: 'Juan',
      profileType: 'bacteriologo',
      isActive: true,
      trainingAreaId: '550e8400-e29b-41d4-a716-446655440000',
      page: 2,
      limit: 50,
      sortBy: 'firstName',
      sortDirection: 'desc',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid sort field', () => {
    const result = staffFilterSchema.safeParse({ sortBy: 'invalid' })
    expect(result.success).toBe(false)
  })
})
