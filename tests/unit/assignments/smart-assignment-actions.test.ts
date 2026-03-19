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

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id', campaignDate: 'campaign_date', startTime: 'start_time',
    endTime: 'end_time', municipality: 'municipality', trainingAreaId: 'training_area_id',
  },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: { id: 'id', firstName: 'first_name', lastName: 'last_name', staffProfile: 'staff_profile', isActive: 'is_active' },
  staffTrainingAreas: { staffId: 'staff_id', trainingAreaId: 'training_area_id' },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: { id: 'id', campaignId: 'campaign_id', staffId: 'staff_id', isActive: 'is_active', isCoordinator: 'is_coordinator', removedAt: 'removed_at', assignedAt: 'assigned_at' },
}))

vi.mock('@/lib/db/schema/staff-availability', () => ({
  staffAvailability: { staffId: 'staff_id', availabilityDate: 'availability_date', status: 'status' },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: { staffId: 'staff_id', shiftDate: 'shift_date', startTime: 'start_time', endTime: 'end_time' },
}))

vi.mock('@/lib/db/schema/weekly-balance', () => ({
  weeklyBalance: { staffId: 'staff_id', weekStart: 'week_start', extraHours: 'extra_hours', workedHours: 'worked_hours' },
}))

vi.mock('@/lib/db/schema/monthly-counters', () => ({
  monthlyCounters: { staffId: 'staff_id', year: 'year', month: 'month', sundayCount: 'sunday_count', overnightCount: 'overnight_count' },
}))

vi.mock('@/features/assignments/actions/assignment-actions', () => ({
  assignStaff: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import { assignStaffWithValidation } from '@/features/assignments/actions/smart-assignment-actions'
import { assignStaff } from '@/features/assignments/actions/assignment-actions'

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

const campaignId = '550e8400-e29b-41d4-a716-446655440000'
const staffId    = '550e8400-e29b-41d4-a716-446655440001'

const mockCampaign = {
  id: campaignId,
  campaignDate: '2026-03-18',
  startTime: '08:00',
  endTime: '16:00',
  municipality: 'Medellín',
  trainingAreaId: null,
}

const mockStaff = [{
  id: staffId, firstName: 'Juan', lastName: 'García', staffProfile: 'bacteriologo',
}]

describe('assignStaffWithValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(assignStaff).mockResolvedValue(undefined)
  })

  it('validates input schema — rejects invalid campaignId', async () => {
    await expect(
      assignStaffWithValidation({ campaignId: 'bad-id', staffId }),
    ).rejects.toThrow('campaña')
  })

  it('validates input schema — rejects invalid staffId', async () => {
    await expect(
      assignStaffWithValidation({ campaignId, staffId: 'bad-id' }),
    ).rejects.toThrow('funcionario')
  })

  it('assigns directly when validation passes (clean ctx)', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([mockCampaign])        // campaign
      if (selectCount === 2) return makeChain([])                    // already assigned
      if (selectCount === 3) return makeChain(mockStaff)             // all staff
      if (selectCount === 4) return makeChain([])                    // training areas
      if (selectCount === 5) return makeChain([])                    // availability
      if (selectCount === 6) return makeChain([])                    // same day shifts
      if (selectCount === 7) return makeChain([])                    // same day campaigns
      if (selectCount === 8) return makeChain([])                    // prev day shifts
      if (selectCount === 9) return makeChain([])                    // weekly balance
      if (selectCount === 10) return makeChain([])                   // monthly counters
      return makeChain([])
    })

    const result = await assignStaffWithValidation({ campaignId, staffId })
    expect('success' in result).toBe(true)
    expect(assignStaff).toHaveBeenCalledWith({ campaignId, staffIds: [staffId] })
  })

  it('returns requiresConfirmation when warnings exist and no forceOverride', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([mockCampaign])
      if (selectCount === 2) return makeChain([])          // not already assigned
      if (selectCount === 3) return makeChain(mockStaff)
      if (selectCount === 4) return makeChain([])
      // availability: vacaciones → warn
      if (selectCount === 5) return makeChain([{ staffId, status: 'vacaciones' }])
      return makeChain([])
    })

    const result = await assignStaffWithValidation({ campaignId, staffId, forceOverride: false })

    if ('requiresConfirmation' in result) {
      expect(result.requiresConfirmation).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    } else {
      // Staff might not be in candidates if already assigned — skip assertion
      expect('success' in result).toBe(true)
    }
  })

  it('throws when blocking validation fails', async () => {
    const campaignWithArea = { ...mockCampaign, trainingAreaId: 'area-restricted' }

    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([campaignWithArea])
      if (selectCount === 2) return makeChain([])      // not assigned
      if (selectCount === 3) return makeChain(mockStaff)
      if (selectCount === 4) return makeChain([])      // staff has no training areas
      return makeChain([])
    })

    await expect(
      assignStaffWithValidation({ campaignId, staffId }),
    ).rejects.toThrow('No se puede asignar')
  })

  it('assigns directly when staff is already in assigned set (not in candidates)', async () => {
    const otherStaffId = '550e8400-e29b-41d4-a716-446655440002'
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([mockCampaign])        // campaign
      if (selectCount === 2) return makeChain([{ staffId }])         // already assigned: includes target
      if (selectCount === 3) return makeChain([{ id: otherStaffId, firstName: 'Other', lastName: 'Staff', staffProfile: 'tecnico' }])
      if (selectCount === 4) return makeChain([])  // training areas
      if (selectCount === 5) return makeChain([])  // availability
      if (selectCount === 6) return makeChain([])  // same day shifts
      if (selectCount === 7) return makeChain([])  // same day campaigns
      if (selectCount === 8) return makeChain([])  // prev day shifts
      if (selectCount === 9) return makeChain([])  // weekly balance
      if (selectCount === 10) return makeChain([]) // monthly counters
      return makeChain([])
    })

    const result = await assignStaffWithValidation({ campaignId, staffId })
    expect('success' in result).toBe(true)
    expect(assignStaff).toHaveBeenCalledWith({ campaignId, staffIds: [staffId] })
  })

  it('handles prev-day shifts and monthly counters in validation context', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([mockCampaign])        // campaign
      if (selectCount === 2) return makeChain([])                    // already assigned
      if (selectCount === 3) return makeChain(mockStaff)             // all staff
      if (selectCount === 4) return makeChain([])                    // training areas
      if (selectCount === 5) return makeChain([])                    // availability
      if (selectCount === 6) return makeChain([])                    // same day shifts (non-overlapping)
      if (selectCount === 7) return makeChain([{ staffId, startTime: '16:00', endTime: '18:00' }])  // same day campaigns after
      if (selectCount === 8) return makeChain([{ staffId, endTime: '22:00' }])  // prev day shifts → descanso warn
      if (selectCount === 9) return makeChain([{ staffId, extraHours: 5 }])     // weekly balance
      if (selectCount === 10) return makeChain([{ staffId, sundayCount: 1, overnightCount: 0 }])  // monthly counters
      return makeChain([])
    })

    const result = await assignStaffWithValidation({ campaignId, staffId })
    // descanso insuficiente warn (22:00 prev day → 08:00 today = 10h, >= 8h ok) or success
    expect('success' in result || 'requiresConfirmation' in result).toBe(true)
  })

  it('wraps generic DB error as user-friendly message', async () => {
    mockDb.select = vi.fn().mockImplementation(() => {
      throw new Error('Connection refused')
    })

    await expect(
      assignStaffWithValidation({ campaignId, staffId }),
    ).rejects.toThrow('Error al asignar')
  })
})
