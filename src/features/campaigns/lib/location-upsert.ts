import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { locations } from '@/lib/db/schema/locations'
import { normalizeName } from '@/lib/text/normalize-name'

/** Acepta tanto el cliente Drizzle como una transacción (`tx`). */
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface FindOrCreateLocationParams {
  companyId: string
  name: string
  address?: string | null
  municipality: string
}

/**
 * Busca una ubicación de la empresa por nombre (case-insensitive) o la crea.
 * Única fuente de verdad para crear `locations` desde import y create manual.
 * Devuelve el `locationId` o null si faltan datos mínimos (companyId/name).
 */
export async function findOrCreateLocation(
  tx: DbOrTx,
  { companyId, name, address, municipality }: FindOrCreateLocationParams,
): Promise<string | null> {
  if (!companyId || !name) return null

  // Dedup robusta: comparamos por nombre normalizado (sin acentos/may/espacios)
  // contra las ubicaciones de la empresa (suelen ser pocas).
  const target = normalizeName(name)
  const existing = await tx
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.companyId, companyId))

  const match = existing.find((l) => normalizeName(l.name) === target)
  if (match) return match.id

  const [created] = await tx
    .insert(locations)
    .values({
      companyId,
      name,
      address: address || name,
      municipality,
      isActive: true,
    })
    .returning({ id: locations.id })

  return created?.id ?? null
}
