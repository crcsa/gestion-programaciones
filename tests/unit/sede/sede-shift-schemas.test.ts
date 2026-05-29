import { describe, it, expect } from 'vitest'
import {
  createSedeShiftSchema,
  dayAssignmentItemSchema,
} from '@/features/sede/schemas/sede-shift-schemas'

const baseInput = {
  staffId: '550e8400-e29b-41d4-a716-446655440001',
  shiftDate: '2026-05-13',
  isOvernight: false,
  extraHours: 0,
}

describe('createSedeShiftSchema — mínimo 8h efectivas en diurno_completo', () => {
  it('07:00-17:00 (9h efectivas) pasa', () => {
    const r = createSedeShiftSchema.safeParse({
      ...baseInput,
      shiftType: 'diurno_completo',
      startTime: '07:00',
      endTime: '17:00',
    })
    expect(r.success).toBe(true)
  })

  it('07:00-16:00 (8h efectivas exactas) pasa', () => {
    const r = createSedeShiftSchema.safeParse({
      ...baseInput,
      shiftType: 'diurno_completo',
      startTime: '07:00',
      endTime: '16:00',
    })
    expect(r.success).toBe(true)
  })

  it('07:00-14:00 (6h efectivas) bloquea', () => {
    const r = createSedeShiftSchema.safeParse({
      ...baseInput,
      shiftType: 'diurno_completo',
      startTime: '07:00',
      endTime: '14:00',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/8h efectivas/)
    }
  })

  it('07:00-13:00 (5h efectivas) bloquea', () => {
    const r = createSedeShiftSchema.safeParse({
      ...baseInput,
      shiftType: 'diurno_completo',
      startTime: '07:00',
      endTime: '13:00',
    })
    expect(r.success).toBe(false)
  })

  it('noche 18:00-06:00 (12h) pasa — sin descuento ni min', () => {
    const r = createSedeShiftSchema.safeParse({
      ...baseInput,
      shiftType: 'noche',
      startTime: '18:00',
      endTime: '06:00',
      isOvernight: true,
    })
    expect(r.success).toBe(true)
  })

  it('posturno 14:00-20:00 (6h) pasa — min solo aplica a diurno', () => {
    const r = createSedeShiftSchema.safeParse({
      ...baseInput,
      shiftType: 'posturno',
      startTime: '14:00',
      endTime: '20:00',
    })
    expect(r.success).toBe(true)
  })

  it('servicios_transfusionales 07:00-17:00 (9h efectivas) pasa', () => {
    const r = createSedeShiftSchema.safeParse({
      ...baseInput,
      shiftType: 'servicios_transfusionales',
      startTime: '07:00',
      endTime: '17:00',
    })
    expect(r.success).toBe(true)
  })

  it('servicios_transfusionales 07:00-14:00 (6h efectivas) bloquea', () => {
    const r = createSedeShiftSchema.safeParse({
      ...baseInput,
      shiftType: 'servicios_transfusionales',
      startTime: '07:00',
      endTime: '14:00',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/8h efectivas/)
    }
  })
})

describe('dayAssignmentItemSchema — bulk con tiempos opcionales', () => {
  const base = {
    staffId: '550e8400-e29b-41d4-a716-446655440001',
  }

  it('diurno sin tiempos custom usa defaults (07:00-17:00 → 9h) y pasa', () => {
    const r = dayAssignmentItemSchema.safeParse({
      ...base,
      shiftType: 'diurno_completo',
    })
    expect(r.success).toBe(true)
  })

  it('diurno con custom 07:00-14:00 bloquea', () => {
    const r = dayAssignmentItemSchema.safeParse({
      ...base,
      shiftType: 'diurno_completo',
      startTime: '07:00',
      endTime: '14:00',
      isOvernight: false,
    })
    expect(r.success).toBe(false)
  })

  it('diurno con custom 06:30-16:30 (9h efectivas) pasa', () => {
    const r = dayAssignmentItemSchema.safeParse({
      ...base,
      shiftType: 'diurno_completo',
      startTime: '06:30',
      endTime: '16:30',
      isOvernight: false,
    })
    expect(r.success).toBe(true)
  })

  it('servicios_transfusionales sin tiempos custom usa defaults (9h) y pasa', () => {
    const r = dayAssignmentItemSchema.safeParse({
      ...base,
      shiftType: 'servicios_transfusionales',
    })
    expect(r.success).toBe(true)
  })

  it('servicios_transfusionales con custom 07:00-14:00 bloquea', () => {
    const r = dayAssignmentItemSchema.safeParse({
      ...base,
      shiftType: 'servicios_transfusionales',
      startTime: '07:00',
      endTime: '14:00',
      isOvernight: false,
    })
    expect(r.success).toBe(false)
  })
})
