'use server'

import { eq, isNull, and, asc, sql } from 'drizzle-orm'
import { ConflictError, NotFoundError, PermissionError, ValidationError } from '@/lib/errors/app-errors'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { profiles, type Profile } from '@/lib/db/schema/profiles'
import { staffMembers, type StaffMember } from '@/lib/db/schema/staff-members'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAccess } from '@/features/auth/lib/require-access'
import type { Role } from '@/types/roles'
import { getAllowedRolesForCaller } from '@/features/users/lib/allowed-roles'
import { logAudit } from '@/lib/audit/log-audit'
import {
  createUserSchema,
  linkUserToStaffSchema,
  unlinkUserFromStaffSchema,
  resetUserPasswordSchema,
  deactivateUserSchema,
  updateUserRoleSchema,
  type CreateUserInput,
  type LinkUserToStaffInput,
  type UnlinkUserFromStaffInput,
  type ResetUserPasswordInput,
  type DeactivateUserInput,
  type UpdateUserRoleInput,
} from '../schemas/user-schemas'

export interface UserRow {
  profile: Profile
  staffMember: StaffMember | null
}

const REVALIDATE_PATH = '/usuarios'

/**
 * Permisos de gestión de usuarios:
 * - `admin` (super admin global): ve y gestiona todos los usuarios (todas áreas).
 * - `admin_area`: ve y gestiona solo usuarios de SU misma área (operativos y
 *   otros admin_area). NO ve super admins ni usuarios de otras áreas.
 */
const USERS_MANAGEMENT_ACCESS: { roles: Role[] } = { roles: ['admin', 'admin_area'] }

/**
 * Lanza PermissionError si el caller (admin_area) intenta gestionar a un
 * usuario que NO pertenece a su área. Admin global pasa siempre.
 */
async function assertCanManageUser(
  scope: { kind: 'global' } | { kind: 'area'; area: 'banco_sangre' | 'comercial' | 'logistica' },
  targetProfileId: string,
): Promise<Profile> {
  const [target] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, targetProfileId))
    .limit(1)
  if (!target) throw new NotFoundError('Usuario no encontrado')
  if (scope.kind === 'global') return target
  // admin_area: el target debe pertenecer a la misma área (area=null o
  // distinta queda fuera de su scope).
  if (target.area !== scope.area) {
    throw new PermissionError('No puedes gestionar usuarios de otra área.')
  }
  return target
}

export async function listUsers(): Promise<UserRow[]> {
  const { scope } = await requireAccess(USERS_MANAGEMENT_ACCESS)

  const where = scope.kind === 'area' ? eq(profiles.area, scope.area) : undefined

  const rows = await db
    .select({
      profile: profiles,
      staffMember: staffMembers,
    })
    .from(profiles)
    .leftJoin(staffMembers, eq(staffMembers.profileId, profiles.id))
    .where(where)
    .orderBy(asc(profiles.fullName))

  return rows.map((r) => ({ profile: r.profile, staffMember: r.staffMember ?? null }))
}

export async function listUnlinkedStaff(): Promise<StaffMember[]> {
  const { scope } = await requireAccess(USERS_MANAGEMENT_ACCESS)

  const conditions = [isNull(staffMembers.profileId), eq(staffMembers.isActive, true)]
  if (scope.kind === 'area') {
    conditions.push(eq(staffMembers.area, scope.area))
  }

  return db
    .select()
    .from(staffMembers)
    .where(and(...conditions))
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))
}

