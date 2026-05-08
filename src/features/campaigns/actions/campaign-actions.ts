'use server'

import { eq, ilike, and, or, sql, gte, lte, desc, asc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { companies } from '@/lib/db/schema/companies'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireRole } from '@/features/auth/lib/require-role'
import {
  createCampaignSchema,
  updateCampaignSchema,
  cancelCampaignSchema,
  importExcelRowSchema,
} from '../schemas/campaign-schemas'
import { logAudit } from '@/lib/audit/log-audit'
import type { CreateCampaignInput, ImportExcelRow } from '../schemas/campaign-schemas'
import type { Campaign } from '@/lib/db/schema/campaigns'

// ---- Types ----------------------------------------------------------------

export interface CampaignListFilters {
  search?: string
  status?: 'tentativa' | 'confirmada' | 'cancelada' | 'ejecutada'
  size?: 'S' | 'S_plus' | 'M' | 'L'
  modality?: 'corporativa' | 'carpa' | 'unidad_movil' | 'municipal' | 'combinada'
  dateFrom?: string
  dateTo?: string
  companyId?: string
  weekStart?: string  // filters campaigns in that week (Mon–Sun)
  page?: number
  limit?: number
}

export interface CampaignListItem {
  id: string
  code: string
  municipality: string
  campaignDate: string
  size: 'S' | 'S_plus' | 'M' | 'L'
  modality: 'corporativa' | 'carpa' | 'unidad_movil' | 'municipal' | 'combinada'
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

  if (filters.companyId) {
    parts.push(eq(campaigns.companyId, filters.companyId))
  }

  if (filters.weekStart) {
    const weekEnd = (() => {
      const d = new Date(`${filters.weekStart}T00:00:00`)
      d.setDate(d.getDate() + 6)
      return d.toISOString().slice(0, 10)
    })()
    parts.push(gte(campaigns.campaignDate, filters.weekStart))
    parts.push(lte(campaigns.campaignDate, weekEnd))
  }

  if (parts.length === 1) return parts[0]
  return and(...(parts as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]))
}

// ---- Actions --------------------------------------------------------------

export async function getCampaignsList(
  filters: CampaignListFilters = {},
): Promise<CampaignListResult> {
  const { userId, role } = await requireRole(['admin', 'banco_sangre', 'comercial', 'operativo'])

  const { page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  try {
    // Operativo: only see campaigns they are assigned to
    if (role === 'operativo') {
      return await getOperativoCampaigns(userId, filters, offset, limit)
    }

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
    throw new Error('Error al obtener la lista de campañas')
  }
}

async function getOperativoCampaigns(
  userId: string,
  filters: CampaignListFilters,
  offset: number,
  limit: number,
): Promise<CampaignListResult> {
  // Find the staff member linked to this user
  const [staffRow] = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(eq(staffMembers.profileId, userId))
    .limit(1)

  if (!staffRow) {
    return { data: [], total: 0 }
  }

  // Get campaign IDs this staff member is actively assigned to
  const assignedRows = await db
    .select({ campaignId: campaignAssignments.campaignId })
    .from(campaignAssignments)
    .where(
      and(
        eq(campaignAssignments.staffId, staffRow.id),
        eq(campaignAssignments.isActive, true),
      ),
    )

  const assignedIds = assignedRows.map((a) => a.campaignId)

  if (assignedIds.length === 0) {
    return { data: [], total: 0 }
  }

  const baseConditions = buildListConditions(filters)
  const assignedCondition = inArray(campaigns.id, assignedIds)
  const conditions = baseConditions
    ? and(baseConditions, assignedCondition)
    : assignedCondition

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
    .where(conditions)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(campaigns.campaignDate))

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(conditions)

  const total = countRows[0]?.count ?? 0

  return { data: rows, total }
}

export async function getCampaignById(
  id: string,
): Promise<Campaign & { companyName: string | null }> {
  const { userId, role } = await requireRole(['admin', 'banco_sangre', 'comercial', 'operativo'])

  try {
    // Operativo: only see campaigns they are actively assigned to
    if (role === 'operativo') {
      const [staffRow] = await db
        .select({ id: staffMembers.id })
        .from(staffMembers)
        .where(eq(staffMembers.profileId, userId))
        .limit(1)

      if (!staffRow) throw new Error('Campaña no encontrada')

      const [assignment] = await db
        .select({ campaignId: campaignAssignments.campaignId })
        .from(campaignAssignments)
        .where(
          and(
            eq(campaignAssignments.staffId, staffRow.id),
            eq(campaignAssignments.campaignId, id),
            eq(campaignAssignments.isActive, true),
          ),
        )
        .limit(1)

      if (!assignment) throw new Error('Campaña no encontrada')
    }

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
      throw new Error('Campaña no encontrada')
    }

    return { ...row.campaign, companyName: row.companyName }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Campaña no encontrada' ||
        error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al obtener la campaña')
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
      throw new Error('Ya existe una campaña con ese código')
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
        hexabankCode: input.hexabankCode ?? null,
        createdById: userId,
      })
      .returning()

    await logAudit({
      profileId: userId,
      action: 'create',
      tableName: 'campaigns',
      recordId: created.id,
      newData: { code: created.code, status: created.status },
    })

    return created
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('código') || error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al crear la campaña')
  }
}

