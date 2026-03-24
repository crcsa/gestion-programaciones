import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema/audit-log', () => ({
  auditLog: { id: 'id', profileId: 'profile_id', action: 'action', tableName: 'table_name', recordId: 'record_id', oldData: 'old_data', newData: 'new_data', ipAddress: 'ip_address', userAgent: 'user_agent', createdAt: 'created_at' },
}))

import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log-audit'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'insert', 'values', 'update', 'set', 'delete', 'returning', 'leftJoin']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  chain['catch'] = vi.fn(() => Promise.resolve(undefined))
  return chain
}

type SimpleMockDb = {
  insert: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as SimpleMockDb

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls db.insert with correct values', async () => {
    const chain = makeChain(undefined)
    mockDb.insert = vi.fn(() => chain)

    await logAudit({
      profileId: 'user-123',
      action: 'create',
      tableName: 'campaigns',
      recordId: 'rec-456',
      newData: { code: 'CAM-001' },
    })

    expect(mockDb.insert).toHaveBeenCalled()
    expect(chain.values).toHaveBeenCalledWith({
      profileId: 'user-123',
      action: 'create',
      tableName: 'campaigns',
      recordId: 'rec-456',
      oldData: null,
      newData: { code: 'CAM-001' },
    })
  })

  it('does NOT throw when db.insert fails (fire-and-forget)', async () => {
    const chain: Record<string, unknown> = {}
    const methods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'insert', 'values', 'update', 'set', 'delete', 'returning', 'leftJoin']
    for (const method of methods) {
      chain[method] = vi.fn(() => chain)
    }
    chain['then'] = () => Promise.reject(new Error('DB write error'))
    chain['catch'] = vi.fn(() => Promise.resolve(undefined))

    mockDb.insert = vi.fn(() => chain)

    // Should not throw
    await expect(logAudit({
      profileId: 'user-123',
      action: 'create',
      tableName: 'campaigns',
      recordId: 'rec-456',
    })).resolves.toBeUndefined()
  })

  it('uses oldData and newData when both provided', async () => {
    const chain = makeChain(undefined)
    mockDb.insert = vi.fn(() => chain)

    await logAudit({
      profileId: 'user-123',
      action: 'update',
      tableName: 'campaigns',
      recordId: 'rec-999',
      oldData: { status: 'tentativa' },
      newData: { status: 'confirmada' },
    })

    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        oldData: { status: 'tentativa' },
        newData: { status: 'confirmada' },
      }),
    )
  })

  it('inserts null for profileId when given null', async () => {
    const chain = makeChain(undefined)
    mockDb.insert = vi.fn(() => chain)

    await logAudit({
      profileId: null,
      action: 'delete',
      tableName: 'staff_members',
      recordId: 'rec-789',
    })

    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: null }),
    )
  })

  it('swallows the rejection via the real catch callback', async () => {
    // Make .values() return a real rejected Promise so the () => undefined
    // callback on .catch() actually executes (covering line 25)
    mockDb.insert = vi.fn(() => ({
      values: vi.fn(() => Promise.reject(new Error('insert failed'))),
    }))

    await expect(logAudit({
      profileId: 'user-1',
      action: 'create',
      tableName: 'test',
      recordId: 'rec-1',
    })).resolves.toBeUndefined()
  })
})
