'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireAccess } from '@/features/auth/lib/require-access'
import { logAudit } from '@/lib/audit/log-audit'
import { NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import { isCoordinatorEligible } from '@/features/staff/lib/constants'
import { recalcAggregatesForCampaign } from '@/features/hours/lib/aggregate-staff-data'
import { assignStaffSchema, setCoordinatorSchema } from '../schemas/assignment-schemas'
import type { AssignStaffInput, SetCoordinatorInput } from '../schemas/assignment-schemas'

// ---- Types ----------------------------------------------------------------

export interface AssignedStaffMember {
  assignmentId: string
  staffId: string
  firstName: string
  lastName: string
  cedula: string
  staffProfile: 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar'
  isCoordinator: boolean
  assignedAt: Date
}

export interface AvailableStaffMember {
  id: string
  firstName: string
  lastName: string
  staffProfile: 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar'
}

// ---- Actions --------------------------------------------------------------

export async function getAssignedStaff(
  campaignId: string,
): Promise<AssignedStaffMember[]> {
  await requireAccess({ roles: ['admin', 'admin_area', 'comercial'] })

  try {
    const rows = await db
      .select({
        assignmentId: campaignAssignments.id,
        staffId: campaignAssignments.staffId,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        cedula: staffMembers.cedula,
        staffProfile: staffMembers.staffProfile,
        isCoordinator: campaignAssignments.isCoordinator,
        assignedAt: campaignAssignments.assignedAt,
      })
      .from(campaignAssignments)
      .leftJoin(staffMembers, eq(campaignAssignments.staffId, staffMembers.id))
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
          // Filtra solo staff de banco_sangre — el panel comercial tiene su
          // propio endpoint (`getAssignedCommercialStaff`).
          eq(staffMembers.area, 'banco_sangre'),
        ),
      )
      .orderBy(desc(campaignAssignments.isCoordinator), asc(staffMembers.lastName))

    return rows as AssignedStaffMember[]
  } catch (error) {
    rethrowOrLog(error, 'getAssignedStaff', 'Error al obtener el personal asignado')
  }
}

export async function getAvailableStaff(
  campaignId: string,
): Promise<AvailableStaffMember[]> {
  await requireAccess({ roles: ['admin', 'admin_area', 'comercial'] })

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

    const allStaff = await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.isActive, true),
          // Solo staff de banco_sangre. Comercial y logística (conductor) se
          // gestionan por sus propios flujos.
          eq(staffMembers.area, 'banco_sangre'),
        ),
      )
      .orderBy(asc(staffMembers.staffProfile), asc(staffMembers.lastName))

    return allStaff.filter((s) => !assignedIds.has(s.id)) as AvailableStaffMember[]
  } catch (error) {
    rethrowOrLog(error, 'getAvailableStaff', 'Error al obtener el personal disponible')
  }
}