export async function createUser(data: CreateUserInput): Promise<{ profileId: string }> {
  const { userId: adminId, role: callerRole, area: callerArea, scope } =
    await requireAccess(USERS_MANAGEMENT_ACCESS)

  const parsed = createUserSchema.safeParse(data)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message)
  }
  const input = parsed.data

  // Defensa profunda contra payloads manipulados: el rol pedido debe estar
  // permitido según el caller. Para admin_area: solo 'admin_area' u 'operativo'
  // (dar credenciales a su staff). Para admin global: cualquier rol.
  const allowedRoles = getAllowedRolesForCaller(callerRole, callerArea)
  if (!allowedRoles.includes(input.role)) {
    throw new PermissionError('No puedes asignar ese rol.')
  }

  // admin_area: el usuario creado siempre pertenece a su propia área.
  if (scope.kind === 'area') {
    if (input.area !== scope.area) {
      throw new PermissionError('Solo puedes crear usuarios de tu propia área.')
    }
  }

  if (input.staffMemberId) {
    const [target] = await db
      .select({
        id: staffMembers.id,
        profileId: staffMembers.profileId,
        isActive: staffMembers.isActive,
        area: staffMembers.area,
      })
      .from(staffMembers)
      .where(eq(staffMembers.id, input.staffMemberId))
      .limit(1)

    if (!target) throw new NotFoundError('Personal seleccionado no encontrado')
    if (!target.isActive) throw new ValidationError('El personal seleccionado está inactivo')
    if (target.profileId) throw new ValidationError('Este personal ya tiene credenciales de acceso')
    // Para admin_area: el staff vinculado también debe ser de su área.
    if (scope.kind === 'area' && target.area !== scope.area) {
      throw new PermissionError(
        'El personal vinculado debe pertenecer a tu misma área.',
      )
    }
  }

  // Validación server-side: rechazar emails ya registrados antes de tocar
  // Supabase Auth, porque algunas configuraciones del proyecto permiten
  // duplicados a nivel de auth.users.
  const normalizedEmail = input.email.trim().toLowerCase()

  // Auto-vínculo por correo: si el caller no especificó `staffMemberId` y el
  // rol no es admin (que va sin staff), busca un staff_member activo y sin
  // credenciales cuyo email coincida. Si lo encuentra, vincula automáticamente.
  // Evita la doble entrada manual del admin: crear personal y luego volver a
  // teclear el correo al darle credenciales.
  let effectiveStaffMemberId = input.staffMemberId ?? null
  if (!effectiveStaffMemberId && input.role !== 'admin') {
    const [matchByEmail] = await db
      .select({ id: staffMembers.id, profileId: staffMembers.profileId })
      .from(staffMembers)
      .where(
        and(
          sql`lower(${staffMembers.email}) = ${normalizedEmail}`,
          eq(staffMembers.isActive, true),
        ),
      )
      .limit(1)
    if (matchByEmail && !matchByEmail.profileId) {
      effectiveStaffMemberId = matchByEmail.id
    }
  }
  const [emailConflict] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(${profiles.email}) = ${normalizedEmail}`)
    .limit(1)

  if (emailConflict) {
    throw new ConflictError('Ya existe una cuenta con ese correo electrónico')
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  })

  if (authError || !authData?.user) {
    const msg = authError?.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('registered')) {
      throw new ConflictError('Ya existe una cuenta con ese correo electrónico')
    }
    throw new Error(`Error al crear el usuario de autenticación: ${authError?.message ?? 'usuario nulo'}`)
  }

  const authUserId = authData.user.id

  try {
    // Admin global queda con area=NULL; resto requiere área explícita.
    const areaValue = input.role === 'admin' ? null : input.area ?? null

    await db
      .insert(profiles)
      .values({
        id: authUserId,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        area: areaValue,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          area: areaValue,
        },
      })

    if (effectiveStaffMemberId) {
      await db
        .update(staffMembers)
        .set({ profileId: authUserId, updatedAt: new Date() })
        .where(eq(staffMembers.id, effectiveStaffMemberId))

      await logAudit({
        profileId: adminId,
        action: 'update',
        tableName: 'staff_members',
        recordId: effectiveStaffMemberId,
        newData: {
          profileId: authUserId,
          // Marca si la vinculación fue automática por matching de correo
          // (vs. selección explícita del admin).
          autoLinkedByEmail: !input.staffMemberId,
        },
      })
    }

    await logAudit({
      profileId: adminId,
      action: 'create',
      tableName: 'profiles',
      recordId: authUserId,
      newData: {
        email: input.email,
        role: input.role,
        area: areaValue,
        staffMemberId: effectiveStaffMemberId,
      },
    })

    revalidatePath(REVALIDATE_PATH)
    return { profileId: authUserId }
  } catch (dbError) {
    console.error('[createUser] profile insert failed, rolling back auth user', authUserId, dbError)
    await supabaseAdmin.auth.admin.deleteUser(authUserId).catch((rollbackErr) =>
      console.error('[createUser] orphaned auth user; manual cleanup required', authUserId, rollbackErr),
    )
    throw new Error('No se pudo crear el usuario. Revisa los logs e intenta nuevamente.')
  }
}

export async function linkUserToStaff(data: LinkUserToStaffInput): Promise<void> {
  const { userId: adminId, scope } = await requireAccess(USERS_MANAGEMENT_ACCESS)

  const parsed = linkUserToStaffSchema.safeParse(data)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { profileId, staffMemberId } = parsed.data

  // El target user debe estar en el área del caller (admin global pasa).
  await assertCanManageUser(scope, profileId)

  const [existingLink] = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(eq(staffMembers.profileId, profileId))
    .limit(1)
  if (existingLink) throw new ValidationError('Este usuario ya está vinculado a un colaborador')

  const [target] = await db
    .select({ id: staffMembers.id, profileId: staffMembers.profileId, area: staffMembers.area })
    .from(staffMembers)
    .where(eq(staffMembers.id, staffMemberId))
    .limit(1)
  if (!target) throw new NotFoundError('Personal no encontrado')
  if (target.profileId) throw new ValidationError('Este personal ya tiene credenciales de acceso')
  if (scope.kind === 'area' && target.area !== scope.area) {
    throw new PermissionError('El personal a vincular debe pertenecer a tu misma área.')
  }

  await db
    .update(staffMembers)
    .set({ profileId, updatedAt: new Date() })
    .where(eq(staffMembers.id, staffMemberId))

  await logAudit({
    profileId: adminId,
    action: 'update',
    tableName: 'staff_members',
    recordId: staffMemberId,
    newData: { profileId },
  })

  revalidatePath(REVALIDATE_PATH)
}

export async function unlinkUserFromStaff(data: UnlinkUserFromStaffInput): Promise<void> {
  const { userId: adminId, scope } = await requireAccess(USERS_MANAGEMENT_ACCESS)

  const parsed = unlinkUserFromStaffSchema.safeParse(data)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { staffMemberId } = parsed.data

  if (scope.kind === 'area') {
    const [target] = await db
      .select({ area: staffMembers.area })
      .from(staffMembers)
      .where(eq(staffMembers.id, staffMemberId))
      .limit(1)
    if (!target) throw new NotFoundError('Personal no encontrado')
    if (target.area !== scope.area) {
      throw new PermissionError('No puedes desvincular personal de otra área.')
    }
  }

  await db
    .update(staffMembers)
    .set({ profileId: null, updatedAt: new Date() })
    .where(eq(staffMembers.id, staffMemberId))

  await logAudit({
    profileId: adminId,
    action: 'update',
    tableName: 'staff_members',
    recordId: staffMemberId,
    newData: { profileId: null },
  })

  revalidatePath(REVALIDATE_PATH)
}

export async function resetUserPassword(data: ResetUserPasswordInput): Promise<void> {
  const { userId: adminId, scope } = await requireAccess(USERS_MANAGEMENT_ACCESS)

  const parsed = resetUserPasswordSchema.safeParse(data)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { profileId, newPassword } = parsed.data

  await assertCanManageUser(scope, profileId)

  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
    password: newPassword,
  })

  if (error) {
    throw new Error(`Error al actualizar la contraseña: ${error.message}`)
  }

  await logAudit({
    profileId: adminId,
    action: 'update',
    tableName: 'profiles',
    recordId: profileId,
    newData: { passwordReset: true },
  })

  revalidatePath(REVALIDATE_PATH)
}

export async function deactivateUser(data: DeactivateUserInput): Promise<void> {
  const { userId: adminId, scope } = await requireAccess(USERS_MANAGEMENT_ACCESS)

  const parsed = deactivateUserSchema.safeParse(data)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { profileId } = parsed.data

  if (profileId === adminId) {
    throw new ValidationError('No puedes desactivar tu propia cuenta')
  }

  await assertCanManageUser(scope, profileId)

  await db
    .update(profiles)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(profiles.id, profileId))

  await logAudit({
    profileId: adminId,
    action: 'update',
    tableName: 'profiles',
    recordId: profileId,
    newData: { isActive: false },
  })

  revalidatePath(REVALIDATE_PATH)
}

export async function activateUser(data: DeactivateUserInput): Promise<void> {
  const { userId: adminId, scope } = await requireAccess(USERS_MANAGEMENT_ACCESS)

  const parsed = deactivateUserSchema.safeParse(data)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { profileId } = parsed.data

  await assertCanManageUser(scope, profileId)

  await db
    .update(profiles)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(profiles.id, profileId))

  await logAudit({
    profileId: adminId,
    action: 'update',
    tableName: 'profiles',
    recordId: profileId,
    newData: { isActive: true },
  })

  revalidatePath(REVALIDATE_PATH)
}

export async function deleteUser(data: DeactivateUserInput): Promise<void> {
  const { userId: adminId, scope } = await requireAccess(USERS_MANAGEMENT_ACCESS)

  const parsed = deactivateUserSchema.safeParse(data)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { profileId } = parsed.data

  if (profileId === adminId) {
    throw new ValidationError('No puedes eliminar tu propia cuenta')
  }

  const target = await assertCanManageUser(scope, profileId)

  await db.delete(profiles).where(eq(profiles.id, profileId))

  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin.auth.admin.deleteUser(profileId)
  if (error) {
    // Loggeamos el error completo solo server-side; no se propaga al cliente.
    console.error('[deleteUser] auth.admin.deleteUser failed', { profileId, error })
  }

  await logAudit({
    profileId: adminId,
    action: 'delete',
    tableName: 'profiles',
    recordId: profileId,
    oldData: { email: target.email },
  })

  revalidatePath(REVALIDATE_PATH)
}

export async function updateUserRole(data: UpdateUserRoleInput): Promise<void> {
  const { userId: adminId, role: callerRole, area: callerArea, scope } =
    await requireAccess(USERS_MANAGEMENT_ACCESS)

  const parsed = updateUserRoleSchema.safeParse(data)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { profileId, role, area } = parsed.data
  const areaValue = role === 'admin' ? null : area ?? null

  await assertCanManageUser(scope, profileId)

  // Defensa profunda: el rol asignado debe estar permitido según el caller.
  const allowedRoles = getAllowedRolesForCaller(callerRole, callerArea)
  if (!allowedRoles.includes(role)) {
    throw new PermissionError('No puedes asignar ese rol.')
  }

  if (scope.kind === 'area' && areaValue !== scope.area) {
    throw new PermissionError('Solo puedes asignar usuarios a tu propia área.')
  }

  await db
    .update(profiles)
    .set({ role, area: areaValue, updatedAt: new Date() })
    .where(eq(profiles.id, profileId))

  await logAudit({
    profileId: adminId,
    action: 'update',
    tableName: 'profiles',
    recordId: profileId,
    newData: { role, area: areaValue },
  })

  revalidatePath(REVALIDATE_PATH)
}
