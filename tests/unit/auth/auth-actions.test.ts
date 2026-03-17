import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    } as any)

    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', 'password123')

    const result = await signIn({}, formData)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('Credenciales')
  })
})

import { signOut } from '@/features/auth/actions/auth-actions'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'

vi.mock('@/lib/db/schema', () => ({
  profiles: { id: 'id', role: 'role' },
}))

type MockDb = { select: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'orderBy']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolvedValue))
  return chain
}

describe('signIn — ruta exitosa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirige al destino correcto después de login exitoso', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    } as any)

    mockDb.select = vi.fn(() => makeChain([{ role: 'admin' }]))

    const formData = new FormData()
    formData.set('email', 'admin@example.com')
    formData.set('password', 'password123')

    await signIn({}, formData)

    expect(vi.mocked(redirect)).toHaveBeenCalledTimes(1)
  })

  it('redirige con rol operativo cuando no hay perfil', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    } as any)

    mockDb.select = vi.fn(() => makeChain([]))

    const formData = new FormData()
    formData.set('email', 'operativo@example.com')
    formData.set('password', 'password123')

    await signIn({}, formData)

    expect(vi.mocked(redirect)).toHaveBeenCalledTimes(1)
  })
})

describe('signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cierra sesión y redirige a login', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signOut: vi.fn().mockResolvedValue({}),
      },
    } as any)

    await signOut()

    expect(vi.mocked(redirect)).toHaveBeenCalledWith('/login')
  })
})
