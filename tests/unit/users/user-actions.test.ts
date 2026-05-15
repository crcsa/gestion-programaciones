import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionError } from '@/lib/errors/app-errors'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { requireRoleMock, requireAccessMock, createUserMock, deleteUserMock, updateUserByIdMock } =
  vi.hoisted(() => ({
    requireRoleMock: vi.fn().mockResolvedValue({ userId: 'admin-id', role: 'admin' }),
    requireAccessMock: vi.fn().mockResolvedValue({
      userId: 'admin-id',
      role: 'admin',
      area: null,
      staffId: null,
      email: 'admin@x.com',
      fullName: 'Admin',
      scope: { kind: 'global' as const },
    }),
    createUserMock: vi
      .fn()
      .mockResolvedValue({ data: { user: { id: 'auth-user-id' } }, error: null }),
    deleteUserMock: vi.fn().mockResolvedValue({ error: null }),
    updateUserByIdMock: vi.fn().mockResolvedValue({ error: null }),
  }))

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: requireRoleMock,
}))

vi.mock('@/features/auth/lib/require-access', () => ({
  requireAccess: requireAccessMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    auth: {
      admin: {
        createUser: createUserMock,
        deleteUser: deleteUserMock,
        updateUserById: updateUserByIdMock,
      },
    },
  })),
}))

