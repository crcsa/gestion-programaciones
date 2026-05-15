'use server'

import { eq, ilike, and, or, sql, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { db } from '@/lib/db'
import { staffMembers, staffTrainingAreas } from '@/lib/db/schema/staff-members'
import { trainingAreas } from '@/lib/db/schema/training-areas'
import { requireAccess } from '@/features/auth/lib/require-access'
import { assertSameArea } from '@/features/auth/lib/assert-same-area'
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import { logAudit } from '@/lib/audit/log-audit'
import { createStaffSchema, updateStaffSchema } from '../schemas/staff-schemas'
import type { CreateStaffInput, UpdateStaffInput } from '../schemas/staff-schemas'
import type { StaffMember } from '@/lib/db/schema/staff-members'
import type { TrainingArea } from '@/lib/db/schema/training-areas'
import type { Area } from '@/types/areas'
import { AREA_LABELS } from '@/types/areas'
import type { Role } from '@/types/roles'
import {
  ALLOWED_PROFILES_BY_AREA,
  getStaffProfileLabel,
  isProfileAllowedForArea,
  type StaffProfile,
} from '@/features/staff/lib/constants'
import type {
  StaffListFilters,
  StaffListRow,
  StaffListResult,
} from './staff-types'

// ---- Actions ---------------------------------------------------------------

export async function getStaffList(filters: StaffListFilters = {}): Promise<StaffListResult> {
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })

  const { search, perfil, estado, page = 1, limit = 20 } = filters
  // Admin (scope global) respeta el filtro recibido; admin de área queda
  // anclado a su scope.area. El cliente nunca puede saltarse el scoping.
  const areaScope: Area | null =
    scope.kind === 'global' ? filters.area ?? null : scope.area
  const offset = (page - 1) * limit

  try {
    const conditions = buildListConditions(search, perfil, estado, areaScope)

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
    rethrowOrLog(error, 'getStaffList', 'Error al obtener la lista de colaboradores')
  }
}

/**
 * Lanza si el caller no puede tocar el staff con `staffId`. Admin global pasa
 * siempre; banco_sangre solo si su área coincide con la del staff.
 */
async function ensureCallerCanEditStaff(
  ctx: { role: Role; area: Area | null },
  staffId: string,
): Promise<void> {
  if (ctx.role === 'admin') return
  const [staff] = await db
    .select({ area: staffMembers.area })
    .from(staffMembers)
    .where(eq(staffMembers.id, staffId))
    .limit(1)
  if (!staff) throw new NotFoundError('Colaborador no encontrado')
  assertSameArea(ctx, staff.area, 'personal')
}

function buildListConditions(
  search: string | undefined,
  perfil: StaffListFilters['perfil'],
  estado: StaffListFilters['estado'],
  area: Area | null,
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

  if (area) {
    parts.push(eq(staffMembers.area, area))
  }

  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return and(...(parts as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]))
}

export async function getStaffById(id: string): Promise<StaffMember & { trainingAreaIds: string[] }> {
  await requireAccess({ roles: ['admin', 'admin_area'] })

  try {
    const [staff] = await db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.id, id))
      .limit(1)

    if (!staff) {
      throw new NotFoundError('Colaborador no encontrado')
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
    rethrowOrLog(error, 'getStaffById', 'Error al obtener el colaborador')
  }
}

export async function getTrainingAreas(): Promise<TrainingArea[]> {
  await requireAccess({ roles: ['admin', 'admin_area'] })

  try {
    return await db
      .select()
      .from(trainingAreas)
      .where(eq(trainingAreas.isActive, true))
      .orderBy(trainingAreas.name)
  } catch (error) {
    rethrowOrLog(error, 'getTrainingAreas', 'Error al obtener las areas de entrenamiento')
  }
}

