import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-coordinator', role: 'admin' }),
}))

vi.mock('@/lib/db/schema/campaign-timeline', () => ({
  campaignTimeline: {
    id: 'id', campaignId: 'campaign_id', eventType: 'event_type',
    eventTime: 'event_time', notes: 'notes', registeredById: 'registered_by_id',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id', campaignDate: 'campaign_date', status: 'status', updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    campaignId: 'campaign_id', staffId: 'staff_id', isActive: 'is_active', isCoordinator: 'is_coordinator',
  },
}))

vi.mock('@/lib/db/schema/hours-log', () => ({
  hoursLog: {
    id: 'id', staffId: 'staff_id', logDate: 'log_date',
    hoursWorked: 'hours_worked', sourceType: 'source_type', sourceId: 'source_id',
  },
}))

vi.mock('@/features/hours/actions/hours-actions', () => ({
  recalculateWeeklyBalance: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import {
  registerTimelineEvent,
  getCampaignTimeline,
  finalizeCampaignHours,
} from '@/features/hours/actions/hours-balance-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'insert', 'values',
    'update', 'set', 'leftJoin', 'returning', 'orderBy', 'onConflictDoNothing']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

const campaignId = '550e8400-e29b-41d4-a716-446655440000'

describe('registerTimelineEvent', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('validates schema — rejects old enum value', async () => {
    await expect(
      registerTimelineEvent({
        campaignId,
        eventType: 'inicio',  // deprecated
        eventTime: '2026-03-18T08:00:00.000Z',
      }),
    ).rejects.toThrow()
  })

  it('creates new timeline event when none exists', async () => {
    // coordinator check, then existing event check (empty)
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      return makeChain([])
    })
    const insertChain = makeChain([])
    mockDb.insert = vi.fn(() => insertChain)

    await expect(
      registerTimelineEvent({
        campaignId,
        eventType: 'salida_sede',
        eventTime: '2026-03-18T07:00:00.000Z',
      }),
    ).resolves.toBeUndefined()

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('updates existing event if already registered', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([])             // coordinator check
      if (selectCount === 2) return makeChain([{ id: 'event-1' }])  // existing event
      return makeChain([])
    })
    mockDb.update = vi.fn(() => makeChain([]))

    await registerTimelineEvent({
      campaignId,
      eventType: 'salida_sede',
      eventTime: '2026-03-18T07:30:00.000Z',
    })

    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })
})

describe('getCampaignTimeline', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns events sorted by TIMELINE_EVENT_ORDER', async () => {
    const events = [
      { id: '1', campaignId, eventType: 'fin', eventTime: new Date('2026-03-18T18:00:00Z'), notes: null, registeredById: null, createdAt: new Date() },
      { id: '2', campaignId, eventType: 'salida_sede', eventTime: new Date('2026-03-18T07:00:00Z'), notes: null, registeredById: null, createdAt: new Date() },
    ]
    mockDb.select = vi.fn(() => makeChain(events))

    const result = await getCampaignTimeline(campaignId)
    expect(result[0].eventType).toBe('salida_sede')
    expect(result[result.length - 1].eventType).toBe('fin')
  })

  it('returns empty array when no events', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    const result = await getCampaignTimeline(campaignId)
    expect(result).toHaveLength(0)
  })
})

describe('finalizeCampaignHours', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws when fewer than 9 timeline events', async () => {
    const onlyThreeEvents = [
      { id: '1', campaignId, eventType: 'salida_sede', eventTime: new Date(), notes: null, registeredById: null, createdAt: new Date() },
      { id: '2', campaignId, eventType: 'llegada_punto', eventTime: new Date(), notes: null, registeredById: null, createdAt: new Date() },
      { id: '3', campaignId, eventType: 'inicio_donaciones', eventTime: new Date(), notes: null, registeredById: null, createdAt: new Date() },
    ]
    mockDb.select = vi.fn(() => makeChain(onlyThreeEvents))

    await expect(finalizeCampaignHours(campaignId)).rejects.toThrow('Faltan')
  })

  it('calculates hours and updates campaign when all 9 events present', async () => {
    const base = new Date('2026-03-18T00:00:00Z')
    const makeEvent = (type: string, h: number) => ({
      id: type, campaignId, eventType: type,
      eventTime: new Date(base.getTime() + h * 3600 * 1000),
      notes: null, registeredById: null, createdAt: new Date(),
    })
    const allEvents = [
      makeEvent('salida_sede', 7),
      makeEvent('llegada_punto', 8),
      makeEvent('inicio_donaciones', 8.5),
      makeEvent('salida_almuerzo', 12),
      makeEvent('regreso_almuerzo', 13),
      makeEvent('fin_donaciones', 17),
      makeEvent('recogida', 17.5),
      makeEvent('llegada_sede', 18.5),
      makeEvent('fin', 19),
    ]

    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(allEvents)        // getCampaignTimeline
      if (selectCount === 2) return makeChain([{ campaignDate: '2026-03-18' }])  // campaign
      if (selectCount === 3) return makeChain([{ staffId: 'staff-1' }])           // assigned staff
      if (selectCount === 4) return makeChain([{ staffId: 'staff-1', staffProfile: 'bacteriologo' }]) // recalc: staff
      if (selectCount === 5) return makeChain([])                // recalc: specific shifts
      if (selectCount === 6) return makeChain([])                // recalc: all shifts
      if (selectCount === 7) return makeChain([])                // recalc: campaigns
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.update = vi.fn(() => makeChain([]))

    await expect(finalizeCampaignHours(campaignId)).resolves.toBeUndefined()
    expect(mockDb.insert).toHaveBeenCalledTimes(1)  // hours_log insert
    expect(mockDb.update).toHaveBeenCalledTimes(1)  // campaign status → ejecutada
  })
})
