'use server'

import { eq, ilike, and, or, sql, gte, lte, desc, asc, inArray, type SQL } from 'drizzle-orm'
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import type { Area } from '@/types/areas'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { campaigns, campaignDays } from '@/lib/db/schema/campaigns'
import { companies } from '@/lib/db/schema/companies'
import { locations } from '@/lib/db/schema/locations'
import { companyContacts } from '@/lib/db/schema/company-contacts'
import { findOrCreateLocation } from '../lib/location-upsert'
import { normalizeName } from '@/lib/text/normalize-name'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireAccess } from '@/features/auth/lib/require-access'
import {
  createCampaignSchema,
  updateCampaignSchema,
  cancelCampaignSchema,
  importExcelRowSchema,
} from '../schemas/campaign-schemas'
import { logAudit } from '@/lib/audit/log-audit'
import { recalcAggregatesForCampaign } from '@/features/hours/lib/aggregate-staff-data'
import type {
  CampaignDaySchedule,
  CreateCampaignInput,
  ImportExcelRow,
} from '../schemas/campaign-schemas'
import type { Campaign, CampaignDay } from '@/lib/db/schema/campaigns'

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

/**
 * Scope de campañas para un admin de área operativa (banco_sangre/logística):
 * ven TODAS las campañas confirmadas/ejecutadas (su universo asignable), no solo
 * las que ya tienen asignación de su área — de lo contrario no podrían ver una
 * campaña recién confirmada para asignarle personal/vehículos (huevo-gallina).
 * Admin global, comercial y admin_area+comercial → sin filtro (ven todo).
 */
function assignableCampaignScope(areaScope: Area | null): SQL | undefined {
  if (areaScope === 'banco_sangre' || areaScope === 'logistica') {
    return inArray(campaigns.status, ['confirmada', 'ejecutada'])
  }
  return undefined
}

