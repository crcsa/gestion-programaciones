'use server'

import { eq, ilike, and, or, sql, inArray } from 'drizzle-orm'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { db } from '@/lib/db'
import { staffMembers, staffTrainingAreas } from '@/lib/db/schema/staff-members'
import { trainingAreas } from '@/lib/db/schema/training-areas'
import { profiles } from '@/lib/db/schema/profiles'
import { requireRole } from '@/features/auth/lib/require-role'
import { createStaffSchema, updateStaffSchema } from '../schemas/staff-schemas'
import type { CreateStaffInput, UpdateStaffInput } from '../schemas/staff-schemas'
import type { StaffMember } from '@/lib/db/schema/staff-members'
import type { TrainingArea } from '@/lib/db/schema/training-areas'

// ---- Types ----------------------------------------------------------------

export interface StaffListFilters {
  search?: string
  perfil?: 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar' | 'coordinador'
  estado?: 'activo' | 'inactivo'
  page?: number
  limit?: number
}

export type StaffListRow = StaffMember & { trainingAreaNames: string[]; trainingAreaIds: string[] }

export interface StaffListResult {
  data: StaffListRow[]
  total: number
}

// ---- Helpers ---------------------------------------------------------------

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ---- Actions ---------------------------------------------------------------

export async function getStaffList(filters: StaffListFilters = {}): Promise<StaffListResult> {
  await requireRole(['admin', 'banco_sangre'])

  const { search, perfil, estado, page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  try {
    const conditions = buildListConditions(search, perfil, estado)

    const [rows, countRows] = await Promise.all([
      db.select().from(staffMembers).where(conditions ?? undefined).limit(limit).offset(offset).orderBy(staffMembers.lastName),
      db.select({ count: sql<number>`count(*)::int` }).from(staffMembers).where(conditions ?? undefined),
    ])

    const total = countRows[0]?.count ?? 0

    const staffIds = rows.map((r) => r.id)
    const areaRows = staffIds.length > 0
      ? await db
          .select({ staffId: staffTrainingAreas.staffId, trainingAreaId: staffTrainingAreas.trainingAreaId, name: trainingAreas.name })
          .from(staffTrainingAreas)
          .leftJoin(trainingAreas, eq(staffTrainingAreas.trainingAreaId, trainingAreas.id))
          .where(inArray(staffTrainingAreas.staffId, staffIds))
      : []

    const areaNameMap = areaRows.reduce<Record<string, string[]>>((acc, r) => {
      if (!r.name) return acc
      return { ...acc, [r.staffId]: [...(acc[r.staffId] ?? []), r.name] }
    }, {})

    const areaIdMap = areaRows.reduce<Record<string, string[]>>((acc, r) => {
      return { ...acc, [r.staffId]: [...(acc[r.staffId] ?? []), r.trainingAreaId] }
    }, {})

    const data: StaffListRow[] = rows.map((r) => ({
      ...r,
      trainingAreaNames: areaNameMap[r.id] ?? [],
      trainingAreaIds: areaIdMap[r.id] ?? [],
    }))

    return { data, total }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener la lista de funcionarios')
  }
}

function buildListConditions(
  search: string | undefined,
  perfil: StaffListFilters['perfil'],
  estado: StaffListFilters['estado']
) {
  const parts = []

  if (search) {
    parts.push(
      or(
        ilike(staffMembers.firstName, `%${search}%`),
        ilike(staffMembers.lastName, `%${search}%`),
        ilike(staffMembers.cedula, `%${search}%`)
      )
    )
  }

  if (perfil) {
    parts.push(eq(staffMembers.staffProfile, perfil))
  }

  if (estado === 'activo') {
    parts.push(eq(staffMembers.isActive, true))
  } else if (estado === 'inactivo') {
    parts.push(eq(staffMembers.isActive, false))
  }

  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return and(...(parts as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]))
}

export async function getStaffById(id: string): Promise<StaffMember & { trainingAreaIds: string[] }> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const [staff] = await db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.id, id))
      .limit(1)

    if (!staff) {
      throw new Error('Funcionario no encontrado')
    }

    const areaRows = await db
      .select({ trainingAreaId: staffTrainingAreas.trainingAreaId })
      .from(staffTrainingAreas)
      .where(eq(staffTrainingAreas.staffId, id))

    return {
      ...staff,
      trainingAreaIds: areaRows.map((r) => r.trainingAreaId),
    }
  } catch (error) {
    if (error instanceof Error && (
      error.message === 'Funcionario no encontrado' ||
      error.message.includes('permiso')
    )) {
      throw error
    }
    throw new Error('Error al obtener el funcionario')
  }
}

export async function getTrainingAreas(): Promise<TrainingArea[]> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    return await db
      .select()
      .from(trainingAreas)
      .where(eq(trainingAreas.isActive, true))
      .orderBy(trainingAreas.name)
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener las areas de entrenamiento')
  }
}

