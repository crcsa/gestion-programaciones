import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { Role } from '@/types/roles'

export async function requireRole(allowedRoles: Role[]): Promise<{ userId: string; role: Role }> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('No autenticado. Por favor inicia sesion.')
  }

  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1)

  if (!profile) {
    throw new Error('Perfil de usuario no encontrado.')
  }

  if (!allowedRoles.includes(profile.role as Role)) {
    throw new Error('No tienes permiso para realizar esta accion.')
  }

  return { userId: user.id, role: profile.role as Role }
}