export async function createStaff(data: CreateStaffInput): Promise<StaffMember> {
  const { userId, scope } = await requireAccess({ roles: ['admin', 'admin_area'] })

  const validated = createStaffSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const input = validated.data

  // Admin global usa el área del input (default banco_sangre); admin de área
  // queda anclado a su scope.area.
  const targetArea: Area =
    scope.kind === 'global' ? input.area ?? 'banco_sangre' : scope.area

  // Cross-field profile×area: el schema ya valida cuando ambos vienen en el
  // input, pero `targetArea` puede divergir del `input.area` (admin de área
  // sobrescribe). Re-validamos con la combinación final efectiva.
  if (!isProfileAllowedForArea(input.staffProfile, targetArea)) {
    const allowed = ALLOWED_PROFILES_BY_AREA[targetArea]
      .map((p) => getStaffProfileLabel(p))
      .join(', ')
    throw new ValidationError(
      `El perfil "${getStaffProfileLabel(input.staffProfile)}" no es válido para el área "${AREA_LABELS[targetArea]}". Permitidos: ${allowed}.`,
    )
  }

  try {
    const existing = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(eq(staffMembers.cedula, input.cedula))
      .limit(1)

    if (existing.length > 0) {
      throw new ConflictError('Ya existe un colaborador con esa cedula')
    }

    // NO se crea auth user ni profile en este flujo. El colaborador queda
    // como personal "Sin acceso" hasta que el admin le cree credenciales
    // explícitamente desde /usuarios. Si en ese momento el correo coincide
    // con `staff_members.email`, `createUser` vincula automáticamente
    // (vía `staffMemberId` que recibe del modal).
    const [created] = await db
      .insert(staffMembers)
      .values({
        profileId: null,
        firstName: input.firstName,
        lastName: input.lastName,
        cedula: input.cedula,
        phone: input.phone || null,
        email: input.email,
        staffProfile: input.staffProfile,
        area: targetArea,
        weeklyHours: input.weeklyHours,
        hireDate: input.hireDate || null,
        notes: input.notes || null,
      })
      .returning()

    if (input.trainingAreaIds && input.trainingAreaIds.length > 0) {
      await db.insert(staffTrainingAreas).values(
        input.trainingAreaIds.map((trainingAreaId) => ({ staffId: created.id, trainingAreaId }))
      )
    }

    await logAudit({
      profileId: userId,
      action: 'create',
      tableName: 'staff_members',
      recordId: created.id,
      newData: { cedula: created.cedula, staffProfile: created.staffProfile, area: created.area },
    })

    revalidatePath('/personal')
    revalidatePath('/usuarios')
    return created
  } catch (error) {
    rethrowOrLog(error, 'createStaff', 'Error al crear el colaborador')
  }
}

export async function updateStaff(id: string, data: Omit<UpdateStaffInput, 'id'>): Promise<StaffMember> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })
  const { userId, scope } = ctx

  const validated = updateStaffSchema.safeParse({ id, ...data })
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { id: _id, trainingAreaIds, ...fields } = validated.data

  // Verifica que el caller pueda tocar este staff (misma area).
  await ensureCallerCanEditStaff(ctx, id)

  // Admin de área no puede mover personal entre áreas; admin global sí.
  if (scope.kind === 'area' && fields.area && fields.area !== scope.area) {
    throw new ValidationError('No puedes mover personal entre áreas.')
  }

  // Si el update toca staffProfile o area, validar la combinación final
  // (puede divergir del schema cuando solo viene uno de los dos campos).
  if (fields.staffProfile !== undefined || fields.area !== undefined) {
    const [existing] = await db
      .select({ area: staffMembers.area, staffProfile: staffMembers.staffProfile })
      .from(staffMembers)
      .where(eq(staffMembers.id, id))
      .limit(1)
    if (!existing) throw new NotFoundError('Colaborador no encontrado')

    const finalArea: Area = fields.area ?? existing.area
    // El enum DB aún incluye 'coordinador' (legacy). Si una row antigua lo
    // tuviera, forzamos a re-elegir un perfil válido.
    const dbProfile = (fields.staffProfile ?? existing.staffProfile) as string
    if (dbProfile === 'coordinador' || !isProfileAllowedForArea(dbProfile as StaffProfile, finalArea)) {
      const allowed = ALLOWED_PROFILES_BY_AREA[finalArea]
        .map((p) => getStaffProfileLabel(p))
        .join(', ')
      throw new ValidationError(
        `El perfil "${getStaffProfileLabel(dbProfile)}" no es válido para el área "${AREA_LABELS[finalArea]}". Permitidos: ${allowed}.`,
      )
    }
  }

  try {
    if (fields.cedula) {
      const existing = await db
        .select({ id: staffMembers.id })
        .from(staffMembers)
        .where(and(eq(staffMembers.cedula, fields.cedula), sql`${staffMembers.id} != ${id}`))
        .limit(1)

      if (existing.length > 0) {
        throw new ConflictError('Ya existe otro colaborador con esa cedula')
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
      throw new NotFoundError('Colaborador no encontrado')
    }

    if (trainingAreaIds !== undefined) {
      await db.delete(staffTrainingAreas).where(eq(staffTrainingAreas.staffId, id))
      if (trainingAreaIds.length > 0) {
        await db.insert(staffTrainingAreas).values(
          trainingAreaIds.map((trainingAreaId) => ({ staffId: id, trainingAreaId }))
        )
      }
    }

    await logAudit({
      profileId: userId,
      action: 'update',
      tableName: 'staff_members',
      recordId: updated.id,
    })

    revalidatePath('/personal')
    revalidatePath(`/personal/${id}`)
    return updated
  } catch (error) {
    rethrowOrLog(error, 'updateStaff', 'Error al actualizar el colaborador')
  }
}

