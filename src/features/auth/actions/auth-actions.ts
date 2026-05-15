'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRole } from '@/types/roles'
import { ROLE_DEFAULT_ROUTES } from '@/lib/utils/constants'
import type { LoginState } from './auth-types'

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'La contrasena debe tener al menos 6 caracteres'),
})

export async function signIn(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }
  }

  // Verificamos que el profile exista y esté activo ANTES de redirigir.
  // Si está desactivado, el middleware redirige a /login → loop infinito
  // visible en el cliente como "Ingresando..." colgado.
  //
  // IMPORTANTE: usamos Supabase REST (vía supabase-js) en vez de Drizzle.
  // El cliente postgres-js usa un pool con `max=5`; si el pool está saturado
  // (típico en dev tras varios HMR), la query se cuelga indefinidamente y
  // el login se queda en "Ingresando...". El path crítico de auth no debe
  // depender del pool DB.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    await supabase.auth.signOut()
    return {
      error: 'Tu cuenta no tiene un perfil asociado. Contacta al administrador.',
    }
  }

  if (!profile.is_active) {
    await supabase.auth.signOut()
    return {
      error: 'Tu cuenta está desactivada. Contacta al administrador.',
    }
  }

  const role = parseRole(profile.role) ?? 'operativo'
  const destination = ROLE_DEFAULT_ROUTES[role]

  // NO usamos `revalidatePath` antes del redirect: en Next 16, combinarlos en
  // un Server Action invocado vía `useActionState` puede dejar el formulario
  // colgado en "Ingresando..." (race con la navegación). El redirect mismo
  // dispara la navegación que renderiza la ruta nueva.
  redirect(destination)
}

/**
 * Limpia la sesión de Supabase (cookies). NO hace `redirect()` aquí: cuando
 * esta action se invoca desde un onClick (vs. un `<form action>`), el throw
 * del redirect no siempre propaga al cliente — el menú se cierra
 * sincrónicamente y se queda el dashboard montado con cookies vacías,
 * provocando que el próximo login parezca colgado mientras los componentes
 * viejos siguen revalidando con sesión inválida.
 *
 * El caller (típicamente el topbar) navega con `router.replace('/login')` +
 * `router.refresh()` después de `await signOut()`.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