export async function updateCampaign(
  id: string,
  data: Omit<CreateCampaignInput, 'code'>,
): Promise<Campaign> {
  const { userId } = await requireRole(['admin', 'banco_sangre', 'comercial'])

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
      throw new Error('Campaña no encontrada')
    }

    if (current.status !== 'tentativa') {
      throw new Error(
        'No se puede editar una campaña confirmada o cancelada',
      )
    }

    const [updated] = await db
      .update(campaigns)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning()

    if (!updated) {
      throw new Error('Campaña no encontrada')
    }

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'campaigns',
      recordId: updated.id,
    })

    return updated
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Campaña') ||
        error.message.includes('editar') ||
        error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al actualizar la campaña')
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
      throw new Error('Campaña no encontrada')
    }

    if (current.status === 'confirmada') {
      throw new Error('La campaña ya está confirmada')
    }

    if (current.status !== 'tentativa') {
      throw new Error(
        'Solo se pueden confirmar campañas en estado tentativa',
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
      (error.message.includes('Campaña') ||
        error.message.includes('campaña') ||
        error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al confirmar la campaña')
  }
}

export async function cancelCampaign(
  id: string,
  reason: string,
): Promise<Campaign> {
  const { userId } = await requireRole(['admin', 'banco_sangre', 'comercial'])

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
      throw new Error('Campaña no encontrada')
    }

    if (current.status === 'cancelada') {
      throw new Error('La campaña ya está cancelada')
    }

    if (current.status === 'ejecutada') {
      throw new Error('No se puede cancelar una campaña ejecutada')
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

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'campaigns',
      recordId: updated.id,
      newData: { status: 'cancelada', cancelReason: reason },
    })

    return updated
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Campaña') ||
        error.message.includes('campaña') ||
        error.message.includes('cancelar') ||
        error.message.includes('motivo') ||
        error.message.includes('permiso'))
    ) {
      throw error
    }
    throw new Error('Error al cancelar la campaña')
  }
}

export async function deleteCampaign(id: string): Promise<void> {
  const { userId } = await requireRole(['admin', 'comercial'])

  try {
    const [current] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (!current) throw new Error('Campaña no encontrada')

    await db
      .update(campaigns)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(campaigns.id, id))

    await logAudit({
      profileId: userId,
      action: 'delete',
      tableName: 'campaigns',
      recordId: id,
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Campaña') || error.message.includes('permiso'))) {
      throw error
    }
    throw new Error('Error al eliminar la campaña')
  }
}

// ---- Commercial view ------------------------------------------------------

export interface CommercialStaffMember {
  staffId: string
  firstName: string
  lastName: string
  cedula: string
  staffProfile: string
  isCoordinator: boolean
}

export async function getAssignedStaffForCommercial(
  campaignId: string,
): Promise<CommercialStaffMember[]> {
  await requireRole(['admin', 'comercial'])

  try {
    const rows = await db
      .select({
        staffId: campaignAssignments.staffId,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        cedula: staffMembers.cedula,
        staffProfile: staffMembers.staffProfile,
        isCoordinator: campaignAssignments.isCoordinator,
      })
      .from(campaignAssignments)
      .leftJoin(staffMembers, eq(campaignAssignments.staffId, staffMembers.id))
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
        ),
      )
      .orderBy(desc(campaignAssignments.isCoordinator), asc(staffMembers.lastName))

    return rows as CommercialStaffMember[]
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener el personal asignado para vista comercial')
  }
}

// ---- Excel import ---------------------------------------------------------

export interface ImportResult {
  imported: number
  skipped: number
  errors: { row: number; code: string; reason: string }[]
}

export async function importCampaignsFromExcel(
  rows: ImportExcelRow[],
): Promise<ImportResult> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2 // Excel row (1 = header)

    const parsed = importExcelRowSchema.safeParse(raw)
    if (!parsed.success) {
      result.errors.push({
        row: rowNum,
        code: raw.code ?? `fila ${rowNum}`,
        reason: parsed.error.issues[0].message,
      })
      continue
    }

    const data = parsed.data

    try {
      // Skip if code already exists
      const existing = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.code, data.code))
        .limit(1)

      if (existing.length > 0) {
        result.skipped++
        continue
      }

      // Find or create company by name (case-insensitive)
      let companyId: string | null = null
      const existingCompany = await db
        .select({ id: companies.id })
        .from(companies)
        .where(ilike(companies.name, data.companyName))
        .limit(1)

      if (existingCompany.length > 0) {
        companyId = existingCompany[0].id
      } else {
        const [newCompany] = await db
          .insert(companies)
          .values({ name: data.companyName, isActive: true })
          .returning({ id: companies.id })
        companyId = newCompany?.id ?? null
      }

      await db.insert(campaigns).values({
        code: data.code,
        companyId,
        municipality: data.municipality,
        campaignDate: data.campaignDate,
        size: data.size,
        modality: data.modality,
        expectedDonations: data.expectedDonations ?? null,
        observations: data.observations ?? null,
        status: 'tentativa',
      })

      result.imported++
    } catch {
      result.errors.push({
        row: rowNum,
        code: data.code,
        reason: 'Error al guardar en la base de datos',
      })
    }
  }

  return result
}