export async function createStaff(data: CreateStaffInput): Promise<StaffMember> {
  await requireRole(['admin', 'banco_sangre'])

  const validated = createStaffSchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const input = validated.data

  try {
    const existing = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(eq(staffMembers.cedula, input.cedula))
      .limit(1)

    if (existing.length > 0) {
      throw new Error('Ya existe un funcionario con esa cedula')
    }

    const supabaseAdmin = getSupabaseAdmin()
    const tempPassword = generateTempPassword()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      const isEmailTaken = authError?.message?.toLowerCase().includes('already been registered')
        || authError?.message?.toLowerCase().includes('already registered')
        || authError?.message?.toLowerCase().includes('email address is already')
      if (isEmailTaken) {
        throw new Error('Ya existe una cuenta de acceso con ese correo electrónico. Use un correo diferente.')
      }
      throw new Error(`Error al crear el usuario de autenticación: ${authError?.message ?? 'usuario nulo'}`)
    }

    const authUserId = authData.user.id

    try {
      await db.insert(profiles).values({
        id: authUserId,
        email: input.email,
        fullName: `${input.firstName} ${input.lastName}`,
        role: 'operativo',
      }).onConflictDoUpdate({
        target: profiles.id,
        set: {
          email: input.email,
          fullName: `${input.firstName} ${input.lastName}`,
          role: 'operativo',
        },
      })

      const [created] = await db
        .insert(staffMembers)
        .values({
          profileId: authUserId,
          firstName: input.firstName,
          lastName: input.lastName,
          cedula: input.cedula,
          phone: input.phone || null,
          email: input.email,
          staffProfile: input.staffProfile,
          contractType: input.contractType,
          weeklyHours: input.weeklyHours,
          defaultShift: input.defaultShift,
          hireDate: input.hireDate || null,
          notes: input.notes || null,
        })
        .returning()

      if (input.trainingAreaIds && input.trainingAreaIds.length > 0) {
        await db.insert(staffTrainingAreas).values(
          input.trainingAreaIds.map((trainingAreaId) => ({ staffId: created.id, trainingAreaId }))
        )
      }

      return created
    } catch (dbError) {
      // Rollback: delete the auth user so the email can be reused
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => null)
      throw new Error(`Error al guardar el funcionario en la base de datos: ${dbError instanceof Error ? dbError.message : String(dbError)}`)
    }
  } catch (error) {
    if (error instanceof Error && (
      error.message === 'Ya existe un funcionario con esa cedula' ||
      error.message.includes('Ya existe una cuenta') ||
      error.message.includes('permiso') ||
      error.message.includes('autenticaci') ||
      error.message.includes('base de datos')
    )) {
      throw error
    }
    throw new Error('Error al crear el funcionario')
  }
}

export async function updateStaff(id: string, data: Omit<UpdateStaffInput, 'id'>): Promise<StaffMember> {
  await requireRole(['admin', 'banco_sangre'])

  const validated = updateStaffSchema.safeParse({ id, ...data })
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const { id: _id, trainingAreaIds, ...fields } = validated.data

  try {
    if (fields.cedula) {
      const existing = await db
        .select({ id: staffMembers.id })
        .from(staffMembers)
        .where(and(eq(staffMembers.cedula, fields.cedula), sql`${staffMembers.id} != ${id}`))
        .limit(1)

      if (existing.length > 0) {
        throw new Error('Ya existe otro funcionario con esa cedula')
      }
    }

    const sanitized = {
      ...fields,
      phone: fields.phone || null,
      hireDate: fields.hireDate || null,
      notes: fields.notes || null,
    }

    const [updated] = await db
      .update(staffMembers)
      .set({ ...sanitized, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning()

    if (!updated) {
      throw new Error('Funcionario no encontrado')
    }

    if (trainingAreaIds !== undefined) {
      await db.delete(staffTrainingAreas).where(eq(staffTrainingAreas.staffId, id))
      if (trainingAreaIds.length > 0) {
        await db.insert(staffTrainingAreas).values(
          trainingAreaIds.map((trainingAreaId) => ({ staffId: id, trainingAreaId }))
        )
      }
    }

    return updated
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('cedula') ||
      error.message === 'Funcionario no encontrado' ||
      error.message.includes('permiso')
    )) {
      throw error
    }
    throw new Error('Error al actualizar el funcionario')
  }
}

export async function toggleStaffStatus(id: string): Promise<StaffMember> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const [current] = await db
      .select({ id: staffMembers.id, isActive: staffMembers.isActive })
      .from(staffMembers)
      .where(eq(staffMembers.id, id))
      .limit(1)

    if (!current) {
      throw new Error('Funcionario no encontrado')
    }

    const [updated] = await db
      .update(staffMembers)
      .set({ isActive: !current.isActive, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning()

    return updated
  } catch (error) {
    if (error instanceof Error && (
      error.message === 'Funcionario no encontrado' ||
      error.message.includes('permiso')
    )) {
      throw error
    }
    throw new Error('Error al cambiar el estado del funcionario')
  }
}

export async function updateTrainingAreas(staffId: string, areaIds: string[]): Promise<void> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    await db
      .delete(staffTrainingAreas)
      .where(eq(staffTrainingAreas.staffId, staffId))

    if (areaIds.length === 0) return

    await db.insert(staffTrainingAreas).values(
      areaIds.map((trainingAreaId) => ({ staffId, trainingAreaId }))
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al actualizar las areas de entrenamiento')
  }
}