export async function deleteStaff(id: string): Promise<void> {
  const { userId } = await requireAccess({ roles: ['admin'] })

  try {
    const [staff] = await db
      .select({ id: staffMembers.id, profileId: staffMembers.profileId })
      .from(staffMembers)
      .where(eq(staffMembers.id, id))
      .limit(1)

    if (!staff) {
      throw new NotFoundError('Colaborador no encontrado')
    }

    // ORDEN CRÍTICO: borramos el usuario Auth ANTES que el staff_member.
    // Si Auth falla, abortamos sin tocar la DB — el usuario sigue podiendo
    // loguearse pero al menos no quedó un staff_member huérfano. El patrón
    // inverso (DB primero, Auth con fire-and-forget) dejaba usuarios capaces
    // de loguear sin staff_member en DB tras un fallo de Supabase Auth.
    if (staff.profileId) {
      const supabaseAdmin = getSupabaseAdmin()
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(staff.profileId)
      if (authError) {
        console.error('[deleteStaff] auth.admin.deleteUser failed', staff.profileId, authError)
        throw new ConflictError('No se pudo borrar el usuario asociado. Intenta de nuevo.')
      }
    }

    await db.delete(staffTrainingAreas).where(eq(staffTrainingAreas.staffId, id))
    await db.delete(staffMembers).where(eq(staffMembers.id, id))

    await logAudit({
      profileId: userId,
      action: 'delete',
      tableName: 'staff_members',
      recordId: id,
    })

    revalidatePath('/personal')
  } catch (error) {
    rethrowOrLog(error, 'deleteStaff', 'Error al eliminar el colaborador')
  }
}

export async function toggleStaffStatus(id: string): Promise<StaffMember> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })
  await ensureCallerCanEditStaff(ctx, id)

  try {
    const [current] = await db
      .select({ id: staffMembers.id, isActive: staffMembers.isActive })
      .from(staffMembers)
      .where(eq(staffMembers.id, id))
      .limit(1)

    if (!current) {
      throw new NotFoundError('Colaborador no encontrado')
    }

    const [updated] = await db
      .update(staffMembers)
      .set({ isActive: !current.isActive, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning()

    revalidatePath('/personal')
    return updated
  } catch (error) {
    rethrowOrLog(error, 'toggleStaffStatus', 'Error al cambiar el estado del colaborador')
  }
}

export async function updateTrainingAreas(staffId: string, areaIds: string[]): Promise<void> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })
  await ensureCallerCanEditStaff(ctx, staffId)

  try {
    await db
      .delete(staffTrainingAreas)
      .where(eq(staffTrainingAreas.staffId, staffId))

    if (areaIds.length === 0) return

    await db.insert(staffTrainingAreas).values(
      areaIds.map((trainingAreaId) => ({ staffId, trainingAreaId }))
    )
  } catch (error) {
    rethrowOrLog(error, 'updateTrainingAreas', 'Error al actualizar las areas de entrenamiento')
  }
}

// ---- Excel import -----------------------------------------------------------

