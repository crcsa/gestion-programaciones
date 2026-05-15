import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { recalcBatchMock, logAuditMock } = vi.hoisted(() => ({
  recalcBatchMock: vi.fn().mockResolvedValue(undefined),
  logAuditMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/db', () => ({
  db: { update: vi.fn(), select: vi.fn() },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id',
    campaignDate: 'campaign_date',
    status: 'status',
    isDeleted: 'is_deleted',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    campaignId: 'campaign_id',
    staffId: 'staff_id',
    isActive: 'is_active',
  },
}))

vi.mock('@/features/hours/lib/aggregate-staff-data', () => ({
  recalcStaffAggregatesBatch: recalcBatchMock,
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: logAuditMock,
}))

import { db } from '@/lib/db'
import { GET } from '@/app/api/cron/finalize-campaigns/route'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'leftJoin', 'limit', 'orderBy',
    'update', 'set', 'returning']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { update: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

const ORIGINAL_SECRET = process.env.CRON_SECRET

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
})

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_SECRET
})

function makeRequest(authHeader?: string): Request {
  const headers = new Headers()
  if (authHeader) headers.set('authorization', authHeader)
  return new Request('http://localhost/api/cron/finalize-campaigns', { headers })
}

describe('GET /api/cron/finalize-campaigns', () => {
  it('responde 401 sin authorization', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('responde 401 con secret incorrecto', async () => {
    const res = await GET(makeRequest('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('responde 401 cuando CRON_SECRET no está definido', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeRequest('Bearer anything'))
    expect(res.status).toBe(401)
  })

  it('marca campañas pasadas como ejecutadas y dispara recalc', async () => {
    mockDb.update = vi.fn(() =>
      makeChain([
        { id: 'c1', campaignDate: '2026-04-10' },
        { id: 'c2', campaignDate: '2026-04-15' },
      ]),
    )
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      // Each finalized campaign queries assignments
      if (selectCount === 1) return makeChain([{ staffId: 's1' }, { staffId: 's2' }])
      return makeChain([{ staffId: 's3' }])
    })

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.finalized).toBe(2)
    expect(recalcBatchMock).toHaveBeenCalledTimes(2)
    expect(recalcBatchMock).toHaveBeenCalledWith(['s1', 's2'], '2026-04-10')
    expect(recalcBatchMock).toHaveBeenCalledWith(['s3'], '2026-04-15')
    expect(logAuditMock).toHaveBeenCalledTimes(2)
  })

  it('responde 200 con 0 finalizadas cuando no hay campañas pendientes', async () => {
    mockDb.update = vi.fn(() => makeChain([]))
    mockDb.select = vi.fn(() => makeChain([]))

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.finalized).toBe(0)
    expect(recalcBatchMock).not.toHaveBeenCalled()
  })
})
