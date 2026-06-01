import { describe, it, expect } from 'vitest'
import {
  createSedeShiftSchema,
  dayAssignmentItemSchema,
  bulkUpsertRangeShiftsSchema,
  duplicateWeekSedeShiftsSchema,
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

describe('bulkUpsertRangeShiftsSchema — rango contiguo misma semana', () => {
  // Semana ISO de referencia: lunes 2026-05-11 → domingo 2026-05-17.
  const validAssignment = {
    staffId: '550e8400-e29b-41d4-a716-446655440001',
    shiftType: 'diurno_completo' as const,
  }

  it('rango L–V dentro de la misma semana pasa', () => {
    const r = bulkUpsertRangeShiftsSchema.safeParse({
      dateFrom: '2026-05-11',
      dateTo: '2026-05-15',
      modality: 'sede',
      assignments: [validAssignment],
    })
    expect(r.success).toBe(true)
  })

  it('rango L–D (semana completa) pasa', () => {
    const r = bulkUpsertRangeShiftsSchema.safeParse({
      dateFrom: '2026-05-11',
      dateTo: '2026-05-17',
      modality: 'sede',
      assignments: [validAssignment],
    })
    expect(r.success).toBe(true)
  })

  it('dateFrom > dateTo bloquea', () => {
    const r = bulkUpsertRangeShiftsSchema.safeParse({
      dateFrom: '2026-05-15',
      dateTo: '2026-05-11',
      modality: 'sede',
      assignments: [validAssignment],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/inicio.*≤|menor|igual/i)
    }
  })

  it('rango cruzando dos semanas (Dom→Lun) bloquea', () => {
    // Domingo 2026-05-17 (semana del 11) → Lunes 2026-05-18 (semana del 18).
    const r = bulkUpsertRangeShiftsSchema.safeParse({
      dateFrom: '2026-05-17',
      dateTo: '2026-05-18',
      modality: 'sede',
      assignments: [validAssignment],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/misma semana|lunes a domingo/i)
    }
  })

  it('rango con dateFrom y dateTo iguales (1 día) pasa', () => {
    const r = bulkUpsertRangeShiftsSchema.safeParse({
      dateFrom: '2026-05-13',
      dateTo: '2026-05-13',
      modality: 'servicios',
      assignments: [
        { ...validAssignment, shiftType: 'servicios_transfusionales' as const },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('skipDates opcional con default vacío', () => {
    const r = bulkUpsertRangeShiftsSchema.safeParse({
      dateFrom: '2026-05-11',
      dateTo: '2026-05-15',
      modality: 'sede',
      assignments: [validAssignment],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.skipDates).toEqual([])
    }
  })

  it('skipDates acepta fechas válidas', () => {
    const r = bulkUpsertRangeShiftsSchema.safeParse({
      dateFrom: '2026-05-11',
      dateTo: '2026-05-15',
      modality: 'sede',
      assignments: [validAssignment],
      skipDates: ['2026-05-13', '2026-05-14'],
    })
    expect(r.success).toBe(true)
  })

  it('modalidad inválida bloquea', () => {
    const r = bulkUpsertRangeShiftsSchema.safeParse({
      dateFrom: '2026-05-11',
      dateTo: '2026-05-15',
      modality: 'invalida',
      assignments: [validAssignment],
    })
    expect(r.success).toBe(false)
  })

  it('formato de fecha inválido bloquea', () => {
    const r = bulkUpsertRangeShiftsSchema.safeParse({
      dateFrom: 'no-date',
      dateTo: '2026-05-15',
      modality: 'sede',
      assignments: [validAssignment],
    })
    expect(r.success).toBe(false)
  })
})

describe('duplicateWeekSedeShiftsSchema — duplicar semana origen → destino', () => {
  const validAssignment = {
    staffId: '550e8400-e29b-41d4-a716-446655440001',
    shiftType: 'diurno_completo' as const,
  }

  it('payload mínimo con 1 día válido pasa', () => {
    const r = duplicateWeekSedeShiftsSchema.safeParse({
      sourceWeekStart: '2026-01-12',
      targetWeekStart: '2026-01-19',
      perDay: [
        { date: '2026-01-19', modality: 'sede', assignments: [validAssignment] },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('payload vacío (perDay = []) pasa — caso degenerado para no-op', () => {
    const r = duplicateWeekSedeShiftsSchema.safeParse({
      sourceWeekStart: '2026-01-12',
      targetWeekStart: '2026-01-19',
      perDay: [],
    })
    expect(r.success).toBe(true)
  })

  it('payload con 14 buckets pasa (límite máximo)', () => {
    const perDay = Array.from({ length: 14 }, (_, i) => ({
      date: '2026-01-19',
      modality: i % 2 === 0 ? ('sede' as const) : ('servicios' as const),
      assignments: [
        {
          ...validAssignment,
          shiftType:
            i % 2 === 0
              ? ('diurno_completo' as const)
              : ('servicios_transfusionales' as const),
        },
      ],
    }))
    const r = duplicateWeekSedeShiftsSchema.safeParse({
      sourceWeekStart: '2026-01-12',
      targetWeekStart: '2026-01-19',
      perDay,
    })
    expect(r.success).toBe(true)
  })

  it('payload con 15 buckets bloquea', () => {
    const perDay = Array.from({ length: 15 }, () => ({
      date: '2026-01-19',
      modality: 'sede' as const,
      assignments: [validAssignment],
    }))
    const r = duplicateWeekSedeShiftsSchema.safeParse({
      sourceWeekStart: '2026-01-12',
      targetWeekStart: '2026-01-19',
      perDay,
    })
    expect(r.success).toBe(false)
  })

  it('sourceWeekStart con formato inválido bloquea', () => {
    const r = duplicateWeekSedeShiftsSchema.safeParse({
      sourceWeekStart: 'no-date',
      targetWeekStart: '2026-01-19',
      perDay: [],
    })
    expect(r.success).toBe(false)
  })

  it('modality inválida en un bucket bloquea', () => {
    const r = duplicateWeekSedeShiftsSchema.safeParse({
      sourceWeekStart: '2026-01-12',
      targetWeekStart: '2026-01-19',
      perDay: [
        {
          date: '2026-01-19',
          modality: 'otra' as unknown as 'sede',
          assignments: [validAssignment],
        },
      ],
    })
    expect(r.success).toBe(false)
  })
})
