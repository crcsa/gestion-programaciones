import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionError } from '@/lib/errors/app-errors'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
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

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/features/hours/lib/aggregate-staff-data', () => ({
  recalcStaffAggregates: vi.fn().mockResolvedValue(undefined),
  recalcAggregatesForCampaign: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
  recalcAggregatesForDate: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
}))

vi.mock('@/lib/db/schema/campaign-vehicles', () => ({
  campaignVehicles: {
    id: 'id',
    campaignId: 'campaign_id',
    vehicleId: 'vehicle_id',
    driverStaffId: 'driver_staff_id',
    isActive: 'is_active',
    assignedAt: 'assigned_at',
    removedAt: 'removed_at',
  },
}))

vi.mock('@/lib/db/schema/vehicles', () => ({
  vehicles: {
    id: 'id',
    plate: 'plate',
    model: 'model',
    capacity: 'capacity',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id',
    campaignDate: 'campaign_date',
    endDate: 'end_date',
    status: 'status',
    isDeleted: 'is_deleted',
  },
}))

vi.mock('@/lib/db/schema/staff-members', () => ({
  staffMembers: {
    id: 'id',
    firstName: 'first_name',
    lastName: 'last_name',
    isActive: 'is_active',
    area: 'area',
    staffProfile: 'staff_profile',
    profileId: 'profile_id',
  },
}))

vi.mock('@/lib/db/schema/campaign-assignments', () => ({
  campaignAssignments: {
    id: 'id',
    campaignId: 'campaign_id',
    staffId: 'staff_id',
    isActive: 'is_active',
  },
}))

vi.mock('@/lib/db/schema/sede-shifts', () => ({
  sedeShifts: {
    id: 'id',
    staffId: 'staff_id',
    shiftDate: 'shift_date',
  },
}))

import { db } from '@/lib/db'
import { requireAccess } from '@/features/auth/lib/require-access'
import { recalcAggregatesForCampaign } from '@/features/hours/lib/aggregate-staff-data'
import {
  getAssignedVehicles,
  getAvailableVehicles,
  getAvailableDrivers,
  assignVehicle,
  removeVehicleAssignment,
  setDriver,
} from '@/features/logistics/actions/campaign-vehicle-actions'

function makeChain(resolved: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'selectDistinct', 'from', 'where', 'limit', 'offset',
    'orderBy', 'insert', 'values', 'update', 'set', 'returning',
    'leftJoin', 'innerJoin', 'onConflictDoUpdate', 'groupBy',
  ]
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolved))
  return chain
}

type Mock = ReturnType<typeof vi.fn>
const mockDb = db as unknown as {
  select: Mock
  selectDistinct: Mock
  insert: Mock
  update: Mock
}

describe('getAssignedVehicles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna la lista mapeada', async () => {
    const rows = [
      {
        id: 'cv-1',
        vehicleId: 'v-1',
        plate: 'ABC-123',
        model: 'Hilux',
        capacity: 6,
        driverStaffId: 's-1',
        driverFirstName: 'Ana',
        driverLastName: 'Garcia',
        assignedAt: new Date(),
      },
    ]
    mockDb.select = vi.fn(() => makeChain(rows))
    const result = await getAssignedVehicles('camp-1')
    expect(result).toHaveLength(1)
    expect(result[0].driverFullName).toBe('Garcia, Ana')
  })

  it('maneja sin conductor', async () => {
    const rows = [
      {
        id: 'cv-1',
        vehicleId: 'v-1',
        plate: 'ABC-123',
        model: null,
        capacity: null,
        driverStaffId: null,
        driverFirstName: null,
        driverLastName: null,
        assignedAt: new Date(),
      },
    ]
    mockDb.select = vi.fn(() => makeChain(rows))
    const result = await getAssignedVehicles('camp-1')
    expect(result[0].driverFullName).toBeNull()
  })
})

describe('getAvailableVehicles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna vehículo de otra campaña solapada marcado busyElsewhere', async () => {
    const vehicleId = 'v-busy'
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      // 1) campaign date range
      if (selectCall === 1) return makeChain([{ campaignDate: '2026-06-01', endDate: null }])
      // 2) vehicles list
      return makeChain([
        { id: vehicleId, plate: 'XYZ-999', mobileNumber: null, model: null, capacity: null },
        { id: 'v-free', plate: 'AAA-111', mobileNumber: null, model: null, capacity: null },
      ])
    })
    let distinctCall = 0
    mockDb.selectDistinct = vi.fn(() => {
      distinctCall++
      if (distinctCall === 1) return makeChain([]) // inThisCampaign
      return makeChain([{ vehicleId }]) // overlapping
    })

    const result = await getAvailableVehicles('camp-1')
    expect(result).toHaveLength(2)
    expect(result.find((v) => v.id === vehicleId)?.busyElsewhere).toBe(true)
    expect(result.find((v) => v.id === 'v-free')?.busyElsewhere).toBe(false)
  })
})

