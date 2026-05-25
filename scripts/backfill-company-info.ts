/**
 * Backfill de info de empresa: rellena las columnas planas de `companies`
 * (municipality, address, contactName, contactPhone) que quedaron vacías en
 * empresas creadas por imports antiguos (que solo seteaban `name`).
 *
 * Fuente de los datos: las `locations` y `company_contacts` que el import SÍ
 * crea. Toma la 1ª ubicación (municipio/dirección) y el 1er contacto
 * (nombre/teléfono) de cada empresa.
 *
 * Cuándo correrlo: una vez tras desplegar el cambio de "rellenar info de empresa
 * al importar", para que las empresas ya importadas muestren su info en /empresas.
 *
 * Uso:
 *   pnpm db:backfill-company-info
 *
 * Idempotente: solo rellena columnas null; no pisa datos existentes.
 */

import { asc, eq, isNull, or } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { companies } from '../src/lib/db/schema/companies'
import { locations } from '../src/lib/db/schema/locations'
import { companyContacts } from '../src/lib/db/schema/company-contacts'

async function main() {
  const start = Date.now()

  const pending = await db
    .select({
      id: companies.id,
      name: companies.name,
      municipality: companies.municipality,
      address: companies.address,
      contactName: companies.contactName,
      contactPhone: companies.contactPhone,
    })
    .from(companies)
    .where(
      or(
        isNull(companies.municipality),
        isNull(companies.address),
        isNull(companies.contactName),
        isNull(companies.contactPhone),
      ),
    )

  console.log(`[backfill-company] ${pending.length} empresa(s) con info incompleta`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const c of pending) {
    try {
      const [loc] = await db
        .select({ address: locations.address, municipality: locations.municipality })
        .from(locations)
        .where(eq(locations.companyId, c.id))
        .orderBy(asc(locations.createdAt))
        .limit(1)

      const [contact] = await db
        .select({ fullName: companyContacts.fullName, phone: companyContacts.phone })
        .from(companyContacts)
        .where(eq(companyContacts.companyId, c.id))
        .orderBy(asc(companyContacts.createdAt))
        .limit(1)

      // Construir set solo con columnas hoy vacías que tengan fuente.
      const set: Record<string, string> = {}
      if (!c.municipality && loc?.municipality) set.municipality = loc.municipality
      if (!c.address && loc?.address) set.address = loc.address
      if (!c.contactName && contact?.fullName) set.contactName = contact.fullName
      if (!c.contactPhone && contact?.phone) set.contactPhone = contact.phone

      if (Object.keys(set).length === 0) {
        skipped++
        continue
      }

      await db
        .update(companies)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(companies.id, c.id))
      updated++
      console.log(`[backfill-company] ✓ ${c.name} → ${Object.keys(set).join(', ')}`)
    } catch (err) {
      failed++
      console.error(`[backfill-company] ✗ ${c.id} (${c.name})`, err)
    }
  }

  console.log(
    `[backfill-company] done en ${((Date.now() - start) / 1000).toFixed(1)}s — ${updated} actualizadas, ${skipped} sin fuente, ${failed} fallos`,
  )
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[backfill-company] error fatal:', err)
  process.exit(1)
})
