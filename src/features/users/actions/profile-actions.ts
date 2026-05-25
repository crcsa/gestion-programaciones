'use server'

import { createClient } from '@supabase/supabase-js'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema/profiles'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireUserContext } from '@/features/auth/lib/user-context'
import { logAudit } from '@/lib/audit/log-audit'
import { ValidationError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import {
  updateMyProfileSchema,
  changeMyPasswordSchema,
  type UpdateMyProfileInput,
  type ChangeMyPasswordInput,
} from '../schemas/profile-schemas'

/**
 * Actualiza el nombre y/o correo del usuario actual (self-service).
 * El correo se cambia de inmediato (service-role, email_confirm) y se sincroniza
 * `profiles.email`. No permite tocar rol/área (eso es admin-only).
 */
export async function updateMyProfile(data: UpdateMyProfileInput): Promise<void> {
  const ctx = await requireUserContext()

  const parsed = updateMyProfileSchema.safeParse(data)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { fullName, email } = parsed.data

  try {
    const emailChanged = email.toLowerCase() !== ctx.email.toLowerCase()

    if (emailChanged) {
      const supabaseAdmin = getSupabaseAdmin()
      const { error } = await supabaseAdmin.auth.admin.updateUserById(ctx.userId, {
        email,
        email_confirm: true,
      })
      if (error) {
        const msg = /already.*registered|exists|duplicate/i.test(error.message)
          ? 'Ese correo ya está en uso por otra cuenta'
          : `No se pudo actualizar el correo: ${error.message}`
        throw new ValidationError(msg)
      }
    }

    await db
      .update(profiles)
      .set({ fullName, email, updatedAt: new Date() })
      .where(eq(profiles.id, ctx.userId))

    await logAudit({
      profileId: ctx.userId,
      action: 'update',
      tableName: 'profiles',
      recordId: ctx.userId,
      newData: { fullName, emailChanged },
    })

    revalidatePath('/mi-perfil')
  } catch (error) {
    rethrowOrLog(error, 'updateMyProfile', 'No se pudo actualizar el perfil')
  }
}

/**
 * Cambia la contraseña del usuario actual verificando primero la actual.
 * La verificación usa un cliente Supabase efímero (sin persistir sesión) para no
 * rotar los tokens de la sesión vigente; el cambio real va por service-role.
 */
export async function changeMyPassword(data: ChangeMyPasswordInput): Promise<void> {
  const ctx = await requireUserContext()

  const parsed = changeMyPasswordSchema.safeParse(data)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { currentPassword, newPassword } = parsed.data

  try {
    // 1. Verificar la contraseña actual sin tocar la sesión vigente.
    const verifier = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: ctx.email,
      password: currentPassword,
    })
    if (verifyError) {
      throw new ValidationError('La contraseña actual es incorrecta')
    }

    // 2. Cambiar la contraseña vía service-role.
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.auth.admin.updateUserById(ctx.userId, {
      password: newPassword,
    })
    if (error) {
      throw new Error(`No se pudo cambiar la contraseña: ${error.message}`)
    }

    await logAudit({
      profileId: ctx.userId,
      action: 'update',
      tableName: 'profiles',
      recordId: ctx.userId,
      newData: { passwordChanged: true },
    })
  } catch (error) {
    rethrowOrLog(error, 'changeMyPassword', 'No se pudo cambiar la contraseña')
  }
}
