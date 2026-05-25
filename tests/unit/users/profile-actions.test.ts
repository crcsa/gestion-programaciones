import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError } from '@/lib/errors/app-errors'

// ---- Mocks ----------------------------------------------------------------
const updateUserById = vi.fn()
const signInWithPassword = vi.fn()

vi.mock('@/lib/db', () => {
  const chain = {
    set: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(undefined)),
  }
  return { db: { update: vi.fn(() => chain) } }
})
vi.mock('@/lib/db/schema/profiles', () => ({ profiles: { id: 'id' } }))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({ auth: { admin: { updateUserById } } }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit/log-audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/features/auth/lib/user-context', () => ({
  requireUserContext: vi.fn().mockResolvedValue({
    userId: 'u1',
    email: 'old@x.com',
    fullName: 'Viejo',
    role: 'operativo',
    area: 'banco_sangre',
  }),
}))

import { updateMyProfile, changeMyPassword } from '@/features/users/actions/profile-actions'
import { db } from '@/lib/db'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  updateUserById.mockResolvedValue({ error: null })
  signInWithPassword.mockResolvedValue({ error: null })
})

describe('updateMyProfile', () => {
  it('actualiza nombre y persiste; no llama admin si el email no cambió', async () => {
    await updateMyProfile({ fullName: 'Nuevo Nombre', email: 'old@x.com' })
    expect(updateUserById).not.toHaveBeenCalled() // mismo email
    expect(db.update).toHaveBeenCalled()
  })

  it('cambia el email vía admin cuando difiere', async () => {
    await updateMyProfile({ fullName: 'Nuevo', email: 'nuevo@x.com' })
    expect(updateUserById).toHaveBeenCalledWith('u1', { email: 'nuevo@x.com', email_confirm: true })
    expect(db.update).toHaveBeenCalled()
  })

  it('mapea email duplicado a ValidationError', async () => {
    updateUserById.mockResolvedValue({ error: { message: 'A user with this email already registered' } })
    await expect(updateMyProfile({ fullName: 'X', email: 'taken@x.com' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('rechaza datos inválidos (email mal formado)', async () => {
    await expect(updateMyProfile({ fullName: 'X', email: 'no-es-email' })).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('changeMyPassword', () => {
  it('rechaza si la contraseña actual es incorrecta', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    await expect(
      changeMyPassword({ currentPassword: 'mala123', newPassword: 'nueva123', confirmPassword: 'nueva123' }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('cambia la contraseña cuando la actual es correcta', async () => {
    await changeMyPassword({ currentPassword: 'actual123', newPassword: 'nueva123', confirmPassword: 'nueva123' })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'old@x.com', password: 'actual123' })
    expect(updateUserById).toHaveBeenCalledWith('u1', { password: 'nueva123' })
  })

  it('rechaza si las contraseñas nuevas no coinciden', async () => {
    await expect(
      changeMyPassword({ currentPassword: 'actual123', newPassword: 'nueva123', confirmPassword: 'otra456' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
