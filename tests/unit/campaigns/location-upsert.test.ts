import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/db/schema/locations', () => ({
  locations: { id: 'id', companyId: 'company_id', name: 'name' },
}))

import { findOrCreateLocation } from '@/features/campaigns/lib/location-upsert'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'from', 'where', 'limit', 'insert', 'values', 'returning']) {
    chain[m] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

describe('findOrCreateLocation', () => {
  it('devuelve null si falta companyId o name', async () => {
    const tx = { select: vi.fn(), insert: vi.fn() } as never
    expect(await findOrCreateLocation(tx, { companyId: '', name: 'x', municipality: 'M' })).toBeNull()
    expect(await findOrCreateLocation(tx, { companyId: 'c', name: '', municipality: 'M' })).toBeNull()
  })

  it('reutiliza la ubicación existente (no inserta)', async () => {
    const tx = {
      select: vi.fn(() => makeChain([{ id: 'loc-1' }])),
      insert: vi.fn(),
    } as never

    const id = await findOrCreateLocation(tx, {
      companyId: 'c1',
      name: 'Orquideorama',
      address: 'Calle 73',
      municipality: 'Medellín',
    })

    expect(id).toBe('loc-1')
    expect((tx as { insert: ReturnType<typeof vi.fn> }).insert).not.toHaveBeenCalled()
  })

  it('crea la ubicación cuando no existe', async () => {
    const insert = vi.fn(() => makeChain([{ id: 'new-loc' }]))
    const tx = {
      select: vi.fn(() => makeChain([])),
      insert,
    } as never

    const id = await findOrCreateLocation(tx, {
      companyId: 'c1',
      name: 'PARQUEADERO',
      address: 'Cra 30',
      municipality: 'Medellín',
    })

    expect(id).toBe('new-loc')
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('usa el name como address cuando no se pasa address', async () => {
    const valuesSpy = vi.fn(() => makeChain([{ id: 'x' }]))
    const insert = vi.fn(() => ({ values: valuesSpy }))
    const tx = { select: vi.fn(() => makeChain([])), insert } as never

    await findOrCreateLocation(tx, { companyId: 'c1', name: 'Sede Norte', municipality: 'Bello' })

    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sede Norte', address: 'Sede Norte', municipality: 'Bello' }),
    )
  })
})
