'use server'

import { revalidatePath } from 'next/cache'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireAccess } from '@/features/auth/lib/require-access'
import { logAudit } from '@/lib/audit/log-audit'
import { NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import { recalcAggregatesForCampaign } from '@/features/hours/lib/aggregate-staff-data'
import {
  assignCommercialStaffSchema,
  type AssignCommercialStaffInput,
} from '../schemas/commercial-assignment-schemas'
import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'

// ---- Constants ------------------------------------------------------------

/** Solo admin global y admin_area de comercial editan asignaciones comerciales. */
const COMMERCIAL_ASSIGN_ACCESS: { roles: Role[]; areas: Area[] } = {
  roles: ['admin', 'admin_area'],
  areas: ['comercial'],
}

/** Cualquiera con acceso al dashboard puede LEER las asignaciones (read-only cross-área). */
const READ_ACCESS: { roles: Role[] } = {
  roles: ['admin', 'admin_area', 'comercial', 'operativo'],
}

// ---- Types ----------------------------------------------------------------

export interface CommercialStaffCandidate {
  id: string
  firstName: string
  lastName: string
  cedula: string
}

export interface CommercialStaffAssignment {
  assignmentId: string
  staffId: string
  firstName: string
  lastName: string
  cedula: string
  assignedAt: Date
}

// ---- Actions --------------------------------------------------------------

/**
 * Operativos comerciales activos (`area='comercial' AND staffProfile='comercial'`)
 * que NO estén ya asignados activamente a la campaña.
 */
export async function getAvailableCommercialStaff(
  campaignId: string,
): Promise<CommercialStaffCandidate[]> {
  await requireAccess(COMMERCIAL_ASSIGN_ACCESS)

  try {
    const assigned = await db
      .select({ staffId: campaignAssignments.staffId })
      .from(campaignAssignments)
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
        ),
      )
    const assignedIds = new Set(assigned.map((a) => a.staffId))

    const rows = await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        cedula: staffMembers.cedula,
      })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.isActive, true),
          eq(staffMembers.area, 'comercial'),
          eq(staffMembers.staffProfile, 'comercial'),
        ),
      )
      .orderBy(asc(staffMembers.lastName))

    return rows.filter((s) => !assignedIds.has(s.id))
  } catch (error) {
    rethrowOrLog(
      error,
      'getAvailableCommercialStaff',
      'Error al obtener operativos comerciales disponibles',
    )
  }
}

/**
 * Operativos comerciales actualmente asignados a la campaña. Lectura abierta:
 * banco_sangre y logística los ven para coordinar (read-only).
 */
export async function getAssignedCommercialStaff(
  campaignId: string,
): Promise<CommercialStaffAssignment[]> {
  await requireAccess(READ_ACCESS)

  try {
    const rows = await db
      .select({
        assignmentId: campaignAssignments.id,
        staffId: campaignAssignments.staffId,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        cedula: staffMembers.cedula,
        assignedAt: campaignAssignments.assignedAt,
      })
      .from(campaignAssignments)
      .innerJoin(staffMembers, eq(campaignAssignments.staffId, staffMembers.id))
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
          // Filtra al área comercial — la tabla `campaign_assignments` ahora
          // alberga tanto banco_sangre como comercial; cada panel ve solo su área.
          eq(staffMembers.area, 'comercial'),
        ),
      )
      .orderBy(asc(staffMembers.lastName))

    return rows
  } catch (error) {
    rethrowOrLog(
      error,
      'getAssignedCommercialStaff',
      'Error al obtener operativos comerciales asignados',
    )
  }
}

/**
 * Asigna operativos comerciales a una campaña. Mismo patrón que `assignStaff`
 * (UPSERT con `onConflictDoUpdate` para reactivar filas soft-deleted; recálculo
 * fire-and-forget al finalizar).
 */
export async function assignCommercialStaff(
  data: AssignCommercialStaffInput,
): Promise<void> {
  const { userId } = await requireAccess(COMMERCIAL_ASSIGN_ACCESS)

  const validated = assignCommercialStaffSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { campaignId, staffIds } = validated.data

  try {
    // Defensa profunda: cada staffId debe pertenecer a area='comercial' y
    // staffProfile='comercial'. Bloquea intentos de inyectar staff de otra
    // área vía el endpoint comercial.
    const staffRows = await db
      .select({
        id: staffMembers.id,
        area: staffMembers.area,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(inArray(staffMembers.id, staffIds))
    const byId = new Map(staffRows.map((s) => [s.id, s]))
    for (const id of staffIds) {
      const s = byId.get(id)
      if (!s) throw new NotFoundError(`Colaborador ${id} no encontrado`)
      if (s.area !== 'comercial' || s.staffProfile !== 'comercial') {
        throw new ValidationError(
          'Solo se pueden asignar operativos comerciales (área comercial + perfil comercial).',
        )
      }
    }

    // Si ya están asignados activamente, no hay que tocar nada.
    const existing = await db
      .select({ staffId: campaignAssignments.staffId })
      .from(campaignAssignments)
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
          inArray(campaignAssignments.staffId, staffIds),
        ),
      )
    const existingIds = new Set(existing.map((e) => e.staffId))
    const newIds = staffIds.filter((id) => !existingIds.has(id))

    if (newIds.length === 0) return

    await db
      .insert(campaignAssignments)
      .values(newIds.map((staffId) => ({ campaignId, staffId })))
      .onConflictDoUpdate({
        target: [campaignAssignments.campaignId, campaignAssignments.staffId],
        set: {
          isActive: true,
          removedAt: null,
          assignedAt: new Date(),
        },
      })

    await recalcAggregatesForCampaign(campaignId, newIds, 'assignCommercialStaff')

    await logAudit({
      profileId: userId,
      action: 'create',
      tableName: 'campaign_assignments',
      recordId: campaignId,
      newData: { commercialStaffIds: newIds },
    })

    revalidatePath(`/campanas/${campaignId}`)
  } catch (error) {
    rethrowOrLog(
      error,
      'assignCommercialStaff',
      'Error al asignar operativos comerciales a la campaña',
    )
  }
}

/**
 * Soft-delete de una asignación comercial. Recalcula el balance del operativo.
 */
export async function removeCommercialAssignment(
  assignmentId: string,
): Promise<void> {
  const { userId } = await requireAccess(COMMERCIAL_ASSIGN_ACCESS)

  try {
    const [updated] = await db
      .update(campaignAssignments)
      .set({ isActive: false, removedAt: new Date() })
      .where(eq(campaignAssignments.id, assignmentId))
      .returning()

    if (!updated) {
      throw new NotFoundError('Asignación no encontrada')
    }

    await recalcAggregatesForCampaign(updated.campaignId, updated.staffId, 'removeCommercialAssignment')

    await logAudit({
      profileId: userId,
      action: 'delete',
      tableName: 'campaign_assignments',
      recordId: assignmentId,
    })

    revalidatePath(`/campanas/${updated.campaignId}`)
  } catch (error) {
    rethrowOrLog(
      error,
      'removeCommercialAssignment',
      'Error al remover la asignación comercial',
    )
  }
}