function buildListConditions(
  filters: CampaignListFilters,
  areaScope: Area | null = null,
) {
  const parts: SQL[] = [eq(campaigns.isDeleted, false)]

  // Scope por área: el admin operativo (banco_sangre/logística) ve las campañas
  // confirmadas/ejecutadas. Admin global y comercial pasan sin filtro de área.
  const areaPredicate = assignableCampaignScope(areaScope)
  if (areaPredicate) parts.push(areaPredicate)

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
  const { userId, role, scope } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial', 'operativo'],
    allowCrossArea: true,
  })

  const { page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  try {
    // Operativo: only see campaigns they are assigned to
    if (role === 'operativo') {
      return await getOperativoCampaigns(userId, filters, offset, limit)
    }

    // Admin global y comercial (allowCrossArea) → scope global, sin filtro.
    // admin_area banco_sangre/logística → ven las campañas confirmadas/ejecutadas
    // (universo asignable) vía `assignableCampaignScope`.
    const areaScope: Area | null = scope.kind === 'global' ? null : scope.area
    const conditions = buildListConditions(filters, areaScope)

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
    rethrowOrLog(error, 'getCampaignsList', 'Error al obtener la lista de campañas')
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
    // Perfil operativo sin staff_member vinculado: pantalla vacía es legítima
    // (el usuario no tiene asignaciones), pero loggeamos estructurado para que
    // monitoring detecte cuentas mal aprovisionadas.
    console.error(
      JSON.stringify({
        errorId: 'OPERATIVO_WITHOUT_STAFF_LINK',
        action: 'getCampaignsList',
        userId,
        severity: 'warn',
        reason: 'Operativo profile is not linked to any staff_member',
      }),
    )
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

// ---- Helpers --------------------------------------------------------------

function buildDailySchedulesForRange(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
): CampaignDaySchedule[] {
  const result: CampaignDaySchedule[] = []
  // Construimos las fechas en UTC e incrementamos por componentes UTC para
  // evitar el corrimiento de día que produce `new Date('YYYY-MM-DDT00:00:00')`
  // (hora local) + `toISOString()` (UTC) en zonas con offset negativo (Colombia).
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const cursor = new Date(Date.UTC(sy, sm - 1, sd))
  const end = new Date(Date.UTC(ey, em - 1, ed))
  while (cursor <= end) {
    const dayDate = cursor.toISOString().slice(0, 10)
    result.push({
      dayDate,
      startTime,
      endTime,
      isOvernight: dayDate !== endDate, // todos los días excepto el último marcan pernocta
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

async function persistCampaignDays(
  campaignId: string,
  schedules: CampaignDaySchedule[] | undefined,
): Promise<void> {
  await db.delete(campaignDays).where(eq(campaignDays.campaignId, campaignId))
  if (!schedules || schedules.length === 0) return
  await db.insert(campaignDays).values(
    schedules.map((s) => ({
      campaignId,
      dayDate: s.dayDate,
      startTime: s.startTime,
      endTime: s.endTime,
      isOvernight: s.isOvernight ?? false,
    })),
  )
}

export async function getCampaignDays(campaignId: string): Promise<CampaignDay[]> {
  await requireAccess({ roles: ['admin', 'admin_area', 'comercial', 'operativo'] })
  return await db
    .select()
    .from(campaignDays)
    .where(eq(campaignDays.campaignId, campaignId))
    .orderBy(asc(campaignDays.dayDate))
}

export interface CampaignLocation {
  id: string
  address: string
  municipality: string
  referencePoint: string | null
  latitude: number | null
  longitude: number | null
}

export async function getCampaignById(
  id: string,
): Promise<
  Campaign & {
    companyName: string | null
    location: CampaignLocation | null
    days: CampaignDay[]
  }
> {
  const { userId, role, scope } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial', 'operativo'],
    allowCrossArea: true,
  })

  try {
    // Operativo: only see campaigns they are actively assigned to.
    if (role === 'operativo') {
      const [staffRow] = await db
        .select({ id: staffMembers.id })
        .from(staffMembers)
        .where(eq(staffMembers.profileId, userId))
        .limit(1)

      if (!staffRow) throw new NotFoundError('Campaña no encontrada')

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

      if (!assignment) throw new NotFoundError('Campaña no encontrada')
    }

    // admin_area (banco_sangre/logística) solo puede ver la campaña si su
    // área tiene asignación activa (banco_sangre staff o vehículo logístico).
    // Comercial y admin global pasan con scope global.
    const areaScope: Area | null = scope.kind === 'global' ? null : scope.area
    const areaPredicate = assignableCampaignScope(areaScope)
    const whereParts: SQL[] = [eq(campaigns.id, id), eq(campaigns.isDeleted, false)]
    if (areaPredicate) whereParts.push(areaPredicate)

    const [row] = await db
      .select({
        campaign: campaigns,
        companyName: companies.name,
        location: {
          id: locations.id,
          address: locations.address,
          municipality: locations.municipality,
          referencePoint: locations.referencePoint,
          latitude: locations.latitude,
          longitude: locations.longitude,
        },
      })
      .from(campaigns)
      .leftJoin(companies, eq(campaigns.companyId, companies.id))
      .leftJoin(locations, eq(campaigns.locationId, locations.id))
      .where(and(...whereParts))
      .limit(1)

    if (!row) {
      throw new NotFoundError('Campaña no encontrada')
    }

    const days = await getCampaignDays(id)

    return {
      ...row.campaign,
      companyName: row.companyName,
      location: row.location?.id ? row.location : null,
      days,
    }
  } catch (error) {
    rethrowOrLog(error, 'getCampaignById', 'Error al obtener la campaña')
  }
}

export async function createCampaign(
  data: CreateCampaignInput,
): Promise<Campaign> {
  const { userId } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    areas: ['comercial'],
    allowCrossArea: true,
  })

  const validated = createCampaignSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const input = validated.data

  try {
    const existing = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.code, input.code), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (existing.length > 0) {
      throw new ConflictError('Ya existe una campaña con ese código')
    }

    const isMultiDay = !!input.endDate && input.endDate > input.campaignDate
    const effectiveEndDate = input.endDate && input.endDate >= input.campaignDate ? input.endDate : null

    // Si se ingresó dirección y hay empresa, crear/enlazar una ubicación
    // (mismo helper que el import) para que la campaña salga en el mapa.
    let locationId = input.locationId ?? null
    if (!locationId && input.address && input.companyId) {
      locationId = await findOrCreateLocation(db, {
        companyId: input.companyId,
        name: input.address,
        address: input.address,
        municipality: input.municipality,
      })
    }

    const [created] = await db
      .insert(campaigns)
      .values({
        code: input.code,
        companyId: input.companyId ?? null,
        locationId,
        campaignDate: input.campaignDate,
        endDate: effectiveEndDate,
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

    // Persistir horario por día.
    let schedules = input.dailySchedules
    if (!schedules && isMultiDay && input.startTime && input.endTime && input.endDate) {
      // Fallback: si es multi-día pero no envió dailySchedules explícitos, expandimos
      // con startTime/endTime para todos los días (pernocta entre días intermedios).
      schedules = buildDailySchedulesForRange(
        input.campaignDate,
        input.endDate,
        input.startTime,
        input.endTime,
      )
    } else if (!schedules && input.startTime && input.endTime) {
      // Mono-día con horarios → 1 row en campaign_days para consistencia.
      schedules = [
        {
          dayDate: input.campaignDate,
          startTime: input.startTime,
          endTime: input.endTime,
          isOvernight: false,
        },
      ]
    }

    if (schedules && schedules.length > 0) {
      await persistCampaignDays(created.id, schedules)
    }

    await logAudit({
      profileId: userId,
      action: 'create',
      tableName: 'campaigns',
      recordId: created.id,
      newData: { code: created.code, status: created.status, days: schedules?.length ?? 0 },
    })

    return created
  } catch (error) {
    if (error instanceof AppError) throw error
    const cause = (error as { cause?: { message?: string; code?: string } })?.cause
    const detail = cause?.message ?? (error instanceof Error ? error.message : '')
    console.error('[createCampaign] error:', error, 'cause:', cause)
    // Caso conocido: migración pendiente. Lo exponemos al cliente porque es
    // accionable.
    if (
      cause?.code === '42703' || // undefined column
      /column .* does not exist/i.test(detail) ||
      /relation .* does not exist/i.test(detail)
    ) {
      throw new Error(
        'Falta aplicar la migración de campañas multi-día. Ejecuta `pnpm db:migrate`.',
      )
    }
    throw new Error('Error al crear la campaña. Revisa los logs para más detalles.')
  }
}

export async function updateCampaign(
  id: string,
  data: Omit<CreateCampaignInput, 'code'>,
): Promise<Campaign> {
  const { userId } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    areas: ['comercial'],
    allowCrossArea: true,
  })

  const validated = updateCampaignSchema.safeParse({ id, ...data })
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { id: _id, dailySchedules, ...fields } = validated.data

  try {
    const [current] = await db
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (!current) {
      throw new NotFoundError('Campaña no encontrada')
    }

    if (current.status !== 'tentativa') {
      throw new ValidationError(
        'No se puede editar una campaña confirmada o cancelada',
      )
    }

    // Normaliza endDate: null si es mono-día o si endDate < campaignDate
    const normalizedFields: Record<string, unknown> = { ...fields, updatedAt: new Date() }
    if (fields.endDate !== undefined) {
      normalizedFields.endDate =
        fields.endDate && fields.campaignDate && fields.endDate > fields.campaignDate
          ? fields.endDate
          : null
    }

    const [updated] = await db
      .update(campaigns)
      .set(normalizedFields)
      .where(eq(campaigns.id, id))
      .returning()

    if (!updated) {
      throw new NotFoundError('Campaña no encontrada')
    }

    // Reescribe campaign_days si se proveyeron dailySchedules.
    if (dailySchedules !== undefined) {
      await persistCampaignDays(id, dailySchedules)
    } else if (
      updated.campaignDate &&
      updated.endDate &&
      updated.endDate > updated.campaignDate &&
      updated.startTime &&
      updated.endTime
    ) {
      // Multi-día sin schedules explícitos → expandir desde startTime/endTime.
      const expanded = buildDailySchedulesForRange(
        updated.campaignDate,
        updated.endDate,
        updated.startTime,
        updated.endTime,
      )
      await persistCampaignDays(id, expanded)
    } else if (
      updated.campaignDate &&
      (!updated.endDate || updated.endDate === updated.campaignDate) &&
      updated.startTime &&
      updated.endTime
    ) {
      // Mono-día → 1 row en campaign_days.
      await persistCampaignDays(id, [
        {
          dayDate: updated.campaignDate,
          startTime: updated.startTime,
          endTime: updated.endTime,
          isOvernight: false,
        },
      ])
    }

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'campaigns',
      recordId: updated.id,
    })

    revalidatePath('/campanas')
    revalidatePath(`/campanas/${id}`)
    return updated
  } catch (error) {
    rethrowOrLog(error, 'updateCampaign', 'Error al actualizar la campaña')
  }
}

