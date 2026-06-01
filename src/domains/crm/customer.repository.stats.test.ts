import { describe, it, expect } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { CustomerRepository } from './customer.repository'

const TENANT_ID = 'tenant-1'
const CUSTOMER_ID = 'cust-1'

describe('CustomerRepository.findByIdWithStats', () => {
  it('retorna customer com _count.appointments (NO_SHOW)', async () => {
    const mockResult = {
      id: CUSTOMER_ID,
      tenantId: TENANT_ID,
      name: 'Ana Lima',
      phone: '+5511999999999',
      email: null,
      notes: 'Cliente VIP',
      tags: [],
      consentGiven: false,
      consentDate: null,
      consentOrigin: null,
      birthDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      appointments: [],
      _count: { appointments: 2 },
    }

    prismaMock.customer.findFirst.mockResolvedValue(mockResult as never)

    const repo = new CustomerRepository()
    const result = await repo.findByIdWithStats(TENANT_ID, CUSTOMER_ID)

    expect(result).not.toBeNull()
    expect(result!._count.appointments).toBe(2)
    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUSTOMER_ID, tenantId: TENANT_ID },
      }),
    )
  })

  it('retorna null quando cliente não existe', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)
    const repo = new CustomerRepository()
    const result = await repo.findByIdWithStats(TENANT_ID, 'nao-existe')
    expect(result).toBeNull()
  })
})
