'use server'

import { eq, and, or, ilike, sql, asc, desc, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staffMembers, staffTrainingAreas, trainingAreas, auditLog } from '@/lib/db/schema'
import type { ActionResult, PaginatedResult } from '@/types/api'
import {
  createStaffSchema,
  updateStaffSchema,
  staffFilterSchema,
  type CreateStaffInput,
  type UpdateStaffInput,
  type StaffFilterInput,
} from '../schemas/staff-schemas'

type StaffMember = typeof staffMembers.$inferSelect
type StaffWithAreas = StaffMember & {
  trainingAreas: Array<{ id: string; code: string; name: string }>
}

async function logAudit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  oldData: unknown,
  newData: unknown,
) {
  await db.insert(auditLog).values({
    userId,
    action,
    entityType,
    entityId,
    oldData: oldData as Record<string, unknown>,
    newData: newData as Record<string, unknown>,
  })
}

export async function getStaffMembers(
  input: StaffFilterInput,
): Promise<ActionResult<PaginatedResult<StaffWithAreas>>> {
  const parsed = staffFilterSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Parámetros de filtrado inválidos' }
  }

  const { page, limit, search, profileType, isActive, trainingAreaId, sortBy, sortDirection } =
    parsed.data
  const offset = (page - 1) * limit

  try {
    const conditions = []

    if (search) {
      conditions.push(
        or(
          ilike(staffMembers.firstName, `%${search}%`),
          ilike(staffMembers.lastName, `%${search}%`),
          ilike(staffMembers.documentNumber, `%${search}%`),
        ),
      )
    }

    if (profileType) {
      conditions.push(eq(staffMembers.profileType, profileType))
    }

    if (isActive !== undefined) {
      conditions.push(eq(staffMembers.isActive, isActive))
    }

    if (trainingAreaId) {
      const staffWithArea = db
        .select({ staffId: staffTrainingAreas.staffId })
        .from(staffTrainingAreas)
        .where(eq(staffTrainingAreas.trainingAreaId, trainingAreaId))

      conditions.push(sql`${staffMembers.id} IN (${staffWithArea})`)
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const orderColumn = {
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      documentNumber: staffMembers.documentNumber,
      profileType: staffMembers.profileType,
      createdAt: staffMembers.createdAt,
    }[sortBy]

    const orderFn = sortDirection === 'desc' ? desc : asc

    const [staffList, totalResult] = await Promise.all([
      db
        .select()
        .from(staffMembers)
        .where(whereClause)
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(staffMembers).where(whereClause),
    ])

    const total = totalResult[0].total

    const staffWithAreas: StaffWithAreas[] = await Promise.all(
      staffList.map(async (staff) => {
        const areas = await db
          .select({
            id: trainingAreas.id,
            code: trainingAreas.code,
            name: trainingAreas.name,
          })
          .from(staffTrainingAreas)
          .innerJoin(trainingAreas, eq(staffTrainingAreas.trainingAreaId, trainingAreas.id))
          .where(eq(staffTrainingAreas.staffId, staff.id))

        return { ...staff, trainingAreas: areas }
      }),
    )

    return {
      success: true,
      data: {
        data: staffWithAreas,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    }
  } catch (error) {
    console.error('Failed to fetch staff members:', error)
    return { success: false, error: 'Error al obtener personal' }
  }
}

export async function getStaffById(id: string): Promise<ActionResult<StaffWithAreas>> {
  try {
    const staff = await db.query.staffMembers.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    })

    if (!staff) {
      return { success: false, error: 'Personal no encontrado' }
    }

    const areas = await db
      .select({
        id: trainingAreas.id,
        code: trainingAreas.code,
        name: trainingAreas.name,
      })
      .from(staffTrainingAreas)
      .innerJoin(trainingAreas, eq(staffTrainingAreas.trainingAreaId, trainingAreas.id))
      .where(eq(staffTrainingAreas.staffId, id))

    return { success: true, data: { ...staff, trainingAreas: areas } }
  } catch (error) {
    console.error('Failed to fetch staff member:', error)
    return { success: false, error: 'Error al obtener personal' }
  }
}

export async function createStaff(
  input: CreateStaffInput,
): Promise<ActionResult<StaffMember>> {
  const parsed = createStaffSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { trainingAreaIds, ...staffData } = parsed.data

  try {
    const existing = await db.query.staffMembers.findFirst({
      where: (table, { eq }) => eq(table.documentNumber, staffData.documentNumber),
    })

    if (existing) {
      return { success: false, error: 'Ya existe un registro con ese número de documento' }
    }

    const [created] = await db.insert(staffMembers).values(staffData).returning()

    if (trainingAreaIds && trainingAreaIds.length > 0) {
      await db.insert(staffTrainingAreas).values(
        trainingAreaIds.map((areaId) => ({
          staffId: created.id,
          trainingAreaId: areaId,
        })),
      )
    }

    await logAudit(null, 'CREATE', 'staff_members', created.id, null, created)

    return { success: true, data: created }
  } catch (error) {
    console.error('Failed to create staff member:', error)
    return { success: false, error: 'Error al crear personal' }
  }
}

export async function updateStaff(
  input: UpdateStaffInput,
): Promise<ActionResult<StaffMember>> {
  const parsed = updateStaffSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { id, trainingAreaIds, ...staffData } = parsed.data

  try {
    const existing = await db.query.staffMembers.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    })

    if (!existing) {
      return { success: false, error: 'Personal no encontrado' }
    }

    if (staffData.documentNumber && staffData.documentNumber !== existing.documentNumber) {
      const duplicate = await db.query.staffMembers.findFirst({
        where: (table, { eq, and, ne }) =>
          and(eq(table.documentNumber, staffData.documentNumber!), ne(table.id, id)),
      })

      if (duplicate) {
        return { success: false, error: 'Ya existe un registro con ese número de documento' }
      }
    }

    const [updated] = await db
      .update(staffMembers)
      .set({ ...staffData, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning()

    if (trainingAreaIds !== undefined) {
      await db
        .delete(staffTrainingAreas)
        .where(eq(staffTrainingAreas.staffId, id))

      if (trainingAreaIds.length > 0) {
        await db.insert(staffTrainingAreas).values(
          trainingAreaIds.map((areaId) => ({
            staffId: id,
            trainingAreaId: areaId,
          })),
        )
      }
    }

    await logAudit(null, 'UPDATE', 'staff_members', id, existing, updated)

    return { success: true, data: updated }
  } catch (error) {
    console.error('Failed to update staff member:', error)
    return { success: false, error: 'Error al actualizar personal' }
  }
}

export async function toggleStaffStatus(id: string): Promise<ActionResult<StaffMember>> {
  try {
    const existing = await db.query.staffMembers.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    })

    if (!existing) {
      return { success: false, error: 'Personal no encontrado' }
    }

    const [updated] = await db
      .update(staffMembers)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning()

    await logAudit(null, 'TOGGLE_STATUS', 'staff_members', id, existing, updated)

    return { success: true, data: updated }
  } catch (error) {
    console.error('Failed to toggle staff status:', error)
    return { success: false, error: 'Error al cambiar estado del personal' }
  }
}
