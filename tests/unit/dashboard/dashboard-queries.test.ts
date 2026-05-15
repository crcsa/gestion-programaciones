import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { select: vi.fn() } }))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id',
    campaignDate: 'campaign_date',
    status: 'status',
    modality: 'modality',
    isDeleted: 'is_deleted',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    staffId: 'staff_id',
    campaignId: 'campaign_id',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    firstName: 'first_name',
    lastName: 'last_name',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    staffId: 'staff_id',
    shiftDate: 'shift_date',
    totalHours: 'total_hours',
    isOvernight: 'is_overnight',
  },
}))

vi.mock('@/lib/db/schema/weekly-balance', () => ({
  weeklyBalance: {
    staffId: 'staff_id',
    weekStart: 'week_start',
    workedHours: 'worked_hours',
    sedeHours: 'sede_hours',
    campaignHours: 'campaign_hours',
  },
}))

vi.mock('@/lib/db/schema/monthly-counters', () => ({
  monthlyCounters: {
    staffId: 'staff_id',
    year: 'year',
    month: 'month',
    sundayCount: 'sunday_count',
    overnightCount: 'overnight_count',
  },
}))

vi.mock('@/features/configuration/lib/runtime-config', () => {
  const cfg = {
    weeklyHours: 44,
    maxExtraHoursWeek: 12,
    maxShiftHours: 12,
    minRestHours: 12,
    maxSundaysMonth: 2,
    maxOvernightsMonth: 1,
    municipalCutoffTime: '00:00',
    sedeMunicipality: 'Medellin',
  }
  return {
    loadValidationRuntimeConfig: vi.fn().mockResolvedValue(cfg),
    loadValidationRuntimeConfigAt: vi.fn().mockResolvedValue(cfg),
    invalidateRuntimeConfigCache: vi.fn(),
  }
})

import { db } from '@/lib/db'
import {
  getCampaignsTrendByMonth,
  getCampaignsByStatusDistribution,
  getMonthlyAlerts,
} from '@/features/dashboard/lib/dashboard-queries'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'leftJoin', 'limit', 'orderBy',
    'groupBy']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCampaignsTrendByMonth', () => {
  it('agrupa por mes y separa ejecutadas / canceladas', async () => {
    mockDb.select = vi.fn(() =>
      makeChain([
        { campaignDate: '2026-04-15', status: 'confirmada' },
        { campaignDate: '2026-04-20', status: 'ejecutada' },
        { campaignDate: '2026-04-25', status: 'cancelada' },
        { campaignDate: '2026-05-05', status: 'tentativa' },
      ]),
    )

    const result = await getCampaignsTrendByMonth(6)

    expect(result.length).toBe(6)
    const april = result.find((p) => /apr|abr/i.test(p.monthLabel))
    expect(april).toBeDefined()
    expect(april!.created).toBe(3)
    expect(april!.ejecutadas).toBe(1)
    expect(april!.canceladas).toBe(1)
  })

  it('rellena meses vacíos con ceros', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getCampaignsTrendByMonth(3)

    expect(result.length).toBe(3)
    expect(result.every((p) => p.created === 0)).toBe(true)
  })
})

describe('getCampaignsByStatusDistribution', () => {
  it('mapea status counts a forma de respuesta', async () => {
    mockDb.select = vi.fn(() =>
      makeChain([
        { status: 'confirmada', count: 5 },
        { status: 'ejecutada', count: 12 },
      ]),
    )

    const result = await getCampaignsByStatusDistribution()

    expect(result).toEqual([
      { status: 'confirmada', count: 5 },
      { status: 'ejecutada', count: 12 },
    ])
  })
})

describe('getMonthlyAlerts', () => {
  it('cuenta colaboradores sobre los topes (2 domingos / 1 pernocta)', async () => {
    mockDb.select = vi.fn(() =>
      makeChain([
        { sundayCount: 2, overnightCount: 0 },
        { sundayCount: 3, overnightCount: 1 },
        { sundayCount: 1, overnightCount: 0 },
      ]),
    )

    const result = await getMonthlyAlerts()

    expect(result.overSundays).toBe(2)
    expect(result.overOvernights).toBe(1)
  })
})
