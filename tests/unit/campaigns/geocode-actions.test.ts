import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/db/schema/locations', () => ({
  locations: {
    id: 'id', address: 'address', municipality: 'municipality',
    department: 'department', latitude: 'latitude', longitude: 'longitude',
  },
}))
vi.mock('@/features/auth/lib/user-context', () => ({
  requireUserContext: vi.fn().mockResolvedValue({ userId: 'u1', role: 'admin' }),
}))
vi.mock('@/lib/geocoding/nominatim', () => ({
  geocodeAddress: vi.fn(),
}))

import { db } from '@/lib/db'
import { geocodeAddress } from '@/lib/geocoding/nominatim'
import { ensureLocationGeocoded } from '@/features/campaigns/actions/geocode-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'from', 'where', 'limit', 'update', 'set']) {
    chain[m] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

const mockDb = db as unknown as { select: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }

describe('ensureLocationGeocoded', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve coords guardadas sin llamar a Nominatim', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'l1', address: 'a', municipality: 'm', department: 'Antioquia', latitude: 6.2, longitude: -75.5 }]))
    mockDb.update = vi.fn(() => makeChain([]))

    const result = await ensureLocationGeocoded('l1')

    expect(result).toEqual({ lat: 6.2, lng: -75.5 })
    expect(geocodeAddress).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('geocodifica y persiste cuando faltan coords', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'l1', address: 'Calle 73', municipality: 'Medellín', department: 'Antioquia', latitude: null, longitude: null }]))
    mockDb.update = vi.fn(() => makeChain([]))
    vi.mocked(geocodeAddress).mockResolvedValue({ lat: 6.1, lng: -75.6, displayName: 'x' })

    const result = await ensureLocationGeocoded('l1')

    expect(geocodeAddress).toHaveBeenCalledWith('Calle 73', 'Medellín', 'Antioquia')
    expect(mockDb.update).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ lat: 6.1, lng: -75.6 })
  })

  it('devuelve null si la ubicación no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    expect(await ensureLocationGeocoded('nope')).toBeNull()
    expect(geocodeAddress).not.toHaveBeenCalled()
  })

  it('devuelve null si no hay dirección', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'l1', address: '', municipality: 'm', department: 'Antioquia', latitude: null, longitude: null }]))
    expect(await ensureLocationGeocoded('l1')).toBeNull()
    expect(geocodeAddress).not.toHaveBeenCalled()
  })

  it('devuelve null (no persiste) si Nominatim no encuentra', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'l1', address: 'xyz', municipality: 'm', department: 'Antioquia', latitude: null, longitude: null }]))
    mockDb.update = vi.fn(() => makeChain([]))
    vi.mocked(geocodeAddress).mockResolvedValue(null)

    expect(await ensureLocationGeocoded('l1')).toBeNull()
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})