export interface ImportStaffRow {
  cedula: string
  firstName: string
  lastName: string
  staffProfile: 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar' | 'comercial'
  contractType?: 'indefinido' | 'fijo' | 'prestacion_servicios' | 'aprendizaje'
  phone?: string
  email?: string
  hireDate?: string
}

export interface ImportStaffResult {
  imported: number
  skipped: number
  errors: { row: number; cedula: string; reason: string }[]
}

export async function importStaffFromExcel(
  rows: ImportStaffRow[],
): Promise<ImportStaffResult> {
  const ctx = await requireAccess({ roles: ['admin', 'admin_area'] })

  const result: ImportStaffResult = { imported: 0, skipped: 0, errors: [] }
  const cfg = await loadValidationRuntimeConfig()

  const validProfiles = ['bacteriologo', 'tecnico', 'medico', 'auxiliar', 'comercial']

  // Admin global no podría inferir un área para un importer en bloque sin
  // intervención manual — exigimos que el bulk lo ejecute un admin de área.
  // El área del staff insertado se fuerza a la del caller para evitar fugas
  // entre áreas vía importador.
  const targetArea: Area = ctx.area ?? 'banco_sangre'

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2 // Excel row (1 = header)

    if (!raw.cedula || raw.cedula.length < 5) {
      result.errors.push({
        row: rowNum,
        cedula: raw.cedula ?? `fila ${rowNum}`,
        reason: 'Cedula invalida (minimo 5 caracteres)',
      })
      continue
    }
    if (!raw.firstName || raw.firstName.length < 2) {
      result.errors.push({
        row: rowNum,
        cedula: raw.cedula,
        reason: 'Nombres invalido (minimo 2 caracteres)',
      })
      continue
    }
    if (!raw.lastName || raw.lastName.length < 2) {
      result.errors.push({
        row: rowNum,
        cedula: raw.cedula,
        reason: 'Apellidos invalido (minimo 2 caracteres)',
      })
      continue
    }
    if (!validProfiles.includes(raw.staffProfile)) {
      result.errors.push({
        row: rowNum,
        cedula: raw.cedula,
        reason: `Perfil invalido: ${raw.staffProfile}`,
      })
      continue
    }
    // Cross-field profile×area: rechaza filas cuyo perfil no aplique al
    // área del caller. Cubre 'conductor' (solo logistica), 'comercial' (solo
    // comercial), y perfiles de banco que no aplican a otras áreas.
    if (!isProfileAllowedForArea(raw.staffProfile, targetArea)) {
      const allowed = ALLOWED_PROFILES_BY_AREA[targetArea]
        .map((p) => getStaffProfileLabel(p))
        .join(', ')
      result.errors.push({
        row: rowNum,
        cedula: raw.cedula,
        reason: `Perfil "${getStaffProfileLabel(raw.staffProfile)}" no permitido en área "${AREA_LABELS[targetArea]}". Permitidos: ${allowed}.`,
      })
      continue
    }

    try {
      const existing = await db
        .select({ id: staffMembers.id })
        .from(staffMembers)
        .where(eq(staffMembers.cedula, raw.cedula))
        .limit(1)

      if (existing.length > 0) {
        result.skipped++
        continue
      }

      await db.insert(staffMembers).values({
        firstName: raw.firstName,
        lastName: raw.lastName,
        cedula: raw.cedula,
        staffProfile: raw.staffProfile,
        area: targetArea,
        contractType: raw.contractType ?? null,
        phone: raw.phone ?? null,
        email: raw.email ?? null,
        hireDate: raw.hireDate ?? null,
        weeklyHours: cfg.weeklyHours,
      })

      result.imported++
    } catch (error) {
      console.error('[importStaffFromExcel] row', rowNum, error)
      // Solo exponemos mensajes de AppError (validaciones de negocio); para
      // errores de DB/Drizzle damos un mensaje genérico que no filtra nombres
      // de schema/constraint.
      const reason = error instanceof AppError
        ? error.message
        : 'Error al guardar en la base de datos (revisa los logs del servidor).'
      result.errors.push({
        row: rowNum,
        cedula: raw.cedula,
        reason,
      })
    }
  }

  return result
}