export async function confirmCampaign(id: string): Promise<Campaign> {
  const { userId } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    areas: ['comercial'],
    allowCrossArea: true,
  })

  try {
    const [current] = await db
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (!current) {
      throw new NotFoundError('Campaña no encontrada')
    }

    if (current.status === 'confirmada') {
      throw new ValidationError('La campaña ya está confirmada')
    }

    if (current.status !== 'tentativa') {
      throw new ValidationError(
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
    if (!updated) {
      throw new NotFoundError('Campaña no encontrada')
    }

    revalidatePath('/campanas')
    revalidatePath(`/campanas/${id}`)
    return updated
  } catch (error) {
    rethrowOrLog(error, 'confirmCampaign', 'Error al confirmar la campaña')
  }
}

export async function cancelCampaign(
  id: string,
  reason: string,
): Promise<Campaign> {
  const { userId } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    areas: ['comercial'],
    allowCrossArea: true,
  })

  const validated = cancelCampaignSchema.safeParse({
    id,
    cancelReason: reason,
  })
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  try {
    const [current] = await db
      .select({
        id: campaigns.id,
        status: campaigns.status,
        campaignDate: campaigns.campaignDate,
      })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (!current) {
      throw new NotFoundError('Campaña no encontrada')
    }

    if (current.status === 'cancelada') {
      throw new ValidationError('La campaña ya está cancelada')
    }

    if (current.status === 'ejecutada') {
      throw new ValidationError('No se puede cancelar una campaña ejecutada')
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

    const assigned = await db
      .select({ staffId: campaignAssignments.staffId })
      .from(campaignAssignments)
      .where(
        and(
          eq(campaignAssignments.campaignId, id),
          eq(campaignAssignments.isActive, true),
        ),
      )

    if (assigned.length > 0) {
      await recalcAggregatesForCampaign(
        id,
        assigned.map((a) => a.staffId),
        'cancelCampaign',
      )
    }

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'campaigns',
      recordId: updated.id,
      newData: { status: 'cancelada', cancelReason: reason },
    })

    revalidatePath('/campanas')
    revalidatePath(`/campanas/${id}`)
    return updated
  } catch (error) {
    rethrowOrLog(error, 'cancelCampaign', 'Error al cancelar la campaña')
  }
}

