'use server'

import { eq, and, ilike, or, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema/companies'
import { campaigns } from '@/lib/db/schema/campaigns'
import { requireRole } from '@/features/auth/lib/require-role'
import { createCompanySchema, updateCompanySchema } from '../schemas/company-schemas'
import type { CreateCompanyInput, UpdateCompanyInput } from '../schemas/company-schemas'
import type { Company } from '@/lib/db/schema/companies'

// ---- Types ----------------------------------------------------------------

export interface CompanyListFilters {
  search?: string
  isActive?: boolean
  page?: number
  limit?: number
}

// ---- Actions --------------------------------------------------------------

export async function getCompaniesList(
  filters: CompanyListFilters = {},
): Promise<{ data: Company[]; total: number }> {
  await requireRole(['admin', 'comercial'])

  const { page = 1, limit = 20, search, isActive } = filters
  const offset = (page - 1) * limit

  try {
    const conditions = []

    if (search) {
      conditions.push(
        or(ilike(companies.name, `%${search}%`), ilike(companies.nit, `%${search}%`))!,
      )
    }

    if (isActive !== undefined) {
      conditions.push(eq(companies.isActive, isActive))
    }

    const where = conditions.length === 1
      ? conditions[0]
      : conditions.length > 1
        ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]))
        : undefined

    const rows = await db
      .select()
      .from(companies)
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(companies.name)

    const countRows = await db
      .select({ id: companies.id })
      .from(companies)
      .where(where)

    return { data: rows, total: countRows.length }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener la lista de empresas')
  }
}

export async function getCompanyById(id: string): Promise<Company> {
  await requireRole(['admin', 'comercial'])

  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1)

    if (!company) throw new Error('Empresa no encontrada')
    return company
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Empresa no encontrada' || error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al obtener la empresa')
  }
}

export async function createCompany(data: CreateCompanyInput): Promise<Company> {
  await requireRole(['admin', 'comercial'])

  const validated = createCompanySchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  try {
    if (validated.data.nit) {
      const [existing] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.nit, validated.data.nit))
        .limit(1)

      if (existing) {
        throw new Error('Ya existe una empresa con ese NIT')
      }
    }

    const [created] = await db
      .insert(companies)
      .values(validated.data)
      .returning()

    return created
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('permiso') || error.message.includes('NIT'))
    ) {
      throw error
    }
    throw new Error('Error al crear la empresa')
  }
}

export async function updateCompany(data: UpdateCompanyInput): Promise<Company> {
  await requireRole(['admin', 'comercial'])

  const validated = updateCompanySchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const { id, ...updateData } = validated.data

  try {
    if (updateData.nit) {
      const [existing] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.nit, updateData.nit))
        .limit(1)

      if (existing && existing.id !== id) {
        throw new Error('Ya existe otra empresa con ese NIT')
      }
    }

    const [updated] = await db
      .update(companies)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning()

    if (!updated) throw new Error('Empresa no encontrada')
    return updated
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('permiso') ||
        error.message.includes('NIT') ||
        error.message === 'Empresa no encontrada')
    ) {
      throw error
    }
    throw new Error('Error al actualizar la empresa')
  }
}

export async function deactivateCompany(id: string): Promise<void> {
  await requireRole(['admin', 'comercial'])

  try {
    const today = new Date().toISOString().slice(0, 10)

    const futureCampaigns = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.companyId, id),
          or(
            eq(campaigns.status, 'tentativa'),
            eq(campaigns.status, 'confirmada'),
          )!,
          gte(campaigns.campaignDate, today),
          eq(campaigns.isDeleted, false),
        ),
      )
      .limit(1)

    if (futureCampaigns.length > 0) {
      throw new Error('No se puede desactivar la empresa: tiene campañas tentativas o confirmadas futuras')
    }

    const [updated] = await db
      .update(companies)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning()

    if (!updated) throw new Error('Empresa no encontrada')
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('permiso') ||
        error.message.startsWith('No se puede desactivar') ||
        error.message === 'Empresa no encontrada')
    ) {
      throw error
    }
    throw new Error('Error al desactivar la empresa')
  }
}

export async function activateCompany(id: string): Promise<void> {
  await requireRole(['admin', 'comercial'])

  try {
    const [updated] = await db
      .update(companies)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning()

    if (!updated) throw new Error('Empresa no encontrada')
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('permiso') || error.message === 'Empresa no encontrada')
    ) {
      throw error
    }
    throw new Error('Error al activar la empresa')
  }
}
