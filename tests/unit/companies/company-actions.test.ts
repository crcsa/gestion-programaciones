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
    userId: 'user-123',
    role: 'admin',
    area: null,
    staffId: null,
    email: 'admin@test.com',
    fullName: 'Admin Test',
    scope: { kind: 'global' as const },
  }),
}))

vi.mock('@/lib/db/schema/companies', () => ({
  companies: {
    id: 'id', name: 'name', nit: 'nit', isActive: 'is_active',
    contactName: 'contact_name', contactPhone: 'contact_phone',
    contactEmail: 'contact_email', address: 'address',
    municipality: 'municipality', department: 'department',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/db/schema/campaigns', () => ({
  campaigns: {
    id: 'id', companyId: 'company_id', status: 'status',
    campaignDate: 'campaign_date', isDeleted: 'is_deleted',
  },
}))

vi.mock('@/lib/audit/log-audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import {
  createCompany,
  updateCompany,
  deactivateCompany,
  activateCompany,
  getCompaniesList,
  getCompanyById,
} from '@/features/companies/actions/company-actions'

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'update', 'set', 'leftJoin', 'returning',
    'onConflictDoUpdate', 'onConflictDoNothing']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolvedValue))
  return chain
}

type MockDb = { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as MockDb

const mockCompany = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Empresa Prueba',
  nit: null,
  contactName: null,
  contactPhone: null,
  contactEmail: null,
  address: null,
  municipality: null,
  department: 'Antioquia',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('createCompany', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates company when NIT is unique', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      return makeChain(selectCount === 1 ? [] : [])  // NIT check returns empty
    })
    const insertChain = makeChain([mockCompany])
    mockDb.insert = vi.fn(() => insertChain)

    const result = await createCompany({ name: 'Empresa Prueba', department: 'Antioquia' })
    expect(result.name).toBe('Empresa Prueba')
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('throws when NIT already exists', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'existing' }]))

    await expect(
      createCompany({ name: 'Otra', nit: '123456789-0', department: 'Antioquia' }),
    ).rejects.toThrow('NIT')
  })

  it('validates schema — rejects too-short name', async () => {
    await expect(
      createCompany({ name: 'A', department: 'Antioquia' }),
    ).rejects.toThrow()
  })
})

describe('updateCompany', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates company successfully', async () => {
    const updatedCompany = { ...mockCompany, name: 'Nuevo Nombre' }
    mockDb.select = vi.fn(() => makeChain([]))  // NIT unique check
    mockDb.update = vi.fn(() => makeChain([updatedCompany]))

    const result = await updateCompany({ id: mockCompany.id, name: 'Nuevo Nombre' })
    expect(result.name).toBe('Nuevo Nombre')
  })

  it('throws when company not found', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.update = vi.fn(() => makeChain([]))  // returns empty

    await expect(
      updateCompany({ id: mockCompany.id, name: 'Test' }),
    ).rejects.toThrow('no encontrada')
  })
})

describe('deactivateCompany', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deactivates when no future campaigns', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      return makeChain(selectCount === 1 ? [] : [])
    })
    mockDb.update = vi.fn(() => makeChain([{ ...mockCompany, isActive: false }]))

    await expect(deactivateCompany(mockCompany.id)).resolves.toBeUndefined()
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('throws when future tentative campaigns exist', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'campaign-1' }]))

    await expect(deactivateCompany(mockCompany.id)).rejects.toThrow(
      'No se puede desactivar',
    )
  })

  it('throws when company not found after deactivation attempt', async () => {
    mockDb.select = vi.fn(() => makeChain([]))   // no future campaigns
    mockDb.update = vi.fn(() => makeChain([]))   // no rows returned

    await expect(deactivateCompany(mockCompany.id)).rejects.toThrow('no encontrada')
  })
})

describe('activateCompany', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('activates company successfully', async () => {
    mockDb.update = vi.fn(() => makeChain([{ ...mockCompany, isActive: true }]))
    await expect(activateCompany(mockCompany.id)).resolves.toBeUndefined()
  })

  it('throws when company not found', async () => {
    mockDb.update = vi.fn(() => makeChain([]))
    await expect(activateCompany(mockCompany.id)).rejects.toThrow('no encontrada')
  })
})

describe('getCompanyById', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns company when found', async () => {
    mockDb.select = vi.fn(() => makeChain([mockCompany]))
    const result = await getCompanyById(mockCompany.id)
    expect(result.id).toBe(mockCompany.id)
  })

  it('throws when company not found', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    await expect(getCompanyById('nonexistent-id')).rejects.toThrow('no encontrada')
  })
})

describe('updateCompany — NIT duplicate check', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws when NIT belongs to a different company', async () => {
    mockDb.select = vi.fn(() => makeChain([{ id: 'other-company-id' }]))

    await expect(
      updateCompany({ id: mockCompany.id, nit: '987654321-0' }),
    ).rejects.toThrow('NIT')
  })

  it('allows update when NIT belongs to same company', async () => {
    const updatedCompany = { ...mockCompany, nit: '987654321-0' }
    mockDb.select = vi.fn(() => makeChain([{ id: mockCompany.id }]))  // NIT belongs to same id
    mockDb.update = vi.fn(() => makeChain([updatedCompany]))

    const result = await updateCompany({ id: mockCompany.id, nit: '987654321-0' })
    expect(result.nit).toBe('987654321-0')
  })
})

describe('getCompaniesList', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of companies with total count', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      return makeChain(selectCount === 1 ? [mockCompany] : [{ id: 'id-1' }])
    })

    const result = await getCompaniesList()
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('filters by isActive when provided', async () => {
    let selectCount = 0
    mockDb.select = vi.fn(() => {
      selectCount++
      return makeChain(selectCount === 1 ? [mockCompany] : [{ id: 'id-1' }])
    })

    const result = await getCompaniesList({ isActive: true })
    expect(result.data).toHaveLength(1)
  })
})

describe('updateCompany — generic error', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws generic error when db.update rejects', async () => {
    mockDb.select = vi.fn(() => makeChain([]))
    mockDb.update = vi.fn(() => { throw new Error('db failure') })

    await expect(
      updateCompany({ id: mockCompany.id, name: 'Test' }),
    ).rejects.toThrow('Error al actualizar la empresa')
  })
})

describe('deactivateCompany — generic error', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws generic error when db.update rejects', async () => {
    mockDb.select = vi.fn(() => makeChain([]))   // no future campaigns
    mockDb.update = vi.fn(() => { throw new Error('db failure') })

    await expect(deactivateCompany(mockCompany.id)).rejects.toThrow(
      'Error al desactivar la empresa',
    )
  })
})

describe('activateCompany — generic error', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws generic error when db.update rejects', async () => {
    mockDb.update = vi.fn(() => { throw new Error('db failure') })

    await expect(activateCompany(mockCompany.id)).rejects.toThrow(
      'Error al activar la empresa',
    )
  })
})
