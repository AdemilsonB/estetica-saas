import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { makeCustomer } from '@/shared/test/factories/customer.factory'
import { CustomerService } from './customer.service'

vi.mock('@/domains/billing/feature-guard', () => ({
  featureGuard: { assertWithinLimit: vi.fn() },
}))

import { featureGuard } from '@/domains/billing/feature-guard'

const TENANT_ID = 'tenant-1'

describe('CustomerService.create — enforcement de limite de plano', () => {
  let service: CustomerService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CustomerService()
  })

  it('conta os clientes do tenant e assevera o limite antes de criar', async () => {
    prismaMock.customer.count.mockResolvedValue(5)
    vi.mocked(featureGuard.assertWithinLimit).mockResolvedValue(undefined)
    prismaMock.customer.create.mockResolvedValue(
      makeCustomer({ tenantId: TENANT_ID, name: 'Ana' }),
    )

    await service.create(TENANT_ID, { name: 'Ana' } as never)

    expect(prismaMock.customer.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID, deletedAt: null } }),
    )
    expect(featureGuard.assertWithinLimit).toHaveBeenCalledWith(TENANT_ID, 'customers', 5)
    expect(prismaMock.customer.create).toHaveBeenCalled()
  })

  it('propaga o erro do featureGuard e não cria o cliente quando o limite é excedido', async () => {
    prismaMock.customer.count.mockResolvedValue(50)
    vi.mocked(featureGuard.assertWithinLimit).mockRejectedValue(new Error('Limite atingido'))

    await expect(service.create(TENANT_ID, { name: 'Ana' } as never)).rejects.toThrow(
      'Limite atingido',
    )

    expect(prismaMock.customer.create).not.toHaveBeenCalled()
  })
})