export async function assignStaff(data: AssignStaffInput): Promise<void> {
  const { userId } = await requireAccess({
    roles: ['admin', 'admin_area'],
    areas: ['banco_sangre'],
  })

  const validated = assignStaffSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { campaignId, staffIds } = validated.data

  try {
    // Defensa profunda: aunque el caller pasó `requireAccess(areas:['banco_sangre'])`,
    // verificamos que CADA staffId del payload pertenezca al área banco_sangre.
    // Esto evita que un cliente malicioso intente "colar" un staff de logística/comercial.
    const staffRows = await db
      .select({ id: staffMembers.id, area: staffMembers.area })
      .from(staffMembers)
      .where(inArray(staffMembers.id, staffIds))
    const byId = new Map(staffRows.map((s) => [s.id, s.area]))
    for (const id of staffIds) {
      const area = byId.get(id)
      if (!area) throw new NotFoundError(`Colaborador ${id} no encontrado`)
      if (area !== 'banco_sangre') {
        throw new ValidationError(
          'Solo se puede asignar personal del área banco_sangre. Para operativos comerciales o conductores usa los paneles correspondientes.',
        )
      }
    }

    // Quita los que ya estén asignados activamente. Para los demás usamos UPSERT
    // porque la tabla tiene UNIQUE(campaign_id, staff_id) y puede haber filas
    // marcadas isActive=false de remociones previas que bloquearían el INSERT.
    const existing = await db
      .select({ staffId: campaignAssignments.staffId })
      .from(campaignAssignments)
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
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

    // Recalcular agregados — fire-and-forget con log estructurado (helper
    // centralizado). Fallos individuales no rollbackean la asignación; el
    // cron `recalc-aggregates` reintenta cada noche.
    await recalcAggregatesForCampaign(campaignId, newIds, 'assignStaff')

    await logAudit({
      profileId: userId,
      action: 'create',
      tableName: 'campaign_assignments',
      recordId: campaignId,
      newData: { staffIds: newIds },
    })

    revalidatePath(`/campanas/${campaignId}`)
  } catch (error) {
    rethrowOrLog(error, 'assignStaff', 'Error al asignar personal a la campaña')
  }
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  const { userId } = await requireAccess({
    roles: ['admin', 'admin_area'],
    areas: ['banco_sangre'],
  })

  try {
    const [updated] = await db
      .update(campaignAssignments)
      .set({ isActive: false, removedAt: new Date() })
      .where(eq(campaignAssignments.id, assignmentId))
      .returning()

    if (!updated) {
      throw new NotFoundError('Asignacion no encontrada')
    }

    await recalcAggregatesForCampaign(updated.campaignId, updated.staffId, 'removeAssignment')

    await logAudit({
      profileId: userId,
      action: 'delete',
      tableName: 'campaign_assignments',
      recordId: assignmentId,
    })

    revalidatePath(`/campanas/${updated.campaignId}`)
  } catch (error) {
    rethrowOrLog(error, 'removeAssignment', 'Error al remover la asignacion')
  }
}

export async function setCoordinator(data: SetCoordinatorInput): Promise<void> {
  const { userId } = await requireAccess({
    roles: ['admin', 'admin_area'],
    areas: ['banco_sangre'],
  })

  const validated = setCoordinatorSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { campaignId, staffId } = validated.data

  try {
    const assignments = await db
      .select({
        staffId: campaignAssignments.staffId,
        isCoordinator: campaignAssignments.isCoordinator,
      })
      .from(campaignAssignments)
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
        ),
      )

    const target = assignments.find((a) => a.staffId === staffId)
    if (!target) {
      throw new NotFoundError('El colaborador no está asignado a esta campaña')
    }

    if (target.isCoordinator) return

    // Solo bacteriólogos o técnicos pueden ser coordinadores de campaña.
    // El coordinador es responsable de la línea de tiempo real y reporte de
    // horas ejecutadas.
    const [targetStaff] = await db
      .select({
        area: staffMembers.area,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(eq(staffMembers.id, staffId))
      .limit(1)
    if (!targetStaff) {
      throw new NotFoundError('Colaborador no encontrado')
    }
    if (
      targetStaff.area !== 'banco_sangre' ||
      !isCoordinatorEligible(targetStaff.staffProfile)
    ) {
      throw new ValidationError(
        'Solo bacteriólogos o técnicos del banco de sangre pueden ser coordinadores de campaña.',
      )
    }

    const previousCoordinator = assignments.find(
      (a) => a.isCoordinator && a.staffId !== staffId,
    )

    await db.transaction(async (tx) => {
      if (previousCoordinator) {
        await tx
          .update(campaignAssignments)
          .set({ isCoordinator: false })
          .where(
            and(
              eq(campaignAssignments.campaignId, campaignId),
              eq(campaignAssignments.staffId, previousCoordinator.staffId),
              eq(campaignAssignments.isActive, true),
            ),
          )
      }

      await tx
        .update(campaignAssignments)
        .set({ isCoordinator: true })
        .where(
          and(
            eq(campaignAssignments.campaignId, campaignId),
            eq(campaignAssignments.staffId, staffId),
            eq(campaignAssignments.isActive, true),
          ),
        )
    })

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'campaign_assignments',
      recordId: campaignId,
      oldData: previousCoordinator
        ? { coordinatorStaffId: previousCoordinator.staffId }
        : { coordinatorStaffId: null },
      newData: { coordinatorStaffId: staffId },
    })

    revalidatePath(`/campanas/${campaignId}`)
  } catch (error) {
    rethrowOrLog(error, 'setCoordinator', 'Error al designar coordinador')
  }
}