vi.mock('@/lib/db/schema/profiles', () => ({
  profiles: { id: 'id', email: 'email', fullName: 'full_name', role: 'role', isActive: 'is_active' },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    profileId: 'profile_id',
    isActive: 'is_active',
    firstName: 'first_name',
    lastName: 'last_name',
  },
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import {
  createUser,
  linkUserToStaff,
  unlinkUserFromStaff,
  resetUserPassword,
  listUsers,
  listUnlinkedStaff,
  deleteUser,
} from '@/features/users/actions/user-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'leftJoin',
    'insert',
    'values',
    'onConflictDoUpdate',
    'update',
    'set',
    'delete',
    'returning',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type SimpleMockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as SimpleMockDb

beforeEach(() => {
  vi.clearAllMocks()
  requireRoleMock.mockResolvedValue({ userId: 'admin-id', role: 'admin' })
  requireAccessMock.mockResolvedValue({
    userId: 'admin-id',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'admin@x.com',
    fullName: 'Admin',
    scope: { kind: 'global' as const },
  })
  createUserMock.mockResolvedValue({ data: { user: { id: 'auth-user-id' } }, error: null })
  updateUserByIdMock.mockResolvedValue({ error: null })
  deleteUserMock.mockResolvedValue({ error: null })
})

describe('createUser', () => {
  const adminInput = {
    email: 'admin@example.com',
    password: 'password123',
    fullName: 'Admin User',
    role: 'admin' as const,
    staffMemberId: null,
  }

  const operativoInput = {
    email: 'op@example.com',
    password: 'password123',
    fullName: 'Operativo User',
    role: 'operativo' as const,
    area: 'banco_sangre' as const,
    staffMemberId: '11111111-1111-4111-8111-111111111111',
  }

  it('crea admin sin staffMemberId', async () => {
    // Para admin solo hay 1 select (email conflict check), retorna vacío.
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.update = vi.fn(() => makeChain([]))

    const result = await createUser(adminInput)

    expect(result.profileId).toBe('auth-user-id')
    expect(createUserMock).toHaveBeenCalledWith({
      email: adminInput.email,
      password: adminInput.password,
      email_confirm: true,
    })
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('rechaza operativo sin staffMemberId', async () => {
    await expect(
      createUser({ ...operativoInput, staffMemberId: null }),
    ).rejects.toThrow(/Personal es obligatorio/)
  })

  it('crea operativo y vincula staff sin profileId', async () => {
    // Dos selects: 1ro staff lookup, 2do email conflict (vacío).
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) return makeChain([{ id: operativoInput.staffMemberId, profileId: null, isActive: true }])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.update = vi.fn(() => makeChain([]))

    const result = await createUser(operativoInput)
    expect(result.profileId).toBe('auth-user-id')
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('rechaza email ya registrado antes de tocar Supabase Auth', async () => {
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) return makeChain([{ id: operativoInput.staffMemberId, profileId: null, isActive: true }])
      return makeChain([{ id: 'existing-profile-id' }])
    })

    await expect(createUser(operativoInput)).rejects.toThrow(/Ya existe una cuenta con ese correo/)
    expect(createUserMock).not.toHaveBeenCalled()
  })

  it('rechaza staffMember ya vinculado', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: operativoInput.staffMemberId, profileId: 'someone-else', isActive: true }]))

    await expect(createUser(operativoInput)).rejects.toThrow(/ya tiene credenciales/)
    expect(createUserMock).not.toHaveBeenCalled()
  })

  it('rechaza staffMember inactivo', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: operativoInput.staffMemberId, profileId: null, isActive: false }]))

    await expect(createUser(operativoInput)).rejects.toThrow(/inactivo/)
  })

  it('rollback elimina auth user si falla insert de profile', async () => {
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) return makeChain([{ id: operativoInput.staffMemberId, profileId: null, isActive: true }])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => {
      const chain = makeChain([])
      chain.onConflictDoUpdate = vi.fn(() => Promise.reject(new Error('profile insert failed')))
      return chain
    })

    await expect(createUser(operativoInput)).rejects.toThrow(/No se pudo crear el usuario/)
    expect(deleteUserMock).toHaveBeenCalledWith('auth-user-id')
  })

  it('mapea error de email ya registrado en Supabase', async () => {
    mockDb.select = vi.fn(() => makeChain([])) // email check pasa
    createUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    })
    await expect(createUser(adminInput)).rejects.toThrow(/Ya existe una cuenta/)
  })

  it('requireAccess se invoca con admin', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain([]))
    await createUser(adminInput)
    expect(requireAccessMock).toHaveBeenCalledWith({ roles: ['admin', 'admin_area'] })
  })

  describe('admin_area scope', () => {
    function setAdminAreaScope(area: 'banco_sangre' | 'logistica' | 'comercial') {
      requireAccessMock.mockResolvedValue({
        userId: 'admin-id',
        role: 'admin_area',
        area,
        staffId: null,
        email: 'admin-area@x.com',
        fullName: 'Admin Area',
        scope: { kind: 'area' as const, area },
      })
    }

    it('admin_area+logistica crea operativo conductor de su misma área', async () => {
      setAdminAreaScope('logistica')
      const input = {
        email: 'driver@example.com',
        password: 'password123',
        fullName: 'Driver',
        role: 'operativo' as const,
        area: 'logistica' as const,
        staffMemberId: '11111111-1111-4111-8111-111111111111',
      }
      let call = 0
      mockDb.select = vi.fn(() => {
        call++
        if (call === 1) {
          return makeChain([
            { id: input.staffMemberId, profileId: null, isActive: true, area: 'logistica' },
          ])
        }
        return makeChain([])
      })
      mockDb.insert = vi.fn(() => makeChain([]))
      mockDb.update = vi.fn(() => makeChain([]))

      const result = await createUser(input)
      expect(result.profileId).toBe('auth-user-id')
    })

    it('admin_area no puede crear admin global', async () => {
      setAdminAreaScope('logistica')
      mockDb.select = vi.fn(() => makeChain([]))
      await expect(
        createUser({
          email: 'evil@example.com',
          password: 'password123',
          fullName: 'Evil',
          role: 'admin' as const,
          staffMemberId: null,
        }),
      ).rejects.toThrow(/No puedes asignar ese rol/)
    })

    it('admin_area no puede crear usuario de otra área', async () => {
      setAdminAreaScope('logistica')
      const input = {
        email: 'cross@example.com',
        password: 'password123',
        fullName: 'Cross',
        role: 'operativo' as const,
        area: 'banco_sangre' as const,
        staffMemberId: '11111111-1111-4111-8111-111111111111',
      }
      await expect(createUser(input)).rejects.toThrow(/tu propia área/)
    })

    it('admin_area no puede asignar rol comercial', async () => {
      setAdminAreaScope('comercial')
      const input = {
        email: 'sales@example.com',
        password: 'password123',
        fullName: 'Sales',
        role: 'comercial' as const,
        area: 'comercial' as const,
        staffMemberId: '11111111-1111-4111-8111-111111111111',
      }
      await expect(createUser(input)).rejects.toThrow(/No puedes asignar ese rol/)
    })
  })
})

