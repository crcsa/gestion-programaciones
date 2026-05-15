import { describe, it, expect, vi, beforeEach } from 'vitest'
import { format, startOfWeek } from 'date-fns'

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn() },
}))

import { db } from '@/lib/db'
import {
  getMyWeeklyBreakdown,
  getMyMonthlyProgression,
  getMyUpcomingCampaigns,
  getMyDriverCampaigns,
  getMyWeekSedeShifts,
  getMyWeekAvailability,
  getMyLatestVehicle,
} from '@/features/dashboard/lib/operativo-queries'

// Chainable drizzle mock — every builder method returns the chain; awaiting
// resolves to `resolvedValue`.
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'orderBy', 'limit', 'leftJoin', 'innerJoin',
  ]
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

const STAFF_ID = 'staff-1'

beforeEach(() => vi.clearAllMocks())

describe('getMyWeeklyBreakdown', () => {
  it('rellena con ceros cuando no hay rows y respeta el largo solicitado', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getMyWeeklyBreakdown(STAFF_ID, 6)

    expect(result).toHaveLength(6)
    expect(result.every((p) => p.sedeHours === 0 && p.campaignHours === 0)).toBe(true)
  })

  it('mapea las horas de la semana correspondiente', async () => {
    const currentMonday = format(
      startOfWeek(new Date(), { weekStartsOn: 1 }),
      'yyyy-MM-dd',
    )
    mockDb.select = vi.fn(() =>
      makeChain([
        { weekStart: currentMonday, sedeHours: 30, campaignHours: 12 },
      ]),
    )

    const result = await getMyWeeklyBreakdown(STAFF_ID, 8)
    const lastWeek = result[result.length - 1]

    expect(lastWeek.weekStart).toBe(currentMonday)
    expect(lastWeek.sedeHours).toBe(30)
    expect(lastWeek.campaignHours).toBe(12)
  })
})

describe('getMyMonthlyProgression', () => {
  it('rellena con ceros los meses sin datos', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await getMyMonthlyProgression(STAFF_ID, 6)

    expect(result).toHaveLength(6)
    expect(
      result.every(
        (p) =>
          p.totalHours === 0 &&
          p.campaignCount === 0 &&
          p.sundayCount === 0 &&
          p.overnightCount === 0,
      ),
    ).toBe(true)
  })

  it('mapea el mes actual desde monthly_counters', async () => {
    const now = new Date()
    mockDb.select = vi.fn(() =>
      makeChain([
        {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          totalHours: 176,
          extraHours: 8,
          campaignCount: 3,
          sundayCount: 2,
          overnightCount: 1,
        },
      ]),
    )

    const result = await getMyMonthlyProgression(STAFF_ID, 6)
    const thisMonth = result[result.length - 1]

    expect(thisMonth.totalHours).toBe(176)
    expect(thisMonth.campaignCount).toBe(3)
    expect(thisMonth.sundayCount).toBe(2)
    expect(thisMonth.overnightCount).toBe(1)
  })
})

describe('getMyUpcomingCampaigns', () => {
  it('filtra campañas fuera de la ventana de 30 días y rows sin campaña', async () => {
    const today = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const inRange = iso(new Date(today.getTime() + 5 * 86400000))
    const past = iso(new Date(today.getTime() - 5 * 86400000))
    const farFuture = iso(new Date(today.getTime() + 90 * 86400000))

    mockDb.select = vi.fn(() =>
      makeChain([
        {
          campaignId: 'c1', assignmentId: 'a1', code: 'CAM-1',
          campaignDate: inRange, startTime: '08:00', endTime: '16:00',
          municipality: 'Medellín', status: 'confirmada', size: 'M',
          modality: 'corporativa', isCoordinator: true,
        },
        {
          campaignId: 'c2', assignmentId: 'a2', code: 'CAM-2',
          campaignDate: past, startTime: null, endTime: null,
          municipality: 'Bello', status: 'ejecutada', size: 'S',
          modality: 'carpa', isCoordinator: false,
        },
        {
          campaignId: 'c3', assignmentId: 'a3', code: 'CAM-3',
          campaignDate: farFuture, startTime: null, endTime: null,
          municipality: 'Itagüí', status: 'confirmada', size: 'L',
          modality: 'municipal', isCoordinator: false,
        },
        {
          campaignId: null, assignmentId: 'a4', code: null,
          campaignDate: null, startTime: null, endTime: null,
          municipality: null, status: null, size: null,
          modality: null, isCoordinator: false,
        },
      ]),
    )

    const result = await getMyUpcomingCampaigns(STAFF_ID)

    expect(result).toHaveLength(1)
    expect(result[0].campaignId).toBe('c1')
    expect(result[0].isCoordinator).toBe(true)
  })
})

describe('getMyDriverCampaigns', () => {
  it('mapea las campañas del conductor con datos del vehículo', async () => {
    mockDb.select = vi.fn(() =>
      makeChain([
        {
          campaignId: 'c1', campaignVehicleId: 'cv1', code: 'CAM-1',
          campaignDate: '2026-06-01', startTime: '06:00', endTime: '18:00',
          municipality: 'Rionegro', status: 'confirmada',
          plate: 'ABC123', mobileNumber: '12', model: 'Sprinter',
        },
      ]),
    )

    const result = await getMyDriverCampaigns(STAFF_ID)

    expect(result).toHaveLength(1)
    expect(result[0].plate).toBe('ABC123')
    expect(result[0].campaignVehicleId).toBe('cv1')
  })

  it('devuelve array vacío cuando no hay asignaciones', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    expect(await getMyDriverCampaigns(STAFF_ID)).toEqual([])
  })
})

describe('getMyWeekSedeShifts', () => {
  it('devuelve los turnos tal como vienen de la query', async () => {
    const shifts = [
      {
        id: 's1', shiftDate: '2026-06-02', shiftType: 'diurno_completo',
        startTime: '07:00', endTime: '17:00', totalHours: 9, isOvernight: false,
      },
    ]
    mockDb.select = vi.fn(() => makeChain(shifts))

    expect(await getMyWeekSedeShifts(STAFF_ID)).toEqual(shifts)
  })
})

describe('getMyWeekAvailability', () => {
  it('devuelve los overrides de disponibilidad de la semana', async () => {
    const overrides = [
      { availabilityDate: '2026-06-03', status: 'vacaciones', notes: null },
      { availabilityDate: '2026-06-04', status: 'incapacidad', notes: 'Reposo' },
    ]
    mockDb.select = vi.fn(() => makeChain(overrides))

    expect(await getMyWeekAvailability(STAFF_ID)).toEqual(overrides)
  })

  it('devuelve array vacío cuando no hay overrides', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    expect(await getMyWeekAvailability(STAFF_ID)).toEqual([])
  })
})

describe('getMyLatestVehicle', () => {
  it('devuelve el vehículo más reciente', async () => {
    mockDb.select = vi.fn(() =>
      makeChain([{ plate: 'XYZ987', mobileNumber: '5', model: 'Hilux' }]),
    )

    const result = await getMyLatestVehicle(STAFF_ID)

    expect(result?.plate).toBe('XYZ987')
  })

  it('devuelve null cuando no hay vehículo asignado', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    expect(await getMyLatestVehicle(STAFF_ID)).toBeNull()
  })
})
