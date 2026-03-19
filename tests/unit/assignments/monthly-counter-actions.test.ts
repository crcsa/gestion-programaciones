import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'admin' }),
}))

vi.mock('@/lib/db/schema/monthly-counters', () => ({
  monthlyCounters: {
    id: 'id',
    staffId: 'staff_id',
    year: 'year',
    month: 'month',
    sundayCount: 'sunday_count',
    overnightCount: 'overnight_count',
    updatedAt: 'updated_at',
  },
}))

import { db } from '@/lib/db'
import {
  incrementMonthlyCounters,
  decrementMonthlyCounters,
} from '@/features/assignments/actions/monthly-counter-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'insert', 'values',
    'update', 'set', 'onConflictDoUpdate', 'onConflictDoNothing', 'returning']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

const staffId = '550e8400-e29b-41d4-a716-446655440001'

describe('incrementMonthlyCounters', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts with sundayCount=1 on Sunday', async () => {
    const chain = makeChain([])
    mockDb.insert = vi.fn(() => chain)

    await incrementMonthlyCounters({ staffId, year: 2026, month: 3, isSunday: true, isOvernight: false })

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    expect(chain.onConflictDoUpdate).toHaveBeenCalled()
  })

  it('inserts with overnightCount=1 on overnight', async () => {
    const chain = makeChain([])
    mockDb.insert = vi.fn(() => chain)

    await incrementMonthlyCounters({ staffId, year: 2026, month: 3, isSunday: false, isOvernight: true })

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    expect(chain.onConflictDoUpdate).toHaveBeenCalled()
  })

  it('handles both sunday and overnight simultaneously', async () => {
    const chain = makeChain([])
    mockDb.insert = vi.fn(() => chain)

    await incrementMonthlyCounters({ staffId, year: 2026, month: 3, isSunday: true, isOvernight: true })

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('throws meaningful error on DB failure', async () => {
    mockDb.insert = vi.fn(() => { throw new Error('DB error') })

    await expect(
      incrementMonthlyCounters({ staffId, year: 2026, month: 3, isSunday: false, isOvernight: false }),
    ).rejects.toThrow('Error al incrementar contadores mensuales')
  })
})

describe('decrementMonthlyCounters', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('does nothing when no existing record', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    await decrementMonthlyCounters({ staffId, year: 2026, month: 3, isSunday: true, isOvernight: false })

    expect(mockDb.select).toHaveBeenCalledTimes(1)
  })

  it('updates using GREATEST to prevent negative values', async () => {
    const existing = { id: 'counter-1', sundayCount: 1, overnightCount: 0 }
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      return makeChain(selectCall === 1 ? [existing] : [])
    })
    const updateChain = makeChain([existing])
    mockDb.update = vi.fn(() => updateChain)

    await decrementMonthlyCounters({ staffId, year: 2026, month: 3, isSunday: true, isOvernight: false })

    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })
})
