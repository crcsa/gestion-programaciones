import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    isActive: 'is_active',
    staffProfile: 'staff_profile',
  },
}))

vi.mock('@/lib/db/schema/staff-availability', () => ({
  staffAvailability: {
    staffId: 'staff_id',
    availabilityDate: 'availability_date',
    status: 'status',
  },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: { staffId: 'staff_id', shiftDate: 'shift_date' },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    staffId: 'staff_id',
    campaignId: 'campaign_id',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: { id: 'id', campaignDate: 'campaign_date', code: 'code' },
}))

import { db } from '@/lib/db'
import { getMonthlyCapacity } from '@/features/availability/lib/capacity-query'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'leftJoin', 'orderBy', 'limit',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMonthlyCapacity', () => {
  it('rechaza meses inválidos', async () => {
    await expect(getMonthlyCapacity({ year: 2026, month: 0 })).rejects.toThrow(
      'Mes inválido',
    )
    await expect(getMonthlyCapacity({ year: 2026, month: 13 })).rejects.toThrow(
      'Mes inválido',
    )
  })

  it('retorna 0 capacidad cuando no hay staff activo', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getMonthlyCapacity({ year: 2026, month: 5 })

    // May 2026 has 31 days
    expect(result).toHaveLength(31)
    expect(result.every((d) => d.totalStaff === 0 && d.free === 0)).toBe(true)
  })

  it('calcula libres = total - ocupados (campaña + sede + indisponible)', async () => {
    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      // 1: staff list
      if (callCount === 1) {
        return makeChain([
          { id: 's1' },
          { id: 's2' },
          { id: 's3' },
          { id: 's4' },
        ])
      }
      // 2: assignments — s1 in campaign on May 5
      if (callCount === 2) {
        return makeChain([{ staffId: 's1', campaignDate: '2026-05-05' }])
      }
      // 3: shifts — s2 on sede on May 5
      if (callCount === 3) {
        return makeChain([{ staffId: 's2', shiftDate: '2026-05-05' }])
      }
      // 4: overrides — s3 vacaciones on May 5
      return makeChain([
        {
          staffId: 's3',
          availabilityDate: '2026-05-05',
          status: 'vacaciones',
        },
      ])
    })

    const result = await getMonthlyCapacity({ year: 2026, month: 5 })

    const may5 = result.find((d) => d.date === '2026-05-05')!
    expect(may5.totalStaff).toBe(4)
    expect(may5.assignedToCampaign).toBe(1)
    expect(may5.onSedeShift).toBe(1)
    expect(may5.unavailable).toBe(1)
    expect(may5.free).toBe(1) // 4 - 3 distinct busy

    // Days without anything: free === total
    const may1 = result.find((d) => d.date === '2026-05-01')!
    expect(may1.free).toBe(4)
  })

  it('no doble cuenta el mismo staff con multiples bloqueos en el mismo dia', async () => {
    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain([{ id: 's1' }, { id: 's2' }])
      if (callCount === 2) {
        return makeChain([{ staffId: 's1', campaignDate: '2026-05-10' }])
      }
      if (callCount === 3) {
        // Same staff also has sede shift the same day
        return makeChain([{ staffId: 's1', shiftDate: '2026-05-10' }])
      }
      return makeChain([])
    })

    const result = await getMonthlyCapacity({ year: 2026, month: 5 })
    const may10 = result.find((d) => d.date === '2026-05-10')!

    expect(may10.totalStaff).toBe(2)
    // free should be 1 (s2 free, s1 busy in two ways but counted once)
    expect(may10.free).toBe(1)
  })

  it('ignora overrides con status no listado como indisponible', async () => {
    let callCount = 0
    mockDb.select = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain([{ id: 's1' }])
      if (callCount === 2) return makeChain([])
      if (callCount === 3) return makeChain([])
      return makeChain([
        {
          staffId: 's1',
          availabilityDate: '2026-05-15',
          status: 'disponible',
        },
      ])
    })

    const result = await getMonthlyCapacity({ year: 2026, month: 5 })
    const may15 = result.find((d) => d.date === '2026-05-15')!

    expect(may15.unavailable).toBe(0)
    expect(may15.free).toBe(1)
  })
})
