import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { makeCustomer } from '@/shared/test/factories/customer.factory'
import { CustomerService } from './customer.service'
import { CustomerNotFoundError } from '@/shared/errors'

const TENANT_ID = 'tenant-1'
const CUSTOMER_ID = 'customer-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CustomerService.delete', () => {
  it('lança CustomerNotFoundError se cliente não existe', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const service = new CustomerService()
    await expect(service.delete(TENANT_ID, CUSTOMER_ID)).rejects.toThrow(
      CustomerNotFoundError,
    )
  })

  it('arquiva cliente ativo com softDelete', async () => {
    const customer = makeCustomer({ id: CUSTOMER_ID, tenantId: TENANT_ID })
    prismaMock.customer.findFirst.mockResolvedValue(customer)
    prismaMock.customer.update.mockResolvedValue({
      ...customer,
      deletedAt: new Date(),
    })

    const service = new CustomerService()
    await service.delete(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    )
  })
})

describe('CustomerService.restore', () => {
  it('lança CustomerNotFoundError se cliente não existe nem arquivado', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const service = new CustomerService()
    await expect(service.restore(TENANT_ID, CUSTOMER_ID)).rejects.toThrow(
      CustomerNotFoundError,
    )
  })

  it('restaura cliente arquivado', async () => {
    const archived = makeCustomer({
      id: CUSTOMER_ID,
      tenantId: TENANT_ID,
      deletedAt: new Date(),
    })
    prismaMock.customer.findFirst.mockResolvedValue(archived)
    prismaMock.customer.update.mockResolvedValue({ ...archived, deletedAt: null })

    const service = new CustomerService()
    await service.restore(TENANT_ID, CUSTOMER_ID)

    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { deletedAt: null },
      }),
    )
  })
})
