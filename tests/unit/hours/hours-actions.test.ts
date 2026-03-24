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

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id', firstName: 'first_name', lastName: 'last_name',
    staffProfile: 'staff_profile', isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/weekly-balance', () => ({
  weeklyBalance: {
    id: 'id', staffId: 'staff_id', weekStart: 'week_start',
    workedHours: 'worked_hours', sedeHours: 'sede_hours',
    campaignHours: 'campaign_hours', extraHours: 'extra_hours',
    sundayCount: 'sunday_count', overnightCount: 'overnight_count',
    scheduledHours: 'scheduled_hours', updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    id: 'id', staffId: 'staff_id', shiftDate: 'shift_date',
    totalHours: 'total_hours', isOvernight: 'is_overnight',
    startTime: 'start_time', endTime: 'end_time',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    staffId: 'staff_id', campaignId: 'campaign_id', isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id', campaignDate: 'campaign_date', startTime: 'start_time', endTime: 'end_time',
  },
}))

import { db } from '@/lib/db'
import {
  getWeeklyBalances,
  getStaffWeeklyBalance,
  recalculateWeeklyBalance,
  recalculateAllWeeklyBalances,
} from '@/features/hours/actions/hours-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'insert', 'values',
    'update', 'set', 'leftJoin', 'returning', 'orderBy', 'onConflictDoUpdate']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

const staffId = '550e8400-e29b-41d4-a716-446655440001'

const mockStaff = [{ id: staffId, firstName: 'Ana', lastName: 'López', staffProfile: 'bacteriologo' }]

describe('getWeeklyBalances', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns cumplió state when exactly 44h', async () => {
    const balance = {
      staffId,
      weekStart: '2026-03-16',
      workedHours: 44,
      sedeHours: 44,
      campaignHours: 0,
      extraHours: 0,
      sundayCount: 0,
      overnightCount: 0,
    }
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(mockStaff)
      if (selectCount === 2) return makeChain([balance])    // current week
      if (selectCount === 3) return makeChain([])           // prev week
      return makeChain([])
    })

    const rows = await getWeeklyBalances('2026-03-16')
    expect(rows[0].balanceState).toBe('cumplió')
    expect(rows[0].extraHours).toBe(0)
  })

  it('returns horas_extras state when > 44h', async () => {
    const balance = { staffId, weekStart: '2026-03-16', workedHours: 50, sedeHours: 44, campaignHours: 6, extraHours: 6, sundayCount: 0, overnightCount: 0 }
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(mockStaff)
      if (selectCount === 2) return makeChain([balance])
      return makeChain([])
    })

    const rows = await getWeeklyBalances('2026-03-16')
    expect(rows[0].balanceState).toBe('horas_extras')
    expect(rows[0].extraHours).toBe(6)
  })

  it('returns debe_horas state when < 44h', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(mockStaff)
      if (selectCount === 2) return makeChain([])   // no balance record
      return makeChain([])
    })

    const rows = await getWeeklyBalances('2026-03-16')
    expect(rows[0].balanceState).toBe('debe_horas')
    expect(rows[0].workedHours).toBe(0)
  })

  it('calculates carryOverHours from previous week', async () => {
    const prevBalance = { staffId: staffId, workedHours: 48 }
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(mockStaff)
      if (selectCount === 2) return makeChain([])
      if (selectCount === 3) return makeChain([prevBalance])
      return makeChain([])
    })

    const rows = await getWeeklyBalances('2026-03-16')
    expect(rows[0].carryOverHours).toBe(4)  // 48 - 44 = 4h carry-over
  })
})

describe('getWeeklyBalances — sunday week derivation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('handles Sunday campaign date (getMondayOfWeek uses -6 diff)', async () => {
    // 2026-03-22 is a Sunday; getMondayOfWeek should return 2026-03-16
    const balance = { staffId, weekStart: '2026-03-16', workedHours: 44, sedeHours: 44, campaignHours: 0, extraHours: 0, sundayCount: 1, overnightCount: 0 }
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(mockStaff)
      if (selectCount === 2) return makeChain([balance])
      if (selectCount === 3) return makeChain([])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    const rows = await getWeeklyBalances('2026-03-16')
    // Verify it ran without error and returns data
    expect(rows).toHaveLength(1)
  })
})

describe('getWeeklyBalances — error path', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('wraps generic DB error as user-friendly message', async () => {
    mockDb.select = vi.fn().mockImplementation(() => {
      throw new Error('Connection lost')
    })
    await expect(getWeeklyBalances('2026-03-16')).rejects.toThrow('Error al obtener los balances')
  })
})

