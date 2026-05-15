'use server'

import { eq, and, ne, asc, ilike } from 'drizzle-orm'
import { AppError, NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import { db } from '@/lib/db'
import { companyContacts } from '@/lib/db/schema/company-contacts'
import { companies } from '@/lib/db/schema/companies'
import { requireAccess } from '@/features/auth/lib/require-access'
import { logAudit } from '@/lib/audit/log-audit'
import {
  createContactSchema,
  updateContactSchema,
  importContactRowSchema,
} from '../schemas/contact-schemas'
import type {
  CreateContactInput,
  UpdateContactInput,
  ImportContactRow,
} from '../schemas/contact-schemas'
import type { CompanyContact } from '@/lib/db/schema/company-contacts'

export interface ImportContactsResult {
  imported: number
  skipped: number
  errors: { row: number; companyName: string; reason: string }[]
}

function emptyToUndefined(value?: string): string | undefined {
  return value && value.trim().length > 0 ? value.trim() : undefined
}

export async function listContacts(companyId: string): Promise<CompanyContact[]> {
  await requireAccess({ roles: ['admin', 'comercial', 'admin_area'] })

  try {
    return await db
      .select()
      .from(companyContacts)
      .where(eq(companyContacts.companyId, companyId))
      .orderBy(asc(companyContacts.fullName))
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener los contactos')
  }
}

export async function createContact(
  data: CreateContactInput,
): Promise<CompanyContact> {
  const { userId } = await requireAccess({ roles: ['admin', 'comercial'] })

  const validated = createContactSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const payload = {
    ...validated.data,
    email: emptyToUndefined(validated.data.email),
    phone: emptyToUndefined(validated.data.phone),
  }

  try {
    const created = await db.transaction(async (tx) => {
      if (payload.isPrimary) {
        await tx
          .update(companyContacts)
          .set({ isPrimary: false })
          .where(
            and(
              eq(companyContacts.companyId, payload.companyId),
              eq(companyContacts.isPrimary, true),
            ),
          )
      }

      const [row] = await tx
        .insert(companyContacts)
        .values({
          companyId: payload.companyId,
          fullName: payload.fullName,
          position: payload.position,
          email: payload.email,
          phone: payload.phone,
          isPrimary: payload.isPrimary,
          notes: payload.notes,
        })
        .returning()

      return row
    })

    await logAudit({
      profileId: userId,
      action: 'create',
      tableName: 'company_contacts',
      recordId: created.id,
      newData: { companyId: created.companyId, fullName: created.fullName },
    })

    return created
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al crear el contacto')
  }
}

export async function updateContact(
  data: UpdateContactInput,
): Promise<CompanyContact> {
  const { userId } = await requireAccess({ roles: ['admin', 'comercial'] })

  const validated = updateContactSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { id, companyId, ...rest } = validated.data
  const updateData = {
    ...rest,
    email: rest.email !== undefined ? emptyToUndefined(rest.email) : undefined,
    phone: rest.phone !== undefined ? emptyToUndefined(rest.phone) : undefined,
    updatedAt: new Date(),
  }

  try {
    const updated = await db.transaction(async (tx) => {
      if (rest.isPrimary === true && companyId) {
        await tx
          .update(companyContacts)
          .set({ isPrimary: false })
          .where(
            and(
              eq(companyContacts.companyId, companyId),
              eq(companyContacts.isPrimary, true),
              ne(companyContacts.id, id),
            ),
          )
      }

      const [row] = await tx
        .update(companyContacts)
        .set(updateData)
        .where(eq(companyContacts.id, id))
        .returning()

      return row
    })

    if (!updated) throw new NotFoundError('Contacto no encontrado')

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'company_contacts',
      recordId: updated.id,
    })

    return updated
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al actualizar el contacto')
  }
}

export async function deleteContact(id: string): Promise<void> {
  const { userId } = await requireAccess({ roles: ['admin', 'comercial'] })

  try {
    const [deleted] = await db
      .delete(companyContacts)
      .where(eq(companyContacts.id, id))
      .returning()

    if (!deleted) throw new NotFoundError('Contacto no encontrado')

    await logAudit({
      profileId: userId,
      action: 'delete',
      tableName: 'company_contacts',
      recordId: id,
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al eliminar el contacto')
  }
}

export async function importContacts(
  rows: ImportContactRow[],
): Promise<ImportContactsResult> {
  const { userId } = await requireAccess({ roles: ['admin', 'comercial'] })

  const result: ImportContactsResult = {
    imported: 0,
    skipped: 0,
    errors: [],
  }

  if (!Array.isArray(rows) || rows.length === 0) return result

  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 2
    const parsed = importContactRowSchema.safeParse(raw)
    if (!parsed.success) {
      result.errors.push({
        row: rowNumber,
        companyName: String(raw?.companyName ?? ''),
        reason: parsed.error.issues[0].message,
      })
      continue
    }

    const data = parsed.data
    const companyName = data.companyName.trim()

    try {
      const [company] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(ilike(companies.name, companyName))
        .limit(1)

      if (!company) {
        result.errors.push({
          row: rowNumber,
          companyName,
          reason: 'Empresa no encontrada en el directorio',
        })
        continue
      }

      const existing = await db
        .select({ id: companyContacts.id })
        .from(companyContacts)
        .where(
          and(
            eq(companyContacts.companyId, company.id),
            ilike(companyContacts.fullName, data.fullName),
          ),
        )
        .limit(1)

      if (existing.length > 0) {
        result.skipped += 1
        continue
      }

      await db.insert(companyContacts).values({
        companyId: company.id,
        fullName: data.fullName,
        position: emptyToUndefined(data.position),
        email: emptyToUndefined(data.email),
        phone: emptyToUndefined(data.phone),
        notes: emptyToUndefined(data.notes),
        isPrimary: false,
      })
      result.imported += 1
    } catch (error) {
      result.errors.push({
        row: rowNumber,
        companyName,
        reason: error instanceof Error ? error.message : 'Error desconocido',
      })
    }
  }

  if (result.imported > 0) {
    await logAudit({
      profileId: userId,
      action: 'create',
      tableName: 'company_contacts',
      recordId: 'bulk-import',
      newData: { imported: result.imported, skipped: result.skipped },
    })
  }

  return result
}
