import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionError } from '@/lib/errors/app-errors'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'operativo' }),
}))

vi.mock('@/features/auth/lib/require-access', () => ({
  requireAccess: vi.fn().mockResolvedValue({
    userId: 'user-123',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'admin@test.com',
    fullName: 'Admin Test',
    scope: { kind: 'global' as const },
  }),
}))

vi.mock('@/lib/db/schema/profiles', () => ({
  profiles: {
    id: 'id', email: 'email', role: 'role',
  },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id', profileId: 'profile_id', firstName: 'first_name',
    lastName: 'last_name', staffProfile: 'staff_profile', isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    id: 'id', campaignId: 'campaign_id', staffId: 'staff_id',
    isCoordinator: 'is_coordinator', isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id', code: 'code', campaignDate: 'campaign_date',
    startTime: 'start_time', endTime: 'end_time', municipality: 'municipality',
    status: 'status', size: 'size', modality: 'modality',
  },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    id: 'id', staffId: 'staff_id', shiftDate: 'shift_date',
    shiftType: 'shift_type', startTime: 'start_time', endTime: 'end_time',
    totalHours: 'total_hours', isOvernight: 'is_overnight',
  },
}))

vi.mock('@/lib/db/schema/weekly-balance', () => ({
  weeklyBalance: {
    id: 'id', staffId: 'staff_id', weekStart: 'week_start',
    workedHours: 'worked_hours', sedeHours: 'sede_hours',
    campaignHours: 'campaign_hours', extraHours: 'extra_hours',
  },
}))

vi.mock('@/lib/db/schema/monthly-counters', () => ({
  monthlyCounters: {
    id: 'id', staffId: 'staff_id', year: 'year', month: 'month',
    sundayCount: 'sunday_count', overnightCount: 'overnight_count',
  },
}))

vi.mock('@/lib/db/schema/staff-availability', () => ({
  staffAvailability: {
    id: 'id', staffId: 'staff_id', availabilityDate: 'availability_date',
    status: 'status', notes: 'notes', updatedAt: 'updated_at',
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
import { requireAccess } from '@/features/auth/lib/require-access'
import {
  getMyAgendaData,
  setMyAvailability,
} from '@/features/my-agenda/actions/my-agenda-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'insert', 'values',
    'update', 'set', 'leftJoin', 'returning', 'orderBy',
    'onConflictDoUpdate',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as MockDb
const mockRequireAccess = requireAccess as ReturnType<typeof vi.fn>

const staffId = '550e8400-e29b-41d4-a716-446655440001'
const profileRow = { id: 'user-1' }
const staffRow = {
  id: staffId,
  firstName: 'Ana',
  lastName: 'Lopez',
  staffProfile: 'bacteriologo',
}

// ---- getMyAgendaData tests ------------------------------------------------

describe('getMyAgendaData', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns data when staffMember found', async () => {
    // Calls: profile, staffMember, campaigns, sedeShifts, weeklyBalance, monthlyCounters
    // The action uses Promise.all for the last 4, but profile + staff are sequential
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      // 1 = profile lookup
      if (selectCount === 1) return makeChain([profileRow])
      // 2 = staff member lookup
      if (selectCount === 2) return makeChain([staffRow])
      // 3 = upcoming campaigns (Promise.all call 1)
      if (selectCount === 3) return makeChain([])
      // 4 = sede shifts (Promise.all call 2)
      if (selectCount === 4) return makeChain([])
      // 5 = weekly balance (Promise.all call 3)
      if (selectCount === 5) return makeChain([])
      // 6 = monthly counters (Promise.all call 4)
      if (selectCount === 6) return makeChain([])
      return makeChain([])
    })

    const result = await getMyAgendaData()

    expect(result).not.toBeNull()
    expect(result!.staffMemberId).toBe(staffId)
    expect(result!.firstName).toBe('Ana')
    expect(result!.lastName).toBe('Lopez')
    expect(result!.staffProfile).toBe('bacteriologo')
    expect(result!.upcomingCampaigns).toEqual([])
    expect(result!.sedeShiftsThisWeek).toEqual([])
    expect(result!.weeklyBalance).toBeNull()
    expect(result!.monthlyCounters).toEqual({ sundayCount: 0, overnightCount: 0 })
    expect(result!.coordinatorCampaignIds).toEqual([])
  })

  it('returns null when no staff member associated', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([profileRow])
      // No staff member
      return makeChain([])
    })

    await expect(getMyAgendaData()).resolves.toBeNull()
  })

  it('throws user-friendly error on DB failure', async () => {
    mockDb.select = vi.fn().mockImplementation(() => {
      throw new Error('Connection lost')
    })

    await expect(getMyAgendaData()).rejects.toThrow(
      'Error al obtener los datos de mi agenda',
    )
  })

  it('propagates requireRole rejection', async () => {
    mockRequireAccess.mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
    )

    await expect(getMyAgendaData()).rejects.toThrow('permiso')
  })
})

// ---- setMyAvailability tests ----------------------------------------------

describe('setMyAvailability', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts new availability when no existing record', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      // 1 = profile
      if (selectCount === 1) return makeChain([profileRow])
      // 2 = staff member
      if (selectCount === 2) return makeChain([staffRow])
      // 3 = existing availability check
      if (selectCount === 3) return makeChain([])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    await expect(
      setMyAvailability({
        availabilityDate: '2026-04-01',
        status: 'vacaciones',
        notes: 'Viaje familiar',
      }),
    ).resolves.toBeUndefined()

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('updates existing availability record', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([profileRow])
      if (selectCount === 2) return makeChain([staffRow])
      // Existing record found
      if (selectCount === 3) return makeChain([{ id: 'avail-1' }])
      return makeChain([])
    })
    const updateChain = makeChain([])
    mockDb.update = vi.fn(() => updateChain)

    await expect(
      setMyAvailability({
        availabilityDate: '2026-04-01',
        status: 'incapacidad',
      }),
    ).resolves.toBeUndefined()

    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('throws on DB failure', async () => {
    mockDb.select = vi.fn().mockImplementation(() => {
      throw new Error('DB down')
    })

    await expect(
      setMyAvailability({
        availabilityDate: '2026-04-01',
        status: 'licencia',
      }),
    ).rejects.toThrow('Error al registrar la disponibilidad')
  })

  it('throws when no staff member associated', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain([profileRow])
      return makeChain([])
    })

    await expect(
      setMyAvailability({
        availabilityDate: '2026-04-01',
        status: 'vacaciones',
      }),
    ).rejects.toThrow('No tiene un perfil de colaborador asociado')
  })

  it('propagates requireRole rejection', async () => {
    mockRequireAccess.mockRejectedValueOnce(
      new PermissionError('No tienes permiso para realizar esta accion.'),
    )

    await expect(
      setMyAvailability({
        availabilityDate: '2026-04-01',
        status: 'vacaciones',
      }),
    ).rejects.toThrow('permiso')
  })
})
