import 'server-only'

// ---------------------------------------------------------------------------
// Geocodificación con OpenStreetMap / Nominatim (sin API key ni billing).
// Política de uso de Nominatim: máx ~1 req/seg y un User-Agent identificable.
// El throttle se aplica en los callers (lazy: 1 view a la vez; backfill: sleep).
// https://operations.osmfoundation.org/policies/nominatim/
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org'
const CONTACT_EMAIL = process.env.NOMINATIM_EMAIL || ''
const USER_AGENT = `gestion-programaciones/1.0 (CRC Antioquia${CONTACT_EMAIL ? `; ${CONTACT_EMAIL}` : ''})`

export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
}

interface NominatimHit {
  lat: string
  lon: string
  display_name: string
}

/**
 * Geocodifica una dirección colombiana. Devuelve null si no hay resultados o
 * si la API falla (el caller decide cómo mostrarlo; nunca lanza por "no encontrado").
 */
export async function geocodeAddress(
  address: string,
  municipality: string,
  department = 'Antioquia',
): Promise<GeocodeResult | null> {
  const parts = [address, municipality, department].map((p) => p?.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const query = [...parts, 'Colombia'].join(', ')

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'co',
    addressdetails: '0',
  })
  if (CONTACT_EMAIL) params.set('email', CONTACT_EMAIL)

  try {
    const res = await fetch(`${BASE_URL}/search?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
      // No cachear en el edge: los resultados se persisten en DB por nosotros.
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error('[nominatim] HTTP', res.status, 'para query:', query)
      return null
    }

    const hits = (await res.json()) as NominatimHit[]
    const hit = hits?.[0]
    if (!hit) return null

    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    return { lat, lng, displayName: hit.display_name }
  } catch (error) {
    console.error('[nominatim] fetch falló para query:', query, error)
    return null
  }
}
