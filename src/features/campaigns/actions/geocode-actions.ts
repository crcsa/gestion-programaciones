'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { locations } from '@/lib/db/schema/locations'
import { requireUserContext } from '@/features/auth/lib/user-context'
import { geocodeAddress } from '@/lib/geocoding/nominatim'
import { rethrowOrLog } from '@/lib/errors/rethrow'

export interface LocationCoords {
  lat: number
  lng: number
}

/**
 * Devuelve las coordenadas de una ubicación, geocodificándola con Nominatim la
 * primera vez y persistiéndolas (cache permanente en DB). Cualquier usuario
 * autenticado puede dispararla — es lectura/relleno de cache, no mutación de negocio.
 * Devuelve null si la ubicación no existe, no tiene dirección, o no se pudo geocodificar.
 */
export async function ensureLocationGeocoded(
  locationId: string,
): Promise<LocationCoords | null> {
  await requireUserContext()

  try {
    const [loc] = await db
      .select({
        id: locations.id,
        address: locations.address,
        municipality: locations.municipality,
        department: locations.department,
        latitude: locations.latitude,
        longitude: locations.longitude,
      })
      .from(locations)
      .where(eq(locations.id, locationId))
      .limit(1)

    if (!loc) return null

    // Ya geocodificada → devolver lo guardado.
    if (loc.latitude != null && loc.longitude != null) {
      return { lat: loc.latitude, lng: loc.longitude }
    }

    if (!loc.address) return null

    const result = await geocodeAddress(loc.address, loc.municipality, loc.department)
    if (!result) return null

    await db
      .update(locations)
      .set({ latitude: result.lat, longitude: result.lng, geocodedAt: new Date() })
      .where(eq(locations.id, locationId))

    return { lat: result.lat, lng: result.lng }
  } catch (error) {
    rethrowOrLog(error, 'ensureLocationGeocoded', 'No se pudo obtener la ubicación')
  }
}
