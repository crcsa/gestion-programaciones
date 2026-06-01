import { describe, it, expect } from 'vitest'
import {
  mapDateToTargetWeek,
  weekDaysFromMonday,
  findCollisions,
} from '@/features/sede/lib/week-duplicate-mapping'

describe('mapDateToTargetWeek', () => {
  it('mapea Lun→Lun cuando origen y destino son semanas consecutivas', () => {
    // 2026-01-12 (lunes) → 2026-01-19 (lunes siguiente)
    expect(mapDateToTargetWeek('2026-01-12', '2026-01-12', '2026-01-19')).toBe(
      '2026-01-19',
    )
  })

  it('mapea Mié→Mié preservando el offset', () => {
    // miércoles 2026-01-14 (offset +2 desde lunes 12) → miércoles 2026-01-21
    expect(mapDateToTargetWeek('2026-01-14', '2026-01-12', '2026-01-19')).toBe(
      '2026-01-21',
    )
  })

  it('mapea Dom→Dom (offset +6)', () => {
    expect(mapDateToTargetWeek('2026-01-18', '2026-01-12', '2026-01-19')).toBe(
      '2026-01-25',
    )
  })

  it('mapea entre años distintos preservando día de la semana', () => {
    // origen: lunes 2025-12-29 → destino: lunes 2026-01-05
    // martes 2025-12-30 → martes 2026-01-06
    expect(mapDateToTargetWeek('2025-12-30', '2025-12-29', '2026-01-05')).toBe(
      '2026-01-06',
    )
  })

  it('mapea cuando destino es ANTERIOR al origen', () => {
    // destino lunes 2026-01-05, origen lunes 2026-01-12. Un mié origen → mié destino.
    expect(mapDateToTargetWeek('2026-01-14', '2026-01-12', '2026-01-05')).toBe(
      '2026-01-07',
    )
  })

  it('lanza si la fecha tiene formato inválido', () => {
    expect(() => mapDateToTargetWeek('xx', '2026-01-12', '2026-01-19')).toThrow(
      /Fecha ISO inválida/,
    )
  })
})

describe('weekDaysFromMonday', () => {
  it('devuelve 7 días en orden Lun..Dom', () => {
    const days = weekDaysFromMonday('2026-01-12')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-01-12')
    expect(days[6]).toBe('2026-01-18')
  })

  it('cruza fin de mes correctamente', () => {
    const days = weekDaysFromMonday('2026-01-26')
    expect(days[0]).toBe('2026-01-26')
    expect(days[5]).toBe('2026-01-31')
    expect(days[6]).toBe('2026-02-01')
  })

  it('cruza fin de año correctamente', () => {
    const days = weekDaysFromMonday('2025-12-29')
    expect(days[0]).toBe('2025-12-29')
    expect(days[3]).toBe('2026-01-01')
    expect(days[6]).toBe('2026-01-04')
  })
})

describe('findCollisions', () => {
  const src = '2026-01-12'
  const tgt = '2026-01-19'
  const staffA = 'a1'
  const staffB = 'b1'

  it('retorna vacío cuando no hay shifts en origen', () => {
    const res = findCollisions(
      [],
      [{ staffId: staffA, shiftDate: '2026-01-19', shiftType: 'diurno_completo' }],
      src,
      tgt,
    )
    expect(res).toEqual([])
  })

  it('retorna vacío cuando no hay shifts en destino', () => {
    const res = findCollisions(
      [{ staffId: staffA, shiftDate: '2026-01-12' }],
      [],
      src,
      tgt,
    )
    expect(res).toEqual([])
  })

  it('detecta colisión cuando staff y fecha destino coinciden', () => {
    // staffA en origen lunes 12 → destino lunes 19, donde ya hay un shift suyo.
    const res = findCollisions(
      [{ staffId: staffA, shiftDate: '2026-01-12' }],
      [{ staffId: staffA, shiftDate: '2026-01-19', shiftType: 'noche' }],
      src,
      tgt,
    )
    expect(res).toEqual([
      { targetDate: '2026-01-19', staffId: staffA, existingShiftType: 'noche' },
    ])
  })

  it('no detecta colisión cuando el staff es distinto', () => {
    const res = findCollisions(
      [{ staffId: staffA, shiftDate: '2026-01-12' }],
      [{ staffId: staffB, shiftDate: '2026-01-19', shiftType: 'noche' }],
      src,
      tgt,
    )
    expect(res).toEqual([])
  })

  it('no detecta colisión cuando el día de la semana NO coincide', () => {
    // staffA en origen martes 13 → destino martes 20. Destino tiene shift miércoles 21.
    const res = findCollisions(
      [{ staffId: staffA, shiftDate: '2026-01-13' }],
      [{ staffId: staffA, shiftDate: '2026-01-21', shiftType: 'diurno_completo' }],
      src,
      tgt,
    )
    expect(res).toEqual([])
  })

  it('deduplica colisiones para el mismo (staffId, targetDate)', () => {
    // Origen tiene 2 entradas del mismo staff en el mismo día (caso raro, pero
    // posible si la query no agrupa). Debe colisionar una sola vez.
    const res = findCollisions(
      [
        { staffId: staffA, shiftDate: '2026-01-12' },
        { staffId: staffA, shiftDate: '2026-01-12' },
      ],
      [{ staffId: staffA, shiftDate: '2026-01-19', shiftType: 'noche' }],
      src,
      tgt,
    )
    expect(res).toHaveLength(1)
  })

  it('detecta múltiples colisiones independientes', () => {
    const res = findCollisions(
      [
        { staffId: staffA, shiftDate: '2026-01-12' }, // L
        { staffId: staffB, shiftDate: '2026-01-14' }, // X
      ],
      [
        { staffId: staffA, shiftDate: '2026-01-19', shiftType: 'noche' }, // L destino
        { staffId: staffB, shiftDate: '2026-01-21', shiftType: 'posturno' }, // X destino
      ],
      src,
      tgt,
    )
    expect(res).toHaveLength(2)
    expect(res).toContainEqual({
      targetDate: '2026-01-19',
      staffId: staffA,
      existingShiftType: 'noche',
    })
    expect(res).toContainEqual({
      targetDate: '2026-01-21',
      staffId: staffB,
      existingShiftType: 'posturno',
    })
  })
})
