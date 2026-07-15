import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/app/api/_lib/runtime', () => ({ initializeDomainRuntime: () => {} }))

const getSessionContext = vi.fn()
vi.mock('@/shared/auth/session', () => ({ getSessionContext: (...args: unknown[]) => getSessionContext(...args) }))

const activateService = vi.fn()
const deactivateService = vi.fn()
vi.mock('@/domains/catalog/catalog.service', () => ({
  catalogDomainService: {
    activateService: (...args: unknown[]) => activateService(...args),
    deactivateService: (...args: unknown[]) => deactivateService(...args),
  },
}))

import { POST, DELETE } from './route'

function makeSession(permissions: Record<string, string[]> = { servicos: ['view', 'edit'] }) {
  return { tenantId: 't1', userId: 'u1', isOwner: false, permissions }
}

const params = { params: Promise.resolve({ id: 'svc-1' }) }

describe('POST /api/catalog/services/[id]/activate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('403 sem permissão servicos:edit', async () => {
    getSessionContext.mockResolvedValue(makeSession({}))
    const res = await POST(new Request('http://x'), params)
    expect(res.status).toBe(403)
    expect(activateService).not.toHaveBeenCalled()
  })

  it('201 com permissão servicos:edit', async () => {
    getSessionContext.mockResolvedValue(makeSession())
    activateService.mockResolvedValue({ id: 'svc-1', active: true })
    const res = await POST(new Request('http://x'), params)
    expect(res.status).toBe(201)
    expect(activateService).toHaveBeenCalledWith('t1', 'svc-1')
  })
})

describe('DELETE /api/catalog/services/[id]/activate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('403 sem permissão servicos:edit', async () => {
    getSessionContext.mockResolvedValue(makeSession({}))
    const res = await DELETE(new Request('http://x'), params)
    expect(res.status).toBe(403)
    expect(deactivateService).not.toHaveBeenCalled()
  })

  it('204 com permissão servicos:edit', async () => {
    getSessionContext.mockResolvedValue(makeSession())
    deactivateService.mockResolvedValue(undefined)
    const res = await DELETE(new Request('http://x'), params)
    expect(res.status).toBe(204)
    expect(deactivateService).toHaveBeenCalledWith('t1', 'svc-1')
  })
})
