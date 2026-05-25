import { and, eq, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import { locations } from '@/lib/db/schema/locations'

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

  const existing = await tx
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.companyId, companyId), ilike(locations.name, name)))
    .limit(1)

  if (existing.length > 0) return existing[0].id

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
