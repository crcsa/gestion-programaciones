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

vi.mock('@/features/auth/lib/require-access', () => ({
  requireAccess: vi.fn().mockResolvedValue({
    userId: 'user-1',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'admin@test.com',
    fullName: 'Admin Test',
    scope: { kind: 'global' as const },
  }),
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id', firstName: 'first_name', lastName: 'last_name',
    staffProfile: 'staff_profile', isActive: 'is_active',
  },
  staffTrainingAreas: {
    staffId: 'staff_id', trainingAreaId: 'training_area_id',
  },
}))

vi.mock('@/lib/db/schema/staff-availability', () => ({
  staffAvailability: {
    id: 'id', staffId: 'staff_id', availabilityDate: 'availability_date',
    status: 'status', referenceType: 'reference_type', notes: 'notes',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    id: 'id', staffId: 'staff_id', shiftDate: 'shift_date',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    id: 'id', staffId: 'staff_id', campaignId: 'campaign_id', isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id', campaignDate: 'campaign_date', code: 'code',
  },
  campaignDays: {
    id: 'id', campaignId: 'campaign_id', dayDate: 'day_date',
  },
}))

vi.mock('@/lib/db/schema/campaign-vehicles', () => ({
  campaignVehicles: {
    id: 'id', campaignId: 'campaign_id', driverStaffId: 'driver_staff_id', isActive: 'is_active',
  },
}))

import { db } from '@/lib/db'
import {
  getWeeklyAvailabilityGrid,
  setStaffAvailabilityOverride,
} from '@/features/availability/actions/availability-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'insert', 'values',
    'update', 'set', 'leftJoin', 'innerJoin', 'returning', 'onConflictDoNothing',
    '$dynamic', 'orderBy']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

const staffId = '550e8400-e29b-41d4-a716-446655440001'

describe('getWeeklyAvailabilityGrid', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns grid rows for all active staff', async () => {
    const mockStaff = [{
      id: staffId, firstName: 'Juan', lastName: 'Pérez', staffProfile: 'bacteriologo',
    }]

    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      // 1: staff, 2: training area filter, 3: overrides, 4: shifts, 5: campaigns
      if (selectCount === 1) return makeChain(mockStaff)
      return makeChain([])
    })

    const result = await getWeeklyAvailabilityGrid({ weekStart: '2026-03-16' })
    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('Juan')
    expect(result[0].days).toBeDefined()
    expect(Object.keys(result[0].days)).toHaveLength(7)
  })

  it('assigns libre when no activities', async () => {
    const mockStaff = [{
      id: staffId, firstName: 'Ana', lastName: 'García', staffProfile: 'tecnico',
    }]

    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      return makeChain(selectCount === 1 ? mockStaff : [])
    })

    const result = await getWeeklyAvailabilityGrid({ weekStart: '2026-03-16' })
    const days = result[0]?.days ?? {}
    expect(Object.values(days).every((d) => d.status === 'libre')).toBe(true)
  })

  it('assigns en_campana when staff has campaign that day', async () => {
    const mockStaff = [{ id: staffId, firstName: 'Juan', lastName: 'Pérez', staffProfile: 'bacteriologo' }]
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(mockStaff)
      if (selectCount === 2) return makeChain([])  // no overrides
      if (selectCount === 3) return makeChain([])  // no shifts
      // Las queries de campañas se expanden a campaign_days; el campo es
      // ahora `dayDate` (uno por día). Las hacemos en paralelo (assignments
      // + drivers) así que devolvemos las dos cuentas.
      if (selectCount === 4) return makeChain([{ staffId, dayDate: '2026-03-16', campaignCode: 'C001' }])
      if (selectCount === 5) return makeChain([])  // no driver assignments
      return makeChain([])
    })

    const result = await getWeeklyAvailabilityGrid({ weekStart: '2026-03-16' })
    const monday = result[0]?.days['2026-03-16']
    expect(monday?.status).toBe('en_campana')
  })

  it('assigns en_sede when staff has shift that day', async () => {
    const mockStaff = [{ id: staffId, firstName: 'Ana', lastName: 'López', staffProfile: 'tecnico' }]
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(mockStaff)
      if (selectCount === 2) return makeChain([])  // no overrides
      if (selectCount === 3) return makeChain([{ staffId, shiftDate: '2026-03-16' }])
      if (selectCount === 4) return makeChain([])  // no campaign assignments
      if (selectCount === 5) return makeChain([])  // no driver assignments
      return makeChain([])
    })

    const result = await getWeeklyAvailabilityGrid({ weekStart: '2026-03-16' })
    const monday = result[0]?.days['2026-03-16']
    expect(monday?.status).toBe('en_sede')
  })

  it('override takes priority over campaign', async () => {
    const mockStaff = [{ id: staffId, firstName: 'Luis', lastName: 'Torres', staffProfile: 'bacteriologo' }]
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(mockStaff)
      if (selectCount === 2) return makeChain([{ staffId, date: '2026-03-16', status: 'vacaciones' }])
      if (selectCount === 3) return makeChain([])  // no shifts
      if (selectCount === 4) return makeChain([{ staffId, dayDate: '2026-03-16', campaignCode: 'C002' }])
      if (selectCount === 5) return makeChain([])  // no driver assignments
      return makeChain([])
    })

    const result = await getWeeklyAvailabilityGrid({ weekStart: '2026-03-16' })
    const monday = result[0]?.days['2026-03-16']
    expect(monday?.status).toBe('vacaciones')
  })

  it('rejecting invalid weekStart schema', async () => {
    await expect(
      getWeeklyAvailabilityGrid({ weekStart: 'invalid' }),
    ).rejects.toThrow()
  })

  it('filters by staffProfile when provided', async () => {
    const mockStaff = [{ id: staffId, firstName: 'Juan', lastName: 'Pérez', staffProfile: 'bacteriologo' }]
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      return makeChain(selectCount === 1 ? mockStaff : [])
    })

    const result = await getWeeklyAvailabilityGrid({
      weekStart: '2026-03-16',
      staffProfile: 'bacteriologo',
    })
    expect(result).toHaveLength(1)
  })

  it('filters by trainingAreaId when provided', async () => {
    const mockStaff = [{ id: staffId, firstName: 'Ana', lastName: 'López', staffProfile: 'bacteriologo' }]
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      if (selectCount === 1) return makeChain(mockStaff)          // staff query
      if (selectCount === 2) return makeChain([{ staffId }])       // area staff filter
      return makeChain([])
    })

    const result = await getWeeklyAvailabilityGrid({
      weekStart: '2026-03-16',
      trainingAreaId: '550e8400-e29b-41d4-a716-446655440099',
    })
    expect(result).toHaveLength(1)
  })
})

