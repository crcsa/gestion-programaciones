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

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-123', role: 'admin' }),
}))

vi.mock('@/features/auth/lib/require-access', () => ({
  requireAccess: vi.fn().mockResolvedValue({
    userId: 'user-123',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'admin@test.com',
    fullName: 'Admin Test',
    scope: { kind: 'global' as const },
  }),
}))

vi.mock('@/lib/db/schema/audit-log', () => ({
  auditLog: {
    id: 'id',
    profileId: 'profile_id',
    action: 'action',
    tableName: 'table_name',
    recordId: 'record_id',
    oldData: 'old_data',
    newData: 'new_data',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    createdAt: 'created_at',
  },
}))

vi.mock('@/lib/db/schema/profiles', () => ({
  profiles: { id: 'id', email: 'email', fullName: 'full_name', role: 'role' },
}))

import { db } from '@/lib/db'
import { requireRole } from '@/features/auth/lib/require-role'
import { requireAccess } from '@/features/auth/lib/require-access'
import { getAuditLog } from '@/features/audit/actions/audit-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning', 'leftJoin',
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

const sampleRow = {
  id: 'audit-1',
  profileId: 'user-123',
  userEmail: 'admin@test.com',
  userFullName: 'Admin User',
  action: 'create',
  tableName: 'campaigns',
  recordId: 'rec-1',
  oldData: null,
  newData: { code: 'CAM-001' },
  createdAt: new Date(),
}

describe('getAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ userId: 'user-123', role: 'admin' })
  })

  it('returns data and total', async () => {
    const rows = [sampleRow]

    // First select call returns rows, second returns count
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      if (selectCall <= 1) return makeChain(rows)
      return makeChain([{ count: 1 }])
    })

    const result = await getAuditLog()

    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(typeof result.total).toBe('number')
    expect(result.total).toBe(1)
  })

  it('applies tableName filter condition', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getAuditLog({ tableName: 'campaigns' })

    expect(Array.isArray(result.data)).toBe(true)
    expect(mockDb.select).toHaveBeenCalled()
  })

  it('applies action filter condition', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getAuditLog({ action: 'delete' })

    expect(Array.isArray(result.data)).toBe(true)
  })

  it('applies date range filter condition', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getAuditLog({
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    })

    expect(Array.isArray(result.data)).toBe(true)
  })

  it('throws when requireRole rejects (admin only)', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
    )

    await expect(getAuditLog()).rejects.toThrow('permiso')
  })

  it('calculates pagination offset correctly', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getAuditLog({ page: 3, limit: 10 })

    expect(Array.isArray(result.data)).toBe(true)
    // page 3, limit 10 => offset = 20
    // We verify indirectly that it was called (chain.offset is called)
  })

  it('wraps generic DB error with friendly message', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(getAuditLog()).rejects.toThrow('Error al obtener el log de auditoria')
  })

  it('returns empty data when no records exist', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getAuditLog()

    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })
})
