import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/domains/crm/customer.service', () => ({
  customerService: { getFavorites: vi.fn(), toggleFavorite: vi.fn() },
}))
vi.mock('@/domains/scheduling/public-booking.repository', () => ({
  publicBookingRepository: { findTenantBySlug: vi.fn() },
}))

import { customerService } from '@/domains/crm/customer.service'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { createPublicSession } from '@/shared/auth/public-session'
import { GET, POST } from './route'

const TENANT_ID = 'tenant-1'
const CUSTOMER_ID = 'customer-1'
const SLUG = 'studio-bella'

function makeRequest(method: string, body?: unknown, withSession = true) {
  const headers: Record<string, string> = {}
  if (withSession) {
    const token = createPublicSession(CUSTOMER_ID, TENANT_ID, SLUG)
    headers.cookie = `agende_pub_sess=${token}`
  }
  if (body) headers['content-type'] = 'application/json'
  return new Request(`http://localhost/api/public/${SLUG}/favorites`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function makeContext() {
  return { params: Promise.resolve({ slug: SLUG }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(publicBookingRepository.findTenantBySlug).mockResolvedValue({ id: TENANT_ID } as never)
})

describe('GET /api/public/[slug]/favorites', () => {
  it('retorna 401 sem sessão', async () => {
    const res = await GET(makeRequest('GET', undefined, false), makeContext())
    expect(res.status).toBe(401)
  })

  it('retorna os favoritos do cliente autenticado', async () => {
    vi.mocked(customerService.getFavorites).mockResolvedValue({
      favoriteServiceIds: ['service-1'],
      favoritePackageIds: [],
    })

    const res = await GET(makeRequest('GET'), makeContext())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.favoriteServiceIds).toEqual(['service-1'])
    expect(customerService.getFavorites).toHaveBeenCalledWith(TENANT_ID, CUSTOMER_ID)
  })
})

describe('POST /api/public/[slug]/favorites', () => {
  it('retorna 401 sem sessão', async () => {
    const res = await POST(makeRequest('POST', { kind: 'service', itemId: 'x' }, false), makeContext())
    expect(res.status).toBe(401)
  })

  it('retorna 422 com corpo inválido', async () => {
    const res = await POST(makeRequest('POST', { kind: 'invalid', itemId: '' }), makeContext())
    expect(res.status).toBe(422)
  })

  it('alterna o favorito e retorna o resultado', async () => {
    vi.mocked(customerService.toggleFavorite).mockResolvedValue({ favorited: true })

    const res = await POST(makeRequest('POST', { kind: 'service', itemId: 'service-1' }), makeContext())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ favorited: true })
    expect(customerService.toggleFavorite).toHaveBeenCalledWith(TENANT_ID, CUSTOMER_ID, 'service', 'service-1')
  })
})