describe('getWeeklyAvailabilityGrid — error path', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('wraps generic DB error as user-friendly message', async () => {
    mockDb.select = vi.fn().mockImplementation(() => {
      throw new Error('DB connection lost')
    })
    await expect(
      getWeeklyAvailabilityGrid({ weekStart: '2026-03-16' }),
    ).rejects.toThrow('Error al obtener')
  })
})

describe('setStaffAvailabilityOverride', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates existing availability override', async () => {
    // Si existe registro previo, va por la rama update (sin insert) para
    // evitar duplicar filas (no hay UNIQUE en staff_id+availability_date).
    mockDb.insert = vi.fn(() => makeChain([]))
    mockDb.select = vi.fn(() => makeChain([{ id: 'avail-1' }]))
    mockDb.update = vi.fn(() => makeChain([{ id: 'avail-1' }]))

    await expect(
      setStaffAvailabilityOverride({
        staffId,
        availabilityDate: '2026-03-18',
        status: 'vacaciones',
      }),
    ).resolves.toBeUndefined()

    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('inserts new availability override when no row exists', async () => {
    mockDb.select = vi.fn(() => makeChain([])) // no existe
    mockDb.insert = vi.fn(() => makeChain([{ id: 'new' }]))
    mockDb.update = vi.fn(() => makeChain([]))

    await setStaffAvailabilityOverride({
      staffId,
      availabilityDate: '2026-03-18',
      status: 'vacaciones',
    })

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('validates schema — rejects invalid status', async () => {
    await expect(
      setStaffAvailabilityOverride({
        staffId,
        availabilityDate: '2026-03-18',
        status: 'disponible' as 'vacaciones',
      }),
    ).rejects.toThrow()
  })

  it('validates schema — rejects invalid date format', async () => {
    await expect(
      setStaffAvailabilityOverride({
        staffId,
        availabilityDate: '18/03/2026',
        status: 'licencia',
      }),
    ).rejects.toThrow()
  })
})