export interface BulkActionResult {
  ok: number
  skipped: number
  errors: { id: string; reason: string }[]
}

/**
 * Confirma varias campañas tentativa en lote. Reutiliza `confirmCampaign` por id
 * (misma validación/permiso/auditoría); las que no estén en 'tentativa' se cuentan
 * como `skipped`. Permiso: el mismo de confirmar (comercial / admin global).
 */
export async function bulkConfirmCampaigns(ids: string[]): Promise<BulkActionResult> {
  await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    areas: ['comercial'],
    allowCrossArea: true,
  })

  const result: BulkActionResult = { ok: 0, skipped: 0, errors: [] }
  for (const id of ids) {
    try {
      await confirmCampaign(id)
      result.ok++
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        result.skipped++
      } else {
        result.errors.push({ id, reason: error instanceof Error ? error.message : 'Error' })
      }
    }
  }
  revalidatePath('/campanas')
  return result
}

/** Cancela varias campañas en lote con un mismo motivo. */
export async function bulkCancelCampaigns(
  ids: string[],
  reason: string,
): Promise<BulkActionResult> {
  await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    areas: ['comercial'],
    allowCrossArea: true,
  })

  const result: BulkActionResult = { ok: 0, skipped: 0, errors: [] }
  for (const id of ids) {
    try {
      await cancelCampaign(id, reason)
      result.ok++
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        result.skipped++
      } else {
        result.errors.push({ id, reason: error instanceof Error ? error.message : 'Error' })
      }
    }
  }
  revalidatePath('/campanas')
  return result
}

