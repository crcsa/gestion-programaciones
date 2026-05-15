import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { createClient as createClientType } from '@/lib/supabase/server'

type MockClient = Awaited<ReturnType<typeof createClientType>>

// Mock Supabase and DB
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { signIn } from '@/features/auth/actions/auth-actions'
import { createClient } from '@/lib/supabase/server'

describe('signIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error for invalid email', async () => {
    const formData = new FormData()
    formData.set('email', 'not-an-email')
    formData.set('password', 'password123')

    const result = await signIn({}, formData)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('Email')
  })

  it('returns error for short password', async () => {
    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', '123')

    const result = await signIn({}, formData)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('contrasena')
  })

  it('returns error when Supabase auth fails', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Invalid credentials'),
        }),
      },
    } as unknown as MockClient)

    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', 'password123')

    const result = await signIn({}, formData)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('Credenciales')
  })
})

import { signOut } from '@/features/auth/actions/auth-actions'
import { redirect } from 'next/navigation'

vi.mock('@/lib/db/schema', () => ({
  profiles: { id: 'id', role: 'role' },
}))

// `db` se mockea arriba para que los imports del action no exploten, pero el
// camino crítico de auth NO usa Drizzle — el lookup de profile va por Supabase
// REST. Por eso no necesitamos un mockDb/makeChain helper.

// Construye un mock de supabase-js para `supabase.from('profiles').select().eq().single()`.
// Acepta el resultado que retornará `single()`.
function makeSupabaseClient(opts: {
  signInResult: { data: { user: { id: string } | null }; error: Error | null }
  profileResult: { data: { role?: string; is_active?: boolean } | null; error: Error | null }
  signOutMock?: ReturnType<typeof vi.fn>
}): MockClient {
  const single = vi.fn().mockResolvedValue(opts.profileResult)
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue(opts.signInResult),
      signOut: opts.signOutMock ?? vi.fn().mockResolvedValue({ error: null }),
    },
    from,
  } as unknown as MockClient
}

describe('signIn — ruta exitosa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirige al destino correcto después de login exitoso con perfil activo', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({
        signInResult: { data: { user: { id: 'user-123' } }, error: null },
        profileResult: { data: { role: 'admin', is_active: true }, error: null },
      }),
    )

    const formData = new FormData()
    formData.set('email', 'admin@example.com')
    formData.set('password', 'password123')

    await signIn({}, formData)

    expect(vi.mocked(redirect)).toHaveBeenCalledTimes(1)
  })

  it('rechaza login si no existe perfil asociado (cuenta huérfana)', async () => {
    const signOutMock = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({
        signInResult: { data: { user: { id: 'user-123' } }, error: null },
        profileResult: { data: null, error: new Error('not found') },
        signOutMock,
      }),
    )

    const formData = new FormData()
    formData.set('email', 'huerfano@example.com')
    formData.set('password', 'password123')

    const result = await signIn({}, formData)

    expect(result.error).toMatch(/perfil asociado/)
    expect(signOutMock).toHaveBeenCalled()
    expect(vi.mocked(redirect)).not.toHaveBeenCalled()
  })

  it('rechaza login si el perfil está desactivado', async () => {
    const signOutMock = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({
        signInResult: { data: { user: { id: 'user-123' } }, error: null },
        profileResult: { data: { role: 'admin', is_active: false }, error: null },
        signOutMock,
      }),
    )

    const formData = new FormData()
    formData.set('email', 'inactivo@example.com')
    formData.set('password', 'password123')

    const result = await signIn({}, formData)

    expect(result.error).toMatch(/desactivada/)
    expect(signOutMock).toHaveBeenCalled()
    expect(vi.mocked(redirect)).not.toHaveBeenCalled()
  })
})

describe('signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cierra sesión sin redirigir (la navegación la hace el caller)', async () => {
    const signOutSpy = vi.fn().mockResolvedValue({})
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signOut: signOutSpy,
      },
    } as unknown as MockClient)

    await signOut()

    // La server action ya NO llama redirect(): el caller (topbar) navega
    // con router.replace + router.refresh para garantizar que el dashboard
    // se desmonte antes de que /login renderice.
    expect(signOutSpy).toHaveBeenCalled()
    expect(vi.mocked(redirect)).not.toHaveBeenCalled()
  })
})
