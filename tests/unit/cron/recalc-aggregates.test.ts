import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { recalcMock } = vi.hoisted(() => ({
  recalcMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn() },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: { id: 'id', isActive: 'is_active' },
}))

vi.mock('@/features/hours/lib/aggregate-staff-data', () => ({
  recalcStaffAggregates: recalcMock,
}))

import { db } from '@/lib/db'
import { GET } from '@/app/api/cron/recalc-aggregates/route'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn> }
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
  return new Request('http://localhost/api/cron/recalc-aggregates', { headers })
}

describe('GET /api/cron/recalc-aggregates', () => {
  it('responde 401 sin authorization', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('reconcilia semana actual + semana anterior por cada staff activo', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'staff-1' }, { id: 'staff-2' }]))

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.reconciled).toBe(2)
    // 2 staff × 2 semanas = 4 invocaciones
    expect(recalcMock).toHaveBeenCalledTimes(4)
  })

  it('captura errores por staff sin abortar el batch', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'staff-1' }, { id: 'staff-2' }]))
    recalcMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    // 207 Multi-Status: hay errores parciales para que monitoring dispare.
    expect(res.status).toBe(207)
    expect(body.failed).toBe(1)
    expect(body.reconciled).toBe(1)
    expect(body.total).toBe(2)
  })
})