export async function deleteCampaign(id: string): Promise<void> {
  const { userId } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    areas: ['comercial'],
    allowCrossArea: true,
  })

  try {
    const [current] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.isDeleted, false)))
      .limit(1)

    if (!current) throw new NotFoundError('Campaña no encontrada')

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

    revalidatePath('/campanas')
  } catch (error) {
    rethrowOrLog(error, 'deleteCampaign', 'Error al eliminar la campaña')
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
  // Lectura abierta a cualquier rol que pueda ver el detalle de campaña
  // (admin global, admin_area, comercial, operativo asignado). Antes excluía a
  // admin_area+comercial, que sí ve la vista comercial → PermissionError.
  await requireAccess({ roles: ['admin', 'admin_area', 'comercial', 'operativo'] })

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
    rethrowOrLog(error, 'getCampaignAssignedStaffForCommercial', 'Error al obtener el personal asignado para vista comercial')
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
  const { userId } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    areas: ['comercial'],
    allowCrossArea: true,
  })

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  // Prefetch de empresas para dedup robusto (nombre normalizado: sin acentos/
  // mayúsculas/espacios) y también dentro del mismo archivo. El map se actualiza
  // al crear empresas nuevas (tras commit de cada fila).
  const companyRows = await db.select({ id: companies.id, name: companies.name }).from(companies)
  const companyMap = new Map<string, string>()
  for (const c of companyRows) companyMap.set(normalizeName(c.name), c.id)

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

      // Cada fila es atómica: empresa + contacto + ubicación + campaña + días.
      // La transacción retorna la empresa creada (si la hubo) para actualizar el
      // map tras el commit (evita estado inconsistente si la fila hace rollback).
      const createdCompany = await db.transaction(async (tx) => {
        let newCompanyForMap: { norm: string; id: string } | null = null
        // 1. Empresa: dedup robusto por nombre normalizado (prefetch map).
        const companyNorm = normalizeName(data.companyName)
        let companyId: string | null = companyMap.get(companyNorm) ?? null
        const companyInfo = {
          municipality: data.municipality || null,
          address: data.address ?? null,
          contactName: data.contactName ?? null,
          contactPhone: data.contactPhone ?? null,
        }

        if (companyId) {
          // Rellenar SOLO columnas vacías (COALESCE no pisa lo ya cargado ni lo
          // editado a mano). Solo si esta fila aporta algún dato nuevo.
          const hasInfo =
            companyInfo.municipality ||
            companyInfo.address ||
            companyInfo.contactName ||
            companyInfo.contactPhone
          if (hasInfo) {
            await tx
              .update(companies)
              .set({
                municipality: sql`COALESCE(${companies.municipality}, ${companyInfo.municipality})`,
                address: sql`COALESCE(${companies.address}, ${companyInfo.address})`,
                contactName: sql`COALESCE(${companies.contactName}, ${companyInfo.contactName})`,
                contactPhone: sql`COALESCE(${companies.contactPhone}, ${companyInfo.contactPhone})`,
                updatedAt: new Date(),
              })
              .where(eq(companies.id, companyId))
          }
        } else {
          const [newCompany] = await tx
            .insert(companies)
            .values({ name: data.companyName, isActive: true, ...companyInfo })
            .returning({ id: companies.id })
          companyId = newCompany?.id ?? null
          if (companyId) newCompanyForMap = { norm: companyNorm, id: companyId }
        }

        // 2. Ubicación (find/create por empresa + nombre, helper compartido).
        let locationId: string | null = null
        const locationName = data.locationName || data.address
        if (companyId && locationName) {
          locationId = await findOrCreateLocation(tx, {
            companyId,
            name: locationName,
            address: data.address,
            municipality: data.municipality,
          })
        }

        // 3. Contacto de la empresa (dedup robusto por nombre normalizado).
        if (companyId && data.contactName) {
          const contacts = await tx
            .select({ id: companyContacts.id, fullName: companyContacts.fullName, phone: companyContacts.phone })
            .from(companyContacts)
            .where(eq(companyContacts.companyId, companyId))

          const contactNorm = normalizeName(data.contactName)
          const match = contacts.find((c) => normalizeName(c.fullName) === contactNorm)

          if (!match) {
            await tx.insert(companyContacts).values({
              companyId,
              fullName: data.contactName,
              phone: data.contactPhone ?? null,
            })
          } else if (!match.phone && data.contactPhone) {
            // Rellenar el teléfono si el contacto existía sin él.
            await tx
              .update(companyContacts)
              .set({ phone: data.contactPhone, updatedAt: new Date() })
              .where(eq(companyContacts.id, match.id))
          }
        }

        // 4. Campaña.
        const isMultiDay = !!data.endDate && data.endDate > data.campaignDate
        const effectiveEndDate =
          data.endDate && data.endDate >= data.campaignDate ? data.endDate : null

        const [created] = await tx
          .insert(campaigns)
          .values({
            code: data.code,
            companyId,
            locationId,
            municipality: data.municipality,
            campaignDate: data.campaignDate,
            endDate: effectiveEndDate,
            startTime: data.startTime ?? null,
            endTime: data.endTime ?? null,
            size: data.size,
            modality: data.modality,
            expectedDonations: data.expectedDonations ?? null,
            observations: data.observations ?? null,
            status: 'tentativa',
            createdById: userId,
          })
          .returning({ id: campaigns.id, code: campaigns.code })

        // 5. Horario por día (espejo de createCampaign).
        let schedules: CampaignDaySchedule[] | undefined
        if (isMultiDay && data.startTime && data.endTime && data.endDate) {
          schedules = buildDailySchedulesForRange(
            data.campaignDate,
            data.endDate,
            data.startTime,
            data.endTime,
          )
        } else if (data.startTime && data.endTime) {
          schedules = [
            {
              dayDate: data.campaignDate,
              startTime: data.startTime,
              endTime: data.endTime,
              isOvernight: false,
            },
          ]
        }

        if (created && schedules && schedules.length > 0) {
          await tx.insert(campaignDays).values(
            schedules.map((s) => ({
              campaignId: created.id,
              dayDate: s.dayDate,
              startTime: s.startTime,
              endTime: s.endTime,
              isOvernight: s.isOvernight ?? false,
            })),
          )
        }

        if (created) {
          await logAudit({
            profileId: userId,
            action: 'create',
            tableName: 'campaigns',
            recordId: created.id,
            newData: { code: created.code, status: 'tentativa', source: 'excel_import' },
          })
        }

        return newCompanyForMap
      })

      // Tras commit: registrar la empresa nueva en el map para dedup de filas siguientes.
      if (createdCompany) {
        companyMap.set(createdCompany.norm, createdCompany.id)
      }

      result.imported++
    } catch (error) {
      console.error('[importCampaignsFromExcel] row', rowNum, error)
      const cause = (error as { cause?: { code?: string } })?.cause
      let reason: string
      if (error instanceof AppError) {
        reason = error.message
      } else if (cause?.code === '23505') {
        // Violación de UNIQUE (ej. code duplicado dentro del mismo archivo).
        reason = 'Ya existe una campaña con ese código.'
      } else {
        reason = 'Error al guardar en la base de datos (revisa los logs del servidor).'
      }
      result.errors.push({
        row: rowNum,
        code: data.code,
        reason,
      })
    }
  }

  return result
}
