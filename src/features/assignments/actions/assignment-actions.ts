'use server'

import { eq, and, desc, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireRole } from '@/features/auth/lib/require-role'
import { assignStaffSchema, setCoordinatorSchema } from '../schemas/assignment-schemas'
import type { AssignStaffInput, SetCoordinatorInput } from '../schemas/assignment-schemas'

// ---- Types ----------------------------------------------------------------

export interface AssignedStaffMember {
  assignmentId: string
  staffId: string
  firstName: string
  lastName: string
  staffProfile: 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar' | 'coordinador'
  isCoordinator: boolean
  assignedAt: Date
}

export interface AvailableStaffMember {
  id: string
  firstName: string
  lastName: string
  staffProfile: 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar' | 'coordinador'
}

// ---- Actions --------------------------------------------------------------

export async function getAssignedStaff(
  campaignId: string,
): Promise<AssignedStaffMember[]> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  try {
    const rows = await db
      .select({
        assignmentId: campaignAssignments.id,
        staffId: campaignAssignments.staffId,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
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
        ),
      )
      .orderBy(desc(campaignAssignments.isCoordinator), asc(staffMembers.lastName))

    return rows as AssignedStaffMember[]
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener el personal asignado')
  }
}

export async function getAvailableStaff(
  campaignId: string,
): Promise<AvailableStaffMember[]> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

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
      .where(eq(staffMembers.isActive, true))
      .orderBy(asc(staffMembers.staffProfile), asc(staffMembers.lastName))

    return allStaff.filter((s) => !assignedIds.has(s.id)) as AvailableStaffMember[]
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener el personal disponible')
  }
}

export async function assignStaff(data: AssignStaffInput): Promise<void> {
  await requireRole(['admin', 'banco_sangre'])

  const validated = assignStaffSchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const { campaignId, staffIds } = validated.data

  try {
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

    await db.insert(campaignAssignments).values(
      newIds.map((staffId) => ({
        campaignId,
        staffId,
      })),
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    if (error instanceof Error && error.message.includes('seleccionar')) throw error
    throw new Error('Error al asignar personal a la campaña')
  }
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const [updated] = await db
      .update(campaignAssignments)
      .set({ isActive: false, removedAt: new Date() })
      .where(eq(campaignAssignments.id, assignmentId))
      .returning()

    if (!updated) {
      throw new Error('Asignacion no encontrada')
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('permiso') ||
        error.message === 'Asignacion no encontrada')
    ) {
      throw error
    }
    throw new Error('Error al remover la asignacion')
  }
}

export async function setCoordinator(data: SetCoordinatorInput): Promise<void> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  const validated = setCoordinatorSchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const { campaignId, staffId } = validated.data

  try {
    const assignments = await db
      .select({ staffId: campaignAssignments.staffId })
      .from(campaignAssignments)
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
        ),
      )

    const isAssigned = assignments.some((a) => a.staffId === staffId)
    if (!isAssigned) {
      throw new Error('El funcionario no está asignado a esta campaña')
    }

    await db
      .update(campaignAssignments)
      .set({ isCoordinator: false })
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
        ),
      )

    await db
      .update(campaignAssignments)
      .set({ isCoordinator: true })
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.staffId, staffId),
          eq(campaignAssignments.isActive, true),
        ),
      )
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('permiso') ||
        error.message.includes('no está asignado'))
    ) {
      throw error
    }
    throw new Error('Error al designar coordinador')
  }
}
