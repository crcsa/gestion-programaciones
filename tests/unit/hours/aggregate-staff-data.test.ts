import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    staffId: 'staff_id',
    shiftDate: 'shift_date',
    totalHours: 'total_hours',
    isOvernight: 'is_overnight',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    staffId: 'staff_id',
    campaignId: 'campaign_id',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id',
    campaignDate: 'campaign_date',
    endDate: 'end_date',
    startTime: 'start_time',
    endTime: 'end_time',
    status: 'status',
  },
  campaignDays: {
    id: 'id',
    campaignId: 'campaign_id',
    dayDate: 'day_date',
    startTime: 'start_time',
    endTime: 'end_time',
    isOvernight: 'is_overnight',
  },
}))

vi.mock('@/lib/db/schema/monthly-counters', () => ({
  monthlyCounters: {
    staffId: 'staff_id',
    year: 'year',
    month: 'month',
    totalHours: 'total_hours',
    extraHours: 'extra_hours',
    sundayCount: 'sunday_count',
    overnightCount: 'overnight_count',
    campaignCount: 'campaign_count',
    updatedAt: 'updated_at',
  },
}))

const { computeWeeklyMock } = vi.hoisted(() => ({
  computeWeeklyMock: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/features/hours/lib/balance-calculator', () => ({
  computeAndSaveWeeklyBalance: computeWeeklyMock,
}))

import { db } from '@/lib/db'
import {
  recalcStaffAggregates,
  recalcStaffAggregatesBatch,
  computeAndSaveMonthlyCounters,
} from '@/features/hours/lib/aggregate-staff-data'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'leftJoin', 'limit', 'orderBy',
    'insert', 'values', 'onConflictDoUpdate']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as MockDb

const STAFF_ID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recalcStaffAggregates', () => {
  it('invokes weekly balance and monthly counters once each', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain(undefined))

    await recalcStaffAggregates(STAFF_ID, '2026-05-15')

    expect(computeWeeklyMock).toHaveBeenCalledTimes(1)
    // weekStart for 2026-05-15 (Friday) is Monday 2026-05-11
    expect(computeWeeklyMock).toHaveBeenCalledWith(STAFF_ID, '2026-05-11')
    // 1 monthly counters insert
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    // 3 selects in computeAndSaveMonthlyCounters:
    //  1) shifts, 2) campaign_assignments, 3) campaign_vehicles (driver).
    expect(selectCount).toBe(3)
  })

  it('handles refDate as Date object', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain(undefined))

    await recalcStaffAggregates(STAFF_ID, new Date('2026-05-15T12:00:00Z'))

    expect(computeWeeklyMock).toHaveBeenCalledTimes(1)
    expect(computeWeeklyMock.mock.calls[0][1]).toBe('2026-05-11')
  })
})

describe('recalcStaffAggregatesBatch', () => {
  it('dedupes staff ids before recalculating', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain(undefined))

    await recalcStaffAggregatesBatch([STAFF_ID, STAFF_ID, 'other'], '2026-05-15')

    // 1 weekly call per unique staff
    expect(computeWeeklyMock).toHaveBeenCalledTimes(2)
  })

  it('returns immediately when batch is empty', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.insert = vi.fn(() => makeChain(undefined))

    await recalcStaffAggregatesBatch([], '2026-05-15')

    expect(computeWeeklyMock).not.toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})

describe('computeAndSaveMonthlyCounters', () => {
  it('counts overnight shifts and sunday campaigns excluding canceladas', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) {
        // shifts: 1 overnight, 1 day shift
        return makeChain([
          { shiftDate: '2026-05-10', totalHours: 12, isOvernight: true },
          { shiftDate: '2026-05-12', totalHours: 8, isOvernight: false },
        ])
      }
      if (selectCount === 2) {
        // campaign_assignments
        return makeChain([
          {
            campaignId: 'camp-1',
            campaignDate: '2026-05-03', // domingo
            startTime: '08:00',
            endTime: '16:00',
            status: 'confirmada',
          },
          {
            campaignId: 'camp-2',
            campaignDate: '2026-05-10', // domingo cancelada → excluido
            startTime: '08:00',
            endTime: '16:00',
            status: 'cancelada',
          },
          {
            campaignId: 'camp-3',
            campaignDate: '2026-05-13', // miércoles
            startTime: '07:00',
            endTime: '15:00',
            status: 'ejecutada',
          },
        ])
      }
      // selectCount === 3: campaign_vehicles (driver) — vacío.
      return makeChain([])
    })

    const insertChain = makeChain(undefined)
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await computeAndSaveMonthlyCounters(STAFF_ID, 2026, 5)

    expect(valuesSpy).toHaveBeenCalledTimes(1)
    const inserted = valuesSpy.mock.calls[0][0] as {
      sundayCount: number
      overnightCount: number
      campaignCount: number
      totalHours: number
    }
    // Sundays: 1 campaña en domingo (May 3) + 1 sede shift en domingo (May 10) = 2
    expect(inserted.sundayCount).toBe(2)
    expect(inserted.overnightCount).toBe(1)
    expect(inserted.campaignCount).toBe(2) // confirmada + ejecutada
    // 12 + 8 sede + 8 + 8 campañas = 36
    expect(inserted.totalHours).toBe(36)
  })

  it('upserts with zero counts when no data', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    const insertChain = makeChain(undefined)
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await computeAndSaveMonthlyCounters(STAFF_ID, 2026, 5)

    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sundayCount: 0,
        overnightCount: 0,
        campaignCount: 0,
        totalHours: 0,
      }),
    )
  })

  it('uses 8h default for campaigns without start/end times', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([]) // shifts
      if (selectCount === 2) {
        return makeChain([
          {
            campaignId: 'camp-1',
            campaignDate: '2026-05-13',
            startTime: null,
            endTime: null,
            status: 'confirmada',
          },
        ])
      }
      return makeChain([]) // campaign_vehicles (driver) — vacío
    })
    const insertChain = makeChain(undefined)
    const valuesSpy = insertChain.values as ReturnType<typeof vi.fn>
    mockDb.insert = vi.fn(() => insertChain)

    await computeAndSaveMonthlyCounters(STAFF_ID, 2026, 5)

    const inserted = valuesSpy.mock.calls[0][0] as { totalHours: number }
    expect(inserted.totalHours).toBe(8)
  })
})
