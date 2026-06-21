import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { makeCustomer } from '@/shared/test/factories/customer.factory'
import { CustomerRepository } from './customer.repository'

const TENANT_ID = 'tenant-1'
const CUSTOMER_ID = 'customer-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CustomerRepository — soft delete', () => {
  it('findAll filtra deletedAt: null', async () => {
    prismaMock.customer.findMany.mockResolvedValue([])
    prismaMock.customer.count.mockResolvedValue(0)

    const repo = new CustomerRepository()
    await repo.findAll(TENANT_ID)

    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    )
  })

  it('findById filtra deletedAt: null', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const repo = new CustomerRepository()
    await repo.findById(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    )
  })

  it('findByPhone filtra deletedAt: null', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const repo = new CustomerRepository()
    await repo.findByPhone(TENANT_ID, '11999999999')

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    )
  })

  it('softDelete: chama update com deletedAt preenchido', async () => {
    const archived = makeCustomer({ id: CUSTOMER_ID, deletedAt: new Date() })
    prismaMock.customer.update.mockResolvedValue(archived)

    const repo = new CustomerRepository()
    await repo.softDelete(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUSTOMER_ID, tenantId: TENANT_ID },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    )
  })

  it('restore: chama update com deletedAt: null', async () => {
    const restored = makeCustomer({ id: CUSTOMER_ID, deletedAt: null })
    prismaMock.customer.update.mockResolvedValue(restored)

    const repo = new CustomerRepository()
    await repo.restore(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUSTOMER_ID, tenantId: TENANT_ID },
        data: { deletedAt: null },
      }),
    )
  })

  it('findDeletedById: busca sem filtro de deletedAt', async () => {
    const archived = makeCustomer({ id: CUSTOMER_ID, deletedAt: new Date() })
    prismaMock.customer.findFirst.mockResolvedValue(archived)

    const repo = new CustomerRepository()
    const result = await repo.findDeletedById(TENANT_ID, CUSTOMER_ID)

    expect(result).toEqual(archived)
    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID, tenantId: TENANT_ID },
    })
  })
})
