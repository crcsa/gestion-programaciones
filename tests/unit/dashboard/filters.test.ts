import { describe, it, expect } from 'vitest'
import {
  parseDashboardFilters,
  serializeDashboardFilters,
  periodToDateRange,
  DEFAULT_FILTERS,
} from '@/features/dashboard/lib/filters'

describe('parseDashboardFilters', () => {
  it('devuelve defaults cuando no hay params', () => {
    expect(parseDashboardFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('parsea period válido', () => {
    const r = parseDashboardFilters(new URLSearchParams('period=thisMonth'))
    expect(r.period).toBe('thisMonth')
  })

  it('rechaza period inválido', () => {
    const r = parseDashboardFilters(new URLSearchParams('period=foo'))
    expect(r.period).toBe(DEFAULT_FILTERS.period)
  })

  it('parsea profile válido y rechaza inválido', () => {
    expect(
      parseDashboardFilters(new URLSearchParams('profile=tecnico')).profile,
    ).toBe('tecnico')
    expect(
      parseDashboardFilters(new URLSearchParams('profile=foo')).profile,
    ).toBeNull()
  })

  it('acepta municipality cualquiera no vacío', () => {
    expect(
      parseDashboardFilters(new URLSearchParams('municipality=Medellin')).municipality,
    ).toBe('Medellin')
    expect(
      parseDashboardFilters(new URLSearchParams('municipality=')).municipality,
    ).toBeNull()
  })

  it('acepta objeto plano de searchParams (Next.js style)', () => {
    const r = parseDashboardFilters({
      period: 'lastWeek',
      profile: 'medico',
      municipality: 'Bogota',
    })
    expect(r).toEqual({
      period: 'lastWeek',
      profile: 'medico',
      municipality: 'Bogota',
      area: null,
    })
  })
})

describe('serializeDashboardFilters', () => {
  it('omite defaults', () => {
    expect(serializeDashboardFilters(DEFAULT_FILTERS).toString()).toBe('')
  })

  it('preserva non-defaults', () => {
    const sp = serializeDashboardFilters({
      period: 'lastWeek',
      profile: 'medico',
      municipality: 'Bogota',
      area: null,
    })
    expect(sp.get('period')).toBe('lastWeek')
    expect(sp.get('profile')).toBe('medico')
    expect(sp.get('municipality')).toBe('Bogota')
  })

  it('serializa area cuando está presente', () => {
    const sp = serializeDashboardFilters({
      period: 'thisWeek',
      profile: null,
      municipality: null,
      area: 'logistica',
    })
    expect(sp.get('area')).toBe('logistica')
  })

  it('roundtrip parse → serialize → parse mantiene los datos', () => {
    const original = {
      period: 'thisMonth' as const,
      profile: 'auxiliar' as const,
      municipality: 'Cali',
      area: 'banco_sangre' as const,
    }
    const sp = serializeDashboardFilters(original)
    const parsed = parseDashboardFilters(sp)
    expect(parsed).toEqual(original)
  })
})

describe('periodToDateRange', () => {
  it('thisWeek arranca en lunes de la semana de now', () => {
    // Miércoles 2026-05-13 → lunes 2026-05-11
    const r = periodToDateRange('thisWeek', new Date('2026-05-13T12:00:00'))
    expect(r.start).toBe('2026-05-11')
    expect(r.end).toBe('2026-05-17')
    expect(r.weekStart).toBe('2026-05-11')
  })

  it('lastWeek es la semana anterior completa', () => {
    const r = periodToDateRange('lastWeek', new Date('2026-05-13T12:00:00'))
    expect(r.start).toBe('2026-05-04')
    expect(r.end).toBe('2026-05-10')
  })

  it('thisMonth arranca el día 1', () => {
    const r = periodToDateRange('thisMonth', new Date('2026-05-13T12:00:00'))
    expect(r.start).toBe('2026-05-01')
    expect(r.end).toBe('2026-05-13')
  })

  it('last30d cubre los últimos 30 días', () => {
    const r = periodToDateRange('last30d', new Date('2026-05-30T12:00:00'))
    expect(r.start).toBe('2026-05-01')
    expect(r.end).toBe('2026-05-30')
  })
})
