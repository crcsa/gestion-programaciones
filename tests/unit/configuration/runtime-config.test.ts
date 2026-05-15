import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn() },
}))

vi.mock('@/lib/db/schema/system-config', () => ({
  systemConfig: { key: 'key', value: 'value' },
}))

import { db } from '@/lib/db'
import {
  loadValidationRuntimeConfig,
  invalidateRuntimeConfigCache,
} from '@/features/configuration/lib/runtime-config'

function chainResolving(rows: unknown[]): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'from']) chain[m] = vi.fn(() => chain)
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(rows))
  return chain
}

describe('loadValidationRuntimeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateRuntimeConfigCache()
  })

  it('returns DB values when present', async () => {
    const rows = [
      { key: 'weekly_hours', value: '40' },
      { key: 'max_extra_hours_week', value: '10' },
      { key: 'max_shift_hours', value: '8' },
      { key: 'min_rest_hours', value: '12' },
      { key: 'max_sundays_month', value: '1' },
      { key: 'max_overnights_month', value: '0' },
      { key: 'municipal_cutoff_time', value: '15:00' },
      { key: 'sede_municipality', value: 'Bogotá' },
    ]
    ;(db as unknown as { select: () => unknown }).select = vi.fn(() => chainResolving(rows))

    const config = await loadValidationRuntimeConfig()
    expect(config.weeklyHours).toBe(40)
    expect(config.maxExtraHoursWeek).toBe(10)
    expect(config.maxShiftHours).toBe(8)
    expect(config.minRestHours).toBe(12)
    expect(config.maxSundaysMonth).toBe(1)
    expect(config.maxOvernightsMonth).toBe(0)
    expect(config.municipalCutoffTime).toBe('15:00')
    expect(config.sedeMunicipality).toBe('Bogotá')
  })

  it('falls back to defaults for missing keys', async () => {
    const rows = [{ key: 'weekly_hours', value: '36' }]
    ;(db as unknown as { select: () => unknown }).select = vi.fn(() => chainResolving(rows))

    const config = await loadValidationRuntimeConfig()
    expect(config.weeklyHours).toBe(36)
    expect(config.maxExtraHoursWeek).toBe(12) // default
    expect(config.sedeMunicipality).toBe('Medellín') // default
  })

  it('falls back to defaults when DB throws', async () => {
    ;(db as unknown as { select: () => unknown }).select = vi.fn(() => {
      throw new Error('connection refused')
    })

    const config = await loadValidationRuntimeConfig()
    expect(config.weeklyHours).toBe(44)
    expect(config.maxShiftHours).toBe(12)
  })

  it('caches results within TTL window', async () => {
    const rows = [{ key: 'weekly_hours', value: '40' }]
    const selectMock = vi.fn(() => chainResolving(rows))
    ;(db as unknown as { select: () => unknown }).select = selectMock

    await loadValidationRuntimeConfig()
    await loadValidationRuntimeConfig()
    await loadValidationRuntimeConfig()

    expect(selectMock).toHaveBeenCalledTimes(1)
  })

  it('refreshes after invalidation', async () => {
    const rows = [{ key: 'weekly_hours', value: '40' }]
    const selectMock = vi.fn(() => chainResolving(rows))
    ;(db as unknown as { select: () => unknown }).select = selectMock

    await loadValidationRuntimeConfig()
    invalidateRuntimeConfigCache()
    await loadValidationRuntimeConfig()

    expect(selectMock).toHaveBeenCalledTimes(2)
  })

  it('ignores non-numeric values for numeric keys, falling back to default', async () => {
    const rows = [{ key: 'weekly_hours', value: 'not-a-number' }]
    ;(db as unknown as { select: () => unknown }).select = vi.fn(() => chainResolving(rows))

    const config = await loadValidationRuntimeConfig()
    expect(config.weeklyHours).toBe(44) // default
  })
})
