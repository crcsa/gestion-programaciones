import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-123', role: 'admin' }),
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    profileId: 'profile_id',
    firstName: 'first_name',
    lastName: 'last_name',
    cedula: 'cedula',
    phone: 'phone',
    email: 'email',
    staffProfile: 'staff_profile',
    contractType: 'contract_type',
    weeklyHours: 'weekly_hours',
    hireDate: 'hire_date',
    isActive: 'is_active',
    notes: 'notes',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultShift: 'default_shift',
  },
  staffTrainingAreas: {
    staffId: 'staff_id',
    trainingAreaId: 'training_area_id',
  },
}))

vi.mock('@/lib/db/schema/training-areas', () => ({
  trainingAreas: { id: 'id', name: 'name', isActive: 'is_active' },
}))

vi.mock('@/lib/db/schema/profiles', () => ({
  profiles: { id: 'id', email: 'email', fullName: 'full_name', role: 'role' },
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } },
  })),
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import { requireRole } from '@/features/auth/lib/require-role'
import { importStaffFromExcel } from '@/features/staff/actions/staff-actions'
import type { ImportStaffRow } from '@/features/staff/actions/staff-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning', 'leftJoin',
    'onConflictDoUpdate',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolvedValue))
  return chain
}

type SimpleMockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as SimpleMockDb

const validRow: ImportStaffRow = {
  cedula: '12345678',
  firstName: 'Juan',
  lastName: 'Perez',
  staffProfile: 'tecnico',
  contractType: 'indefinido',
  phone: '3001234567',
  email: 'juan@test.com',
}

describe('importStaffFromExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('imports a valid row successfully', async () => {
    // select (cedula check) returns empty
    mockDb.select = vi.fn(() => makeChain([]))
    // insert returns created staff
    mockDb.insert = vi.fn(() => makeChain([{ id: 'new-staff-id' }]))

    const result = await importStaffFromExcel([validRow])

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('skips duplicate cedula when db returns existing', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'existing-staff' }]))

    const result = await importStaffFromExcel([validRow])

    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('adds error for invalid profile', async () => {
    const badRow = { ...validRow, staffProfile: 'invalid_profile' as ImportStaffRow['staffProfile'] }

    const result = await importStaffFromExcel([badRow])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(2)
    expect(result.errors[0].reason).toContain('Perfil invalido')
  })

  it('adds error for short cedula (< 5 chars)', async () => {
    const badRow = { ...validRow, cedula: '123' }

    const result = await importStaffFromExcel([badRow])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(2)
    expect(result.errors[0].reason).toContain('Cedula invalida')
  })

  it('adds error for short firstName (< 2 chars)', async () => {
    const badRow = { ...validRow, firstName: 'J' }

    const result = await importStaffFromExcel([badRow])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].reason).toContain('Nombres invalido')
  })

  it('adds error for short lastName (< 2 chars)', async () => {
    const badRow = { ...validRow, lastName: 'P' }

    const result = await importStaffFromExcel([badRow])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].reason).toContain('Apellidos invalido')
  })

  it('records DB error when insert fails', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => {
      throw new Error('DB write error')
    })

    const result = await importStaffFromExcel([validRow])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].reason).toBe('Error al guardar en la base de datos')
  })

  it('throws when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new Error('No tienes permiso para realizar esta accion.'),
    )

    await expect(importStaffFromExcel([validRow])).rejects.toThrow('permiso')
  })

  it('processes multiple rows: imported + skipped + errors', async () => {
    const rows: ImportStaffRow[] = [
      validRow,
      { ...validRow, cedula: '99999999' },
      { ...validRow, cedula: '12' }, // too short
    ]

    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall === 1) return makeChain([]) // row 1: no dup
      if (selectCall === 2) return makeChain([{ id: 'existing' }]) // row 2: dup
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([{ id: 'new-id' }]))

    const result = await importStaffFromExcel(rows)

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
  })
})
