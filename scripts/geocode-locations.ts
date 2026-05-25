/**
 * Backfill de geolocalización: geocodifica con Nominatim (OpenStreetMap) todas
 * las `locations` que tienen dirección pero aún no tienen lat/lng, y persiste
 * las coordenadas.
 *
 * Cuándo correrlo: una vez tras aplicar la migración 0029 (columnas lat/lng),
 * para georreferenciar en lote las ubicaciones ya creadas por el import del CRM.
 * Las nuevas se llenan solas al primer view del mapa (lazy).
 *
 * Uso:
 *   pnpm db:geocode-locations
 *
 * Idempotente: solo procesa las que no tienen coords. Respeta la política de
 * Nominatim con un throttle de 1.1s entre llamadas. Reporta fallos parciales
 * sin abortar y termina con exit code 1 si hubo errores.
 */

import { and, eq, isNull, isNotNull, ne } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { locations } from '../src/lib/db/schema/locations'
import { geocodeAddress } from '../src/lib/geocoding/nominatim'

// Cada ubicación puede disparar 2 requests (dirección exacta + fallback a
// municipio). Para no exceder ~1 req/seg de la política de Nominatim público,
// esperamos ~2.2s entre ubicaciones.
const THROTTLE_MS = 2200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const start = Date.now()

  const pending = await db
    .select({
      id: locations.id,
      address: locations.address,
      municipality: locations.municipality,
      department: locations.department,
    })
    .from(locations)
    .where(and(isNull(locations.latitude), isNotNull(locations.address), ne(locations.address, '')))

  console.log(`[geocode] ${pending.length} ubicación(es) por geocodificar`)

  let ok = 0
  let notFound = 0
  let failed = 0

  for (let i = 0; i < pending.length; i++) {
    const loc = pending[i]
    try {
      const result = await geocodeAddress(loc.address, loc.municipality, loc.department)
      if (result) {
        await db
          .update(locations)
          .set({ latitude: result.lat, longitude: result.lng, geocodedAt: new Date() })
          .where(eq(locations.id, loc.id))
        ok++
        console.log(`[geocode] ✓ ${loc.address}, ${loc.municipality} → ${result.lat},${result.lng}`)
      } else {
        notFound++
        console.warn(`[geocode] ⚠ sin resultado: ${loc.address}, ${loc.municipality}`)
      }
    } catch (err) {
      failed++
      console.error(`[geocode] ✗ ${loc.id}`, err)
    }
    // Throttle salvo en la última iteración.
    if (i < pending.length - 1) await sleep(THROTTLE_MS)
  }

  console.log(
    `[geocode] done en ${((Date.now() - start) / 1000).toFixed(1)}s — ${ok} OK, ${notFound} sin resultado, ${failed} fallos`,
  )
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[geocode] error fatal:', err)
  process.exit(1)
})