describe('linkUserToStaff', () => {
  const input = {
    profileId: '22222222-2222-4222-8222-222222222222',
    staffMemberId: '33333333-3333-4333-8333-333333333333',
  }

  it('vincula correctamente', async () => {
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) return makeChain([{ id: input.profileId }])
      if (call === 2) return makeChain([])
      return makeChain([{ id: input.staffMemberId, profileId: null }])
    })
    mockDb.update = vi.fn(() => makeChain([]))

    await linkUserToStaff(input)
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('rechaza si el usuario no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await expect(linkUserToStaff(input)).rejects.toThrow(/Usuario no encontrado/)
  })

  it('rechaza si el staff ya tiene profileId', async () => {
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) return makeChain([{ id: input.profileId }])
      if (call === 2) return makeChain([])
      return makeChain([{ id: input.staffMemberId, profileId: 'other-profile' }])
    })

    await expect(linkUserToStaff(input)).rejects.toThrow(/ya tiene credenciales/)
  })
})

describe('unlinkUserFromStaff', () => {
  it('setea profileId a null', async () => {
    mockDb.update = vi.fn(() => makeChain([]))
    await unlinkUserFromStaff({ staffMemberId: '44444444-4444-4444-8444-444444444444' })
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })
})

describe('resetUserPassword', () => {
  it('llama auth.admin.updateUserById', async () => {
    await resetUserPassword({
      profileId: '55555555-5555-4555-8555-555555555555',
      newPassword: 'newpass1234',
    })
    expect(updateUserByIdMock).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      { password: 'newpass1234' },
    )
  })

  it('rechaza password muy corta', async () => {
    await expect(
      resetUserPassword({
        profileId: '55555555-5555-4555-8555-555555555555',
        newPassword: 'short',
      }),
    ).rejects.toThrow(/Mínimo 8/)
  })

  it('propaga error de supabase', async () => {
    updateUserByIdMock.mockResolvedValueOnce({ error: { message: 'auth failure' } })
    await expect(
      resetUserPassword({
        profileId: '55555555-5555-4555-8555-555555555555',
        newPassword: 'newpass1234',
      }),
    ).rejects.toThrow(/auth failure/)
  })
})

describe('deleteUser', () => {
  const targetId = '66666666-6666-4666-8666-666666666666'

  it('elimina profile y auth user', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: targetId, email: 'target@example.com' }]))
    mockDb.delete = vi.fn(() => makeChain([]))

    await deleteUser({ profileId: targetId })

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(deleteUserMock).toHaveBeenCalledWith(targetId)
  })

  it('rechaza si el admin intenta eliminarse a sí mismo', async () => {
    requireAccessMock.mockResolvedValueOnce({
      userId: targetId,
      role: 'admin',
      area: null,
      staffId: null,
      email: 'x@y.z',
      fullName: 'X',
      scope: { kind: 'global' as const },
    })

    await expect(deleteUser({ profileId: targetId })).rejects.toThrow(/tu propia cuenta/)
  })

  it('rechaza si el usuario no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await expect(deleteUser({ profileId: targetId })).rejects.toThrow(/no encontrado/)
  })

  it('requireAccess admin', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: targetId, email: 'x@y.z' }]))
    mockDb.delete = vi.fn(() => makeChain([]))
    await deleteUser({ profileId: targetId })
    expect(requireAccessMock).toHaveBeenCalledWith({ roles: ['admin', 'admin_area'] })
  })
})

describe('listUsers / listUnlinkedStaff', () => {
  it('listUsers requiere admin', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await listUsers()
    expect(requireAccessMock).toHaveBeenCalledWith({ roles: ['admin', 'admin_area'] })
  })

  it('listUnlinkedStaff requiere admin', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await listUnlinkedStaff()
    expect(requireAccessMock).toHaveBeenCalledWith({ roles: ['admin', 'admin_area'] })
  })

  it('listUsers rechaza si requireAccess falla', async () => {
    requireAccessMock.mockRejectedValueOnce(new PermissionError('No tienes permiso'))
    await expect(listUsers()).rejects.toThrow(/permiso/)
  })
})
