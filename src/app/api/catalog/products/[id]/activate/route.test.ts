import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/app/api/_lib/runtime', () => ({ initializeDomainRuntime: () => {} }))

const getSessionContext = vi.fn()
vi.mock('@/shared/auth/session', () => ({ getSessionContext: (...args: unknown[]) => getSessionContext(...args) }))

const activateProduct = vi.fn()
const deactivateProduct = vi.fn()
vi.mock('@/domains/catalog/catalog.service', () => ({
  catalogDomainService: {
    activateProduct: (...args: unknown[]) => activateProduct(...args),
    deactivateProduct: (...args: unknown[]) => deactivateProduct(...args),
  },
}))

import { POST, DELETE } from './route'

function makeSession(permissions: Record<string, string[]> = { produtos: ['view', 'edit'] }) {
  return { tenantId: 't1', userId: 'u1', isOwner: false, permissions }
}

const params = { params: Promise.resolve({ id: 'prod-1' }) }

describe('POST /api/catalog/products/[id]/activate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('403 sem permissão produtos:edit', async () => {
    getSessionContext.mockResolvedValue(makeSession({}))
    const res = await POST(new Request('http://x'), params)
    expect(res.status).toBe(403)
    expect(activateProduct).not.toHaveBeenCalled()
  })

  it('201 com permissão produtos:edit', async () => {
    getSessionContext.mockResolvedValue(makeSession())
    activateProduct.mockResolvedValue({ id: 'prod-1', active: true })
    const res = await POST(new Request('http://x'), params)
    expect(res.status).toBe(201)
    expect(activateProduct).toHaveBeenCalledWith('t1', 'prod-1')
  })
})

describe('DELETE /api/catalog/products/[id]/activate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('403 sem permissão produtos:edit', async () => {
    getSessionContext.mockResolvedValue(makeSession({}))
    const res = await DELETE(new Request('http://x'), params)
    expect(res.status).toBe(403)
    expect(deactivateProduct).not.toHaveBeenCalled()
  })

  it('204 com permissão produtos:edit', async () => {
    getSessionContext.mockResolvedValue(makeSession())
    deactivateProduct.mockResolvedValue(undefined)
    const res = await DELETE(new Request('http://x'), params)
    expect(res.status).toBe(204)
    expect(deactivateProduct).toHaveBeenCalledWith('t1', 'prod-1')
  })
})
