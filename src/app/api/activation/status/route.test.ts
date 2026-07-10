import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionContext = vi.fn()
vi.mock('@/shared/auth/session', () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }))
vi.mock('@/app/api/_lib/runtime', () => ({ initializeDomainRuntime: () => {} }))

const getStatus = vi.fn()
vi.mock('@/domains/activation/activation.service', () => ({
  activationService: { getStatus: (...a: unknown[]) => getStatus(...a) },
}))

import { GET } from './route'

describe('GET /api/activation/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 200 com o status do tenant da sessão', async () => {
    getSessionContext.mockResolvedValue({ tenantId: 't1', userId: 'u1', isOwner: true, permissions: {} })
    getStatus.mockResolvedValue({
      categorias: false,
      servicos: false,
      clientes: false,
      equipe: false,
      configuracoes: { dadosNegocio: false, horarios: false, branding: false, whatsapp: false, done: false },
    })

    const res = await GET(new Request('http://x/api/activation/status'))

    expect(res.status).toBe(200)
    expect(getStatus).toHaveBeenCalledWith('t1')
    const body = await res.json()
    expect(body.configuracoes.done).toBe(false)
  })

  it('retorna 401 quando a sessão é inválida', async () => {
    const { UnauthorizedError } = await import('@/shared/errors')
    getSessionContext.mockRejectedValue(new UnauthorizedError('sem sessão'))

    const res = await GET(new Request('http://x/api/activation/status'))

    expect(res.status).toBe(401)
    expect(getStatus).not.toHaveBeenCalled()
  })
})
