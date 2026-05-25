// ---------------------------------------------------------------------------
// Geocodificación con OpenStreetMap / Nominatim (sin API key ni billing).
// Solo se consume server-side (server action + script de backfill); no lleva
// `import 'server-only'` porque ese guard rompe al ejecutarse vía tsx en Node.
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
  /** true cuando se ubicó por centroide del municipio (no por dirección exacta). */
  approximate: boolean
}

interface NominatimHit {
  lat: string
  lon: string
  display_name: string
}

/** Lanza una sola consulta a Nominatim. Devuelve null ante 0 resultados o error. */
async function queryNominatim(query: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
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

/**
 * Geocodifica una dirección colombiana en dos niveles:
 *  1) Dirección exacta (calle + municipio + depto). Nominatim suele fallar con
 *     formatos colombianos detallados ("Calle 73 # 51d - 14").
 *  2) Fallback: centroide del municipio, para que la campaña quede ubicada al
 *     menos en el pueblo/ciudad correcto (marcado como `approximate`).
 * Devuelve null solo si ni siquiera el municipio resuelve. Nunca lanza.
 */
export async function geocodeAddress(
  address: string,
  municipality: string,
  department = 'Antioquia',
): Promise<GeocodeResult | null> {
  const fullParts = [address, municipality, department].map((p) => p?.trim()).filter(Boolean)
  if (fullParts.length === 0) return null

  const precise = await queryNominatim([...fullParts, 'Colombia'].join(', '))
  if (precise) return { ...precise, approximate: false }

  // Fallback a nivel municipio (solo si había dirección que falló).
  const muniParts = [municipality, department].map((p) => p?.trim()).filter(Boolean)
  if (address?.trim() && muniParts.length > 0) {
    const approx = await queryNominatim([...muniParts, 'Colombia'].join(', '))
    if (approx) return { ...approx, approximate: true }
  }

  return null
}
