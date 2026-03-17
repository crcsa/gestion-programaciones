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
