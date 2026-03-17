'use server'

import { eq, ilike, and, or, sql, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { companies } from '@/lib/db/schema/companies'
import { requireRole } from '@/features/auth/lib/require-role'
import {
  createCampaignSchema,
  updateCampaignSchema,
  cancelCampaignSchema,
} from '../schemas/campaign-schemas'
import type { CreateCampaignInput } from '../schemas/campaign-schemas'
import type { Campaign } from '@/lib/db/schema/campaigns'

// ---- Types ----------------------------------------------------------------

export interface CampaignListFilters {
  search?: string
  status?: 'tentativa' | 'confirmada' | 'cancelada' | 'ejecutada'
  size?: 'S' | 'S_plus' | 'M' | 'L'
  modality?: 'presencial' | 'virtual' | 'mixta' | 'movil' | 'institucional'
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface CampaignListItem {
  id: string
  code: string
  municipality: string
  campaignDate: string
  size: 'S' | 'S_plus' | 'M' | 'L'
  modality: 'presencial' | 'virtual' | 'mixta' | 'movil' | 'institucional'
  status: 'tentativa' | 'confirmada' | 'cancelada' | 'ejecutada'
  expectedDonations: number | null
  companyName: string | null
  createdAt: Date
}

export interface CampaignListResult {
  data: CampaignListItem[]
  total: number
}

// ---- Helpers --------------------------------------------------------------

function buildListConditions(filters: CampaignListFilters) {
  const parts = [eq(campaigns.isDeleted, false)]

  if (filters.search) {
    parts.push(
      or(
        ilike(campaigns.code, `%${filters.search}%`),
        ilike(campaigns.municipality, `%${filters.search}%`),
      )!,
    )
  }

  if (filters.status) {
    parts.push(eq(campaigns.status, filters.status))
  }

  if (filters.size) {
    parts.push(eq(campaigns.size, filters.size))
  }

  if (filters.modality) {
    parts.push(eq(campaigns.modality, filters.modality))
  }

  if (filters.dateFrom) {
    parts.push(gte(campaigns.campaignDate, filters.dateFrom))
  }

  if (filters.dateTo) {
    parts.push(lte(campaigns.campaignDate, filters.dateTo))
  }

  if (parts.length === 1) return parts[0]
  return and(...(parts as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]))
}

// ---- Actions --------------------------------------------------------------

export async function getCampaignsList(
  filters: CampaignListFilters = {},
): Promise<CampaignListResult> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  const { page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  try {
    const conditions = buildListConditions(filters)

    const rows = await db
      .select({
        id: campaigns.id,
        code: campaigns.code,
        municipality: campaigns.municipality,
        campaignDate: campaigns.campaignDate,
        size: campaigns.size,
        modality: campaigns.modality,
        status: campaigns.status,
        expectedDonations: campaigns.expectedDonations,
        companyName: companies.name,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .leftJoin(companies, eq(campaigns.companyId, companies.id))
      .where(conditions ?? undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(campaigns.campaignDate))

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaigns)
      .where(conditions ?? undefined)

    const total = countRows[0]?.count ?? 0

    return { data: rows, total }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener la lista de campanas')
  }
}

export async function getCampaignById(
  id: string,
): Promise<Campaign & { companyName: string | null }> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  try {
    const [row] = await db
      .select({
        campaign: campaigns,
        companyName: companies.name,
      })
      .from(campaigns)
      .leftJoin(companies, eq(campaigns.companyId, companies.id))
      .where(and(eq(campaigns.id, id), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (!row) {
      throw new Error('Campana no encontrada')
    }

    return { ...row.campaign, companyName: row.companyName }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Campana no encontrada' ||
        error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al obtener la campana')
  }
}

export async function createCampaign(
  data: CreateCampaignInput,
): Promise<Campaign> {
  const { userId } = await requireRole(['admin', 'banco_sangre', 'comercial'])

  const validated = createCampaignSchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const input = validated.data

  try {
    const existing = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.code, input.code), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (existing.length > 0) {
      throw new Error('Ya existe una campana con ese codigo')
    }

    const [created] = await db
      .insert(campaigns)
      .values({
        code: input.code,
        companyId: input.companyId ?? null,
        locationId: input.locationId ?? null,
        campaignDate: input.campaignDate,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        size: input.size,
        modality: input.modality,
        status: 'tentativa',
        municipality: input.municipality,
        expectedDonations: input.expectedDonations ?? null,
        trainingAreaId: input.trainingAreaId ?? null,
        observations: input.observations ?? null,
        createdById: userId,
      })
      .returning()

    return created
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('codigo') || error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al crear la campana')
  }
}

export async function updateCampaign(
  id: string,
  data: Omit<CreateCampaignInput, 'code'>,
): Promise<Campaign> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  const validated = updateCampaignSchema.safeParse({ id, ...data })
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const { id: _id, ...fields } = validated.data

  try {
    const [current] = await db
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (!current) {
      throw new Error('Campana no encontrada')
    }

    if (current.status !== 'tentativa') {
      throw new Error(
        'No se puede editar una campana confirmada o cancelada',
      )
    }

    const [updated] = await db
      .update(campaigns)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning()

    if (!updated) {
      throw new Error('Campana no encontrada')
    }

    return updated
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Campana') ||
        error.message.includes('editar') ||
        error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al actualizar la campana')
  }
}

export async function confirmCampaign(id: string): Promise<Campaign> {
  const { userId } = await requireRole(['admin', 'comercial'])

  try {
    const [current] = await db
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (!current) {
      throw new Error('Campana no encontrada')
    }

    if (current.status === 'confirmada') {
      throw new Error('La campana ya esta confirmada')
    }

    if (current.status !== 'tentativa') {
      throw new Error(
        'Solo se pueden confirmar campanas en estado tentativa',
      )
    }

    const [updated] = await db
      .update(campaigns)
      .set({
        status: 'confirmada',
        confirmedById: userId,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))
      .returning()

    return updated
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Campana') ||
        error.message.includes('campana') ||
        error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al confirmar la campana')
  }
}

export async function cancelCampaign(
  id: string,
  reason: string,
): Promise<Campaign> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  const validated = cancelCampaignSchema.safeParse({
    id,
    cancelReason: reason,
  })
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  try {
    const [current] = await db
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (!current) {
      throw new Error('Campana no encontrada')
    }

    if (current.status === 'cancelada') {
      throw new Error('La campana ya esta cancelada')
    }

    if (current.status === 'ejecutada') {
      throw new Error('No se puede cancelar una campana ejecutada')
    }

    const [updated] = await db
      .update(campaigns)
      .set({
        status: 'cancelada',
        cancelReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))
      .returning()

    return updated
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Campana') ||
        error.message.includes('campana') ||
        error.message.includes('cancelar') ||
        error.message.includes('motivo') ||
        error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al cancelar la campana')
  }
}