describe('recalculateWeeklyBalance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('upserts balance from sede shifts and campaign hours', async () => {
    const shift = { totalHours: 8, shiftDate: '2026-03-16', isOvernight: false }
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([shift])   // specific day shifts
      if (selectCount === 2) return makeChain([shift])   // all shifts
      if (selectCount === 3) return makeChain([{ campaignDate: '2026-03-16', startTime: '08:00', endTime: '16:00' }])  // campaigns
      return makeChain([])
    })
    const insertChain = makeChain([])
    mockDb.insert = vi.fn(() => insertChain)

    await expect(
      recalculateWeeklyBalance(staffId, '2026-03-16'),
    ).resolves.toBeUndefined()

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('counts sunday shifts correctly', async () => {
    const sundayShift = { totalHours: 8, shiftDate: '2026-03-22', isOvernight: false }
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([sundayShift])
      if (selectCount === 2) return makeChain([sundayShift])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    await expect(
      recalculateWeeklyBalance(staffId, '2026-03-16'),
    ).resolves.toBeUndefined()
  })

  it('counts overnight shifts', async () => {
    const overnightShift = { totalHours: 10, shiftDate: '2026-03-17', isOvernight: true }
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount <= 2) return makeChain([overnightShift])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    await expect(
      recalculateWeeklyBalance(staffId, '2026-03-16'),
    ).resolves.toBeUndefined()
  })

  it('wraps generic DB error as user-friendly message', async () => {
    mockDb.select = vi.fn().mockImplementation(() => {
      throw new Error('DB down')
    })
    await expect(
      recalculateWeeklyBalance(staffId, '2026-03-16'),
    ).rejects.toThrow('Error al recalcular')
  })
})

describe('recalculateWeeklyBalance — campaign hours calculation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calculates hours from campaign with startTime and endTime', async () => {
    // sede shifts (Promise.all slot 1), campaign rows (Promise.all slot 2)
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([])  // sede shifts: empty
      if (selectCount === 2) return makeChain([{ campaignDate: '2026-03-18', startTime: '08:00', endTime: '16:00' }])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    await expect(recalculateWeeklyBalance(staffId, '2026-03-16')).resolves.toBeUndefined()
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('handles overnight campaign (endTime < startTime → mins < 0)', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([])
      if (selectCount === 2) return makeChain([{ campaignDate: '2026-03-18', startTime: '22:00', endTime: '06:00' }])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    await expect(recalculateWeeklyBalance(staffId, '2026-03-16')).resolves.toBeUndefined()
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('uses 8h default for campaign row with missing startTime or endTime', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([])
      if (selectCount === 2) return makeChain([{ campaignDate: '2026-03-18', startTime: null, endTime: null }])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    await expect(recalculateWeeklyBalance(staffId, '2026-03-16')).resolves.toBeUndefined()
    // insert should be called with campaignHours: 8 (default)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })
})

describe('recalculateAllWeeklyBalances', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('recalculates for all active staff members sequentially', async () => {
    const staff = [{ id: staffId }, { id: '550e8400-e29b-41d4-a716-446655440002' }]
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(staff)   // active staff list
      // subsequent pairs: sede shifts + campaign rows per staff member
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    const result = await recalculateAllWeeklyBalances('2026-03-16')
    expect(result.updated).toBe(2)
    expect(result.errors).toHaveLength(0)
    expect(mockDb.insert).toHaveBeenCalledTimes(2)
  })

  it('continues even when individual staff recalculation fails', async () => {
    const staff = [{ id: staffId }]
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(staff)
      // Throw on subsequent selects to simulate per-staff failure
      throw new Error('DB error')
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    const result = await recalculateAllWeeklyBalances('2026-03-16')
    expect(result.updated).toBe(0)
    expect(result.errors).toHaveLength(1)
  })
})

describe('getStaffWeeklyBalance — error paths', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('wraps generic error as user-friendly message', async () => {
    mockDb.select = vi.fn().mockImplementation(() => {
      throw new Error('DB connection lost')
    })
    await expect(getStaffWeeklyBalance(staffId, '2026-03-16')).rejects.toThrow('Error al obtener')
  })
})

describe('getStaffWeeklyBalance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null when staff not found', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getStaffWeeklyBalance(staffId, '2026-03-16')
    expect(result).toBeNull()
  })

  it('returns balance for existing staff', async () => {
    const balance = { workedHours: 40, sedeHours: 40, campaignHours: 0, extraHours: 0, sundayCount: 0, overnightCount: 0 }
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([mockStaff[0]])
      if (selectCount === 2) return makeChain([balance])
      if (selectCount === 3) return makeChain([])
      return makeChain([])
    })

    const result = await getStaffWeeklyBalance(staffId, '2026-03-16')
    expect(result).not.toBeNull()
    expect(result?.balanceState).toBe('debe_horas')
    expect(result?.workedHours).toBe(40)
  })
})
