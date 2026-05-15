import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock('@/features/auth/lib/require-role', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'comercial' }),
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

vi.mock('@/lib/db/schema/company-contacts', () => ({
  companyContacts: {
    id: 'id',
    companyId: 'company_id',
    fullName: 'full_name',
    isPrimary: 'is_primary',
    email: 'email',
    phone: 'phone',
  },
}))

vi.mock('@/lib/db/schema/companies', () => ({
  companies: {
    id: 'id',
    name: 'name',
  },
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
} from '@/features/companies/actions/contact-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'delete', 'returning',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  transaction: ReturnType<typeof vi.fn>
}
const mockDb = db as unknown as MockDb

const validCompanyId = '550e8400-e29b-41d4-a716-446655440000'
const validContactId = '550e8400-e29b-41d4-a716-446655440010'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listContacts', () => {
  it('retorna contactos de la empresa', async () => {
    const rows = [
      {
        id: validContactId,
        companyId: validCompanyId,
        fullName: 'Ana',
        isPrimary: true,
      },
    ]
    mockDb.select = vi.fn(() => makeChain(rows))

    const result = await listContacts(validCompanyId)
    expect(result).toHaveLength(1)
    expect(result[0].fullName).toBe('Ana')
  })

  it('envuelve errores de DB', async () => {
    mockDb.select = vi.fn(() => {
      throw new Error('connection refused')
    })

    await expect(listContacts(validCompanyId)).rejects.toThrow(
      'Error al obtener los contactos',
    )
  })
})

describe('createContact', () => {
  it('crea contacto y limpia primary previo cuando se marca isPrimary', async () => {
    const txUpdate = vi.fn(() => makeChain([]))
    const txInsert = vi.fn(() =>
      makeChain([
        { id: validContactId, companyId: validCompanyId, fullName: 'Ana' },
      ]),
    )
    const tx = { update: txUpdate, insert: txInsert }
    mockDb.transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) =>
      cb(tx),
    )

    const created = await createContact({
      companyId: validCompanyId,
      fullName: 'Ana',
      isPrimary: true,
    })

    expect(created.fullName).toBe('Ana')
    expect(txUpdate).toHaveBeenCalledTimes(1)
    expect(txInsert).toHaveBeenCalledTimes(1)
  })

  it('no limpia primary previo si isPrimary=false', async () => {
    const txUpdate = vi.fn(() => makeChain([]))
    const txInsert = vi.fn(() =>
      makeChain([{ id: validContactId, companyId: validCompanyId, fullName: 'Luis' }]),
    )
    const tx = { update: txUpdate, insert: txInsert }
    mockDb.transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) =>
      cb(tx),
    )

    await createContact({
      companyId: validCompanyId,
      fullName: 'Luis',
      isPrimary: false,
    })

    expect(txUpdate).not.toHaveBeenCalled()
  })

  it('rechaza datos inválidos', async () => {
    await expect(
      createContact({
        companyId: 'no-uuid',
        fullName: 'Ana',
      }),
    ).rejects.toThrow()
  })
})

describe('updateContact', () => {
  it('actualiza el contacto', async () => {
    const txUpdate = vi.fn(() =>
      makeChain([{ id: validContactId, fullName: 'Ana M.' }]),
    )
    const tx = { update: txUpdate }
    mockDb.transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) =>
      cb(tx),
    )

    const result = await updateContact({
      id: validContactId,
      companyId: validCompanyId,
      fullName: 'Ana M.',
    })

    expect(result.fullName).toBe('Ana M.')
  })

  it('lanza error si no existe', async () => {
    const txUpdate = vi.fn(() => makeChain([]))
    const tx = { update: txUpdate }
    mockDb.transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) =>
      cb(tx),
    )

    await expect(
      updateContact({ id: validContactId, fullName: 'Ana' }),
    ).rejects.toThrow('Contacto no encontrado')
  })
})

describe('deleteContact', () => {
  it('elimina contacto existente', async () => {
    mockDb.delete = vi.fn(() =>
      makeChain([{ id: validContactId }]),
    )

    await expect(deleteContact(validContactId)).resolves.toBeUndefined()
  })

  it('lanza error si no existe', async () => {
    mockDb.delete = vi.fn(() => makeChain([]))

    await expect(deleteContact(validContactId)).rejects.toThrow(
      'Contacto no encontrado',
    )
  })
})

describe('importContacts', () => {
  it('importa contactos cuando la empresa existe', async () => {
    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      // 1: company lookup -> match. 2: existing contact -> none.
      if (selectCallCount % 2 === 1) return makeChain([{ id: validCompanyId }])
      return makeChain([])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    const result = await importContacts([
      { companyName: 'Acme', fullName: 'Ana' },
    ])

    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('omite contactos que ya existen', async () => {
    let selectCallCount = 0
    mockDb.select = vi.fn(() => {
      selectCallCount++
      if (selectCallCount % 2 === 1) return makeChain([{ id: validCompanyId }])
      return makeChain([{ id: validContactId }])
    })
    mockDb.insert = vi.fn(() => makeChain([]))

    const result = await importContacts([
      { companyName: 'Acme', fullName: 'Ana' },
    ])

    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('reporta error cuando la empresa no existe', async () => {
    mockDb.select = vi.fn(() => makeChain([]))

    const result = await importContacts([
      { companyName: 'Inexistente', fullName: 'Ana' },
    ])

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].reason).toContain('no encontrada')
  })

  it('reporta filas inválidas en errores', async () => {
    const result = await importContacts([
      { companyName: '', fullName: 'Ana' },
    ])

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
  })

  it('retorna resultado vacío con array vacío', async () => {
    const result = await importContacts([])
    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(0)
  })
})
