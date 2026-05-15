import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { createClient as createClientType } from '@/lib/supabase/server'

type MockClient = Awaited<ReturnType<typeof createClientType>>

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ role: 'admin', area: null, email: 'a@x.com', fullName: 'A', isActive: true }]),
        }),
      }),
    }),
  },
}))

import { requireRole } from '@/features/auth/lib/require-role'
import { createClient } from '@/lib/supabase/server'

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when user is not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        }),
      },
    } as unknown as MockClient)

    await expect(requireRole(['admin'])).rejects.toThrow('No autenticado')
  })

  it('returns userId and role when user has required role', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    } as unknown as MockClient)

    const result = await requireRole(['admin'])
    expect(result.userId).toBe('user-123')
    expect(result.role).toBe('admin')
  })
})
