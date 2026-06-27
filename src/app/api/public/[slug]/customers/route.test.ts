import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/domains/scheduling/public-booking.repository', () => ({
  publicBookingRepository: { findTenantBySlug: vi.fn() },
}))
vi.mock('@/shared/rate-limit/public-rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))
vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'
import { prisma } from '@/shared/database/prisma'
import { POST } from './route'

const TENANT_ID = 'tenant-1'
const SLUG = 'studio-bella'
const VALID_CPF = '111.444.777-35'
const INVALID_CPF = '111.444.777-36'

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/public/${SLUG}/customers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeContext() {
  return { params: Promise.resolve({ slug: SLUG }) }
}

function validBody(cpf: string) {
  return {
    name: 'Maria Cliente',
    cpf,
    phone: '11999990000',
    email: 'maria@example.com',
    birthDate: '1990-01-01',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true } as never)
  vi.mocked(publicBookingRepository.findTenantBySlug).mockResolvedValue({ id: TENANT_ID } as never)
})

describe('POST /api/public/[slug]/customers', () => {
  it('rejeita CPF com dígito verificador inválido', async () => {
    const res = await POST(makeRequest(validBody(INVALID_CPF)), makeContext())

    expect(res.status).toBe(422)
    expect(prisma.customer.create).not.toHaveBeenCalled()
  })

  it('cria o cliente quando o CPF é válido e não há cadastro existente', async () => {
    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.customer.create).mockResolvedValue({ id: 'customer-1', name: 'Maria Cliente' } as never)

    const res = await POST(makeRequest(validBody(VALID_CPF)), makeContext())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe('customer-1')
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID, cpf: '11144477735' }) }),
    )
  })
})
