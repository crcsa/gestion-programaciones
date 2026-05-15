import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionError } from '@/lib/errors/app-errors'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'admin' }),
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/db/schema/vehicles', () => ({
  vehicles: {
    id: 'id',
    plate: 'plate',
    model: 'model',
    year: 'year',
    capacity: 'capacity',
    notes: 'notes',
    isActive: 'is_active',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}))

import { db } from '@/lib/db'
import { requireAccess } from '@/features/auth/lib/require-access'
import {
  getVehicleList,
  getVehicleById,
  createVehicle,
  updateVehicle,
  toggleVehicleStatus,
  deleteVehicle,
} from '@/features/logistics/actions/vehicle-actions'

function makeChain(resolved: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning', 'leftJoin',
    'onConflictDoUpdate', 'groupBy',
  ]
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolved))
  return chain
}

type Mock = ReturnType<typeof vi.fn>
const mockDb = db as unknown as { select: Mock; insert: Mock; update: Mock; delete: Mock }

describe('getVehicleList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna data y total', async () => {
    const rows = [
      { id: 'v-1', plate: 'ABC-123', model: 'Hilux', isActive: true },
      { id: 'v-2', plate: 'DEF-456', model: 'Hiace', isActive: false },
    ]
    let call = 0
    mockDb.select = vi.fn(() => {
      call++
      return makeChain(call === 1 ? rows : [{ count: 2 }])
    })
    const result = await getVehicleList()
    expect(result.total).toBe(2)
    expect(result.data).toHaveLength(2)
  })
})

describe('getVehicleById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna el vehículo', async () => {
    const vehicle = { id: 'v-1', plate: 'ABC-123', isActive: true }
    mockDb.select = vi.fn(() => makeChain([vehicle]))
    const result = await getVehicleById('v-1')
    expect(result.plate).toBe('ABC-123')
  })

  it('lanza si no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await expect(getVehicleById('inexistente')).rejects.toThrow('Vehículo no encontrado')
  })
})

describe('createVehicle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crea con placa válida y devuelve el vehículo', async () => {
    let selectCall = 0
    mockDb.select = vi.fn(() => {
      selectCall++
      // Primera select: chequeo de placa duplicada (vacío).
      return makeChain([])
    })
    const created = { id: 'v-new', plate: 'XYZ-999' }
    mockDb.insert = vi.fn(() => makeChain([created]))
    const result = await createVehicle({ plate: 'xyz-999', model: 'Test' })
    expect(result.plate).toBe('XYZ-999')
    expect(selectCall).toBeGreaterThanOrEqual(1)
  })

  it('lanza si la placa ya existe', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'v-1' }]))
    await expect(
      createVehicle({ plate: 'ABC-123' }),
    ).rejects.toThrow('Ya existe un vehículo')
  })

  it('rechaza placa inválida', async () => {
    await expect(createVehicle({ plate: 'a' })).rejects.toThrow()
  })
})

describe('updateVehicle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('actualiza correctamente', async () => {
    mockDb.update = vi.fn(() => makeChain([{ id: 'v-1', plate: 'ABC-123' }]))
    const result = await updateVehicle('00000000-0000-4000-8000-000000000001', { model: 'Nuevo' })
    expect(result.id).toBe('v-1')
  })
})

describe('toggleVehicleStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invierte isActive', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'v-1', isActive: true }]))
    mockDb.update = vi.fn(() => makeChain([{ id: 'v-1', isActive: false }]))
    const result = await toggleVehicleStatus('v-1')
    expect(result.isActive).toBe(false)
  })

  it('lanza si no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await expect(toggleVehicleStatus('v-x')).rejects.toThrow('no encontrado')
  })
})

describe('deleteVehicle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('elimina el vehículo', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'v-1' }]))
    mockDb.delete = vi.fn(() => makeChain(undefined))
    await deleteVehicle('v-1')
    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('lanza si no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await expect(deleteVehicle('v-x')).rejects.toThrow('no encontrado')
  })
})

describe('requireAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rechaza si requireAccess falla', async () => {
    vi.mocked(requireAccess).mockRejectedValueOnce(new PermissionError('No tienes permiso'))
    await expect(getVehicleList()).rejects.toThrow('permiso')
  })
})
