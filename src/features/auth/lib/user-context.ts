import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { parseRole, type Role } from '@/types/roles'
import { parseArea, type Area } from '@/types/areas'
import { AuthError } from '@/lib/errors/app-errors'

export interface UserContext {
  userId: string
  role: Role
  /** Área del usuario. NULL para admin global (super-admin cross-área). */
  area: Area | null
  /** staffMembers.id si el perfil está vinculado a un colaborador (operativo). */
  staffId: string | null
  email: string
  fullName: string
}

/**
 * Resuelve el contexto del usuario autenticado actual. Memoizado por request
 * vía React `cache()` para evitar múltiples lookups en una misma render.
 *
 * Retorna null si no hay sesión válida o si el perfil no existe.
 */
export const getCurrentUserContext = cache(async (): Promise<UserContext | null> => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const [profile] = await db
    .select({
      role: profiles.role,
      area: profiles.area,
      email: profiles.email,
      fullName: profiles.fullName,
      isActive: profiles.isActive,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1)
  if (!profile) return null
  if (!profile.isActive) return null

  const role = parseRole(profile.role)
  if (!role) return null

  const area = parseArea(profile.area)

  // staffId: opcional. Si el perfil está vinculado a un staff_member (típicamente
  // operativos), lo cargamos para que `mi-agenda` y rutas similares lo usen.
  const [staffLink] = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(eq(staffMembers.profileId, user.id))
    .limit(1)

  return {
    userId: user.id,
    role,
    area,
    staffId: staffLink?.id ?? null,
    email: profile.email,
    fullName: profile.fullName,
  }
})

/**
 * Igual que `getCurrentUserContext()` pero lanza si no hay sesión válida.
 * Útil en server actions y pages que ya requieren autenticación.
 */
export async function requireUserContext(): Promise<UserContext> {
  const ctx = await getCurrentUserContext()
  if (!ctx) {
    throw new AuthError()
  }
  return ctx
}
