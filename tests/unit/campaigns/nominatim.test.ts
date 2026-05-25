import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { geocodeAddress } from '@/lib/geocoding/nominatim'

describe('geocodeAddress (Nominatim)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('construye la query con país y devuelve lat/lng numéricos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { lat: '6.2476', lon: '-75.5658', display_name: 'Medellín, Colombia' },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await geocodeAddress('Calle 73 # 51d - 14', 'Medellín')

    expect(result).toEqual({ lat: 6.2476, lng: -75.5658, displayName: 'Medellín, Colombia', approximate: false })
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get('countrycodes')).toBe('co')
    expect(url.searchParams.get('q')).toBe('Calle 73 # 51d - 14, Medellín, Antioquia, Colombia')
    // User-Agent obligatorio por la política de Nominatim.
    expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toContain('gestion-programaciones')
  })

  it('devuelve null cuando no hay resultados (ni dirección ni municipio)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    expect(await geocodeAddress('xyz', 'Nowhere')).toBeNull()
  })

  it('cae al centroide del municipio (approximate) cuando la dirección exacta falla', async () => {
    const fetchMock = vi
      .fn()
      // 1ª llamada (dirección exacta) → sin resultado
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      // 2ª llamada (solo municipio) → hit
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: '6.25', lon: '-75.56', display_name: 'Medellín' }],
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await geocodeAddress('Calle imposible # 999', 'Medellín')

    expect(result).toEqual({ lat: 6.25, lng: -75.56, displayName: 'Medellín', approximate: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // La 2ª query NO incluye la dirección, solo municipio + depto + país.
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('q')).toBe('Medellín, Antioquia, Colombia')
  })

  it('devuelve null (no lanza) ante error HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => [] }))
    expect(await geocodeAddress('a', 'b')).toBeNull()
  })

  it('devuelve null (no lanza) ante fallo de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await geocodeAddress('a', 'b')).toBeNull()
  })

  it('devuelve null si la query queda vacía (sin dirección, municipio ni depto)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await geocodeAddress('', '', '')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('descarta coordenadas no numéricas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [{ lat: 'NaN', lon: 'x', display_name: 'q' }] }),
    )
    expect(await geocodeAddress('a', 'b')).toBeNull()
  })
})