describe('getAvailableDrivers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna conductor solapado marcado busyElsewhere', async () => {
    const driverId = 's-busy'
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      // 1) campaign date range
      if (selectCall === 1) return makeChain([{ campaignDate: '2026-06-01', endDate: null }])
      // 2) drivers list
      return makeChain([
        { id: driverId, firstName: 'Ana', lastName: 'Diaz', cedula: '123' },
        { id: 's-free', firstName: 'Beto', lastName: 'Ruiz', cedula: '456' },
      ])
    })
    let distinctCall = 0
    mockDb.selectDistinct = vi.fn(() => {
      distinctCall++
      // 1) otherCampaignDrivers, 2) sedeBusy, 3) campaignBusy
      if (distinctCall === 1) return makeChain([{ driverStaffId: driverId }])
      return makeChain([])
    })

    const result = await getAvailableDrivers('camp-1')
    expect(result).toHaveLength(2)
    expect(result.find((d) => d.id === driverId)?.busyElsewhere).toBe(true)
    expect(result.find((d) => d.id === 's-free')?.busyElsewhere).toBe(false)
  })
})

describe('assignVehicle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asigna aunque el vehículo esté ocupado en otra campaña (busyElsewhere)', async () => {
    const vehicleId = '00000000-0000-4000-8000-000000000002'
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      // 1) campaign date range (getAvailableVehicles)
      if (selectCall === 1) return makeChain([{ campaignDate: '2026-06-01', endDate: null }])
      // 2) vehicles list → el vehículo SÍ está en la lista
      if (selectCall === 2) {
        return makeChain([
          { id: vehicleId, plate: 'ABC-123', mobileNumber: null, model: null, capacity: null },
        ])
      }
      // 3) lookup de asignación existente (ninguna) → inserta
      return makeChain([])
    })
    // inThisCampaign → vacío, overlapping → el vehículo (busyElsewhere=true)
    let distinctCall = 0
    mockDb.selectDistinct = vi.fn(() => {
      distinctCall++
      if (distinctCall === 1) return makeChain([]) // inThisCampaign
      return makeChain([{ vehicleId }]) // overlapping en otra campaña
    })
    mockDb.insert = vi.fn(() => makeChain(undefined))

    await expect(
      assignVehicle({
        campaignId: '00000000-0000-4000-8000-000000000001',
        vehicleId,
      }),
    ).resolves.toBeUndefined()
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('rechaza si requireAccess falla', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError('No tienes permiso'))
    await expect(
      assignVehicle({
        campaignId: '00000000-0000-4000-8000-000000000001',
        vehicleId: '00000000-0000-4000-8000-000000000002',
      }),
    ).rejects.toThrow('permiso')
  })
})

describe('removeVehicleAssignment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca como inactiva y dispara recalc si tenía conductor', async () => {
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) {
        return makeChain([
          { id: 'cv-1', campaignId: 'camp-1', driverStaffId: 's-driver' },
        ])
      }
      // segundo select: campaign date
      return makeChain([{ campaignDate: '2026-06-01' }])
    })
    mockDb.update = vi.fn(() => makeChain(undefined))

    await removeVehicleAssignment('cv-1')
    expect(mockDb.update).toHaveBeenCalled()
    expect(recalcAggregatesForCampaign).toHaveBeenCalledWith(
      'camp-1',
      's-driver',
      'removeVehicleAssignment',
    )
  })

  it('lanza si la asignación no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await expect(removeVehicleAssignment('cv-x')).rejects.toThrow('no encontrada')
  })
})

describe('setDriver', () => {
  beforeEach(() => vi.clearAllMocks())

  it('actualiza driver y dispara recalc del nuevo y anterior', async () => {
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) {
        // row del campaignVehicle
        return makeChain([
          { id: 'cv-1', campaignId: 'camp-1', previousDriverStaffId: 's-old' },
        ])
      }
      if (call === 2) {
        // driver lookup
        return makeChain([
          { id: 's-new', area: 'logistica', staffProfile: 'conductor' },
        ])
      }
      // campaign lookup
      return makeChain([{ campaignDate: '2026-06-10' }])
    })
    mockDb.update = vi.fn(() => makeChain(undefined))

    const newDriverId = '00000000-0000-4000-8000-000000000010'
    const oldDriverId = '00000000-0000-4000-8000-000000000020'
    // Ajusta mock para retornar el oldDriverId real.
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) {
        return makeChain([
          { id: 'cv-1', campaignId: 'camp-1', previousDriverStaffId: oldDriverId },
        ])
      }
      if (call === 2) {
        return makeChain([
          { id: newDriverId, area: 'logistica', staffProfile: 'conductor' },
        ])
      }
      return makeChain([{ campaignDate: '2026-06-10' }])
    })
    call = 0

    await setDriver({
      campaignVehicleId: '00000000-0000-4000-8000-000000000001',
      driverStaffId: newDriverId,
    })

    expect(recalcAggregatesForCampaign).toHaveBeenCalled()
    const callArgs = (recalcAggregatesForCampaign as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    expect(callArgs[0]).toBe('camp-1')
    const passedSet = callArgs[1] as Set<string>
    expect(passedSet.has(newDriverId)).toBe(true)
    expect(passedSet.has(oldDriverId)).toBe(true)
    expect(callArgs[2]).toBe('setDriver')
  })

  it('rechaza si el conductor no es de logística', async () => {
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      if (call === 1) {
        return makeChain([
          { id: 'cv-1', campaignId: 'camp-1', previousDriverStaffId: null },
        ])
      }
      // driver de otra area
      return makeChain([
        { id: 's-bad', area: 'banco_sangre', staffProfile: 'tecnico' },
      ])
    })

    await expect(
      setDriver({
        campaignVehicleId: '00000000-0000-4000-8000-000000000001',
        driverStaffId: '00000000-0000-4000-8000-000000000030',
      }),
    ).rejects.toThrow('conductores del área de logística')
  })
})
