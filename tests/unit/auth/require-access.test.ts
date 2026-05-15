import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { createClient as createClientType } from '@/lib/supabase/server'

type MockClient = Awaited<ReturnType<typeof createClientType>>

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Cada llamada a db.select() recibe una respuesta encolada en `selectQueue`.
// La primera lectura es el profile; la segunda (si ocurre) el staff link.
const selectQueue: unknown[][] = []

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
      }),
    })),
  },
}))

import { requireAccess } from '@/features/auth/lib/require-access'
import { createClient } from '@/lib/supabase/server'

function mockAuthenticated(userId = 'user-1') {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
  } as unknown as MockClient)
}

function queueProfile(role: string, area: string | null, isActive = true) {
  selectQueue.push([{ role, area, email: 'x@x.com', fullName: 'X', isActive }])
  // staff link query: vacía por defecto.
  selectQueue.push([])
}

describe('requireAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueue.length = 0
  })

  it('throws when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('nope'),
        }),
      },
    } as unknown as MockClient)
    await expect(requireAccess({ roles: ['admin'] })).rejects.toThrow('No autenticado')
  })

  it('admin global passes any role + any area requirement', async () => {
    mockAuthenticated()
    queueProfile('admin', null)
    const ctx = await requireAccess({ roles: ['admin'], areas: ['banco_sangre'] })
    expect(ctx.role).toBe('admin')
    expect(ctx.area).toBeNull()
  })

  it('banco_sangre with area=banco_sangre passes when areas=[banco_sangre]', async () => {
    mockAuthenticated()
    queueProfile('admin_area', 'banco_sangre')
    const ctx = await requireAccess({
      roles: ['admin_area', 'admin'],
      areas: ['banco_sangre'],
    })
    expect(ctx.area).toBe('banco_sangre')
  })

  it('banco_sangre with area=logistica is blocked when areas=[banco_sangre]', async () => {
    mockAuthenticated()
    queueProfile('admin_area', 'logistica')
    await expect(
      requireAccess({ roles: ['admin_area', 'admin'], areas: ['banco_sangre'] }),
    ).rejects.toThrow('No tienes permiso para esta area')
  })

  it('banco_sangre with area=logistica passes when areas=[logistica]', async () => {
    mockAuthenticated()
    queueProfile('admin_area', 'logistica')
    const ctx = await requireAccess({
      roles: ['admin_area', 'admin'],
      areas: ['logistica'],
    })
    expect(ctx.area).toBe('logistica')
  })

  it('comercial blocked from area=[banco_sangre] without allowCrossArea', async () => {
    mockAuthenticated()
    queueProfile('comercial', 'comercial')
    await expect(
      requireAccess({ roles: ['comercial'], areas: ['banco_sangre'] }),
    ).rejects.toThrow('No tienes permiso para esta area')
  })

  it('comercial passes with allowCrossArea when areas=[banco_sangre]', async () => {
    mockAuthenticated()
    queueProfile('comercial', 'comercial')
    const ctx = await requireAccess({
      roles: ['comercial', 'admin'],
      areas: ['banco_sangre'],
      allowCrossArea: true,
    })
    expect(ctx.role).toBe('comercial')
  })

  it('role not in allowed list is rejected', async () => {
    mockAuthenticated()
    queueProfile('operativo', 'banco_sangre')
    await expect(
      requireAccess({ roles: ['admin', 'admin_area'] }),
    ).rejects.toThrow('No tienes permiso')
  })

  it('passes when no areas requirement is specified', async () => {
    mockAuthenticated()
    queueProfile('admin_area', 'logistica')
    const ctx = await requireAccess({ roles: ['admin_area'] })
    expect(ctx.area).toBe('logistica')
  })

  it('requireOperationalArea rejects comercial', async () => {
    mockAuthenticated()
    queueProfile('comercial', 'comercial')
    await expect(
      requireAccess({
        roles: ['comercial', 'admin_area'],
        requireOperationalArea: true,
      }),
    ).rejects.toThrow('areas operativas')
  })

  it('requireOperationalArea accepts banco_sangre', async () => {
    mockAuthenticated()
    queueProfile('admin_area', 'banco_sangre')
    const ctx = await requireAccess({
      roles: ['admin_area'],
      requireOperationalArea: true,
    })
    expect(ctx.area).toBe('banco_sangre')
  })

  it('requireOperationalArea accepts logistica', async () => {
    mockAuthenticated()
    queueProfile('admin_area', 'logistica')
    const ctx = await requireAccess({
      roles: ['admin_area'],
      requireOperationalArea: true,
    })
    expect(ctx.area).toBe('logistica')
  })

  it('throws when profile is missing', async () => {
    mockAuthenticated()
    // No profile queued (empty array)
    selectQueue.push([])
    selectQueue.push([])
    await expect(requireAccess({ roles: ['admin'] })).rejects.toThrow('No autenticado')
  })
})
