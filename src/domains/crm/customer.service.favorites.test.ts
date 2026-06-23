import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { makeCustomer } from '@/shared/test/factories/customer.factory'
import { CustomerService } from './customer.service'
import { CustomerNotFoundError } from '@/shared/errors'
import { eventBus } from '@/shared/events/event-bus'

const TENANT_ID = 'tenant-1'
const CUSTOMER_ID = 'customer-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CustomerService.getFavorites', () => {
  it('lança CustomerNotFoundError se cliente não existe', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const service = new CustomerService()
    await expect(service.getFavorites(TENANT_ID, CUSTOMER_ID)).rejects.toThrow(CustomerNotFoundError)
  })

  it('retorna as listas de favoritos do cliente', async () => {
    const customer = makeCustomer({
      id: CUSTOMER_ID,
      tenantId: TENANT_ID,
      favoriteServiceIds: ['service-1'],
      favoritePackageIds: ['package-1'],
    })
    prismaMock.customer.findFirst.mockResolvedValue(customer)

    const service = new CustomerService()
    const result = await service.getFavorites(TENANT_ID, CUSTOMER_ID)

    expect(result).toEqual({
      favoriteServiceIds: ['service-1'],
      favoritePackageIds: ['package-1'],
    })
  })
})

describe('CustomerService.toggleFavorite', () => {
  it('lança CustomerNotFoundError se cliente não existe', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null)

    const service = new CustomerService()
    await expect(
      service.toggleFavorite(TENANT_ID, CUSTOMER_ID, 'service', 'service-1'),
    ).rejects.toThrow(CustomerNotFoundError)
  })

  it('adiciona o item aos favoritos quando ainda não está favoritado', async () => {
    const customer = makeCustomer({ id: CUSTOMER_ID, tenantId: TENANT_ID, favoriteServiceIds: [] })
    prismaMock.customer.findFirst.mockResolvedValue(customer)
    prismaMock.customer.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.customer.findFirstOrThrow.mockResolvedValue({
      ...customer,
      favoriteServiceIds: ['service-1'],
    })

    const publishSpy = vi.spyOn(eventBus, 'publish')

    const service = new CustomerService()
    const result = await service.toggleFavorite(TENANT_ID, CUSTOMER_ID, 'service', 'service-1')

    expect(result).toEqual({ favorited: true })
    expect(prismaMock.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUSTOMER_ID, tenantId: TENANT_ID, deletedAt: null },
        data: { favoriteServiceIds: ['service-1'] },
      }),
    )
    expect(publishSpy).toHaveBeenCalledWith({
      type: 'crm.customer.favorite_toggled',
      payload: { tenantId: TENANT_ID, customerId: CUSTOMER_ID, kind: 'service', itemId: 'service-1', favorited: true },
    })
  })

  it('remove o item dos favoritos quando já está favoritado', async () => {
    const customer = makeCustomer({
      id: CUSTOMER_ID,
      tenantId: TENANT_ID,
      favoritePackageIds: ['package-1', 'package-2'],
    })
    prismaMock.customer.findFirst.mockResolvedValue(customer)
    prismaMock.customer.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.customer.findFirstOrThrow.mockResolvedValue({
      ...customer,
      favoritePackageIds: ['package-2'],
    })

    const service = new CustomerService()
    const result = await service.toggleFavorite(TENANT_ID, CUSTOMER_ID, 'package', 'package-1')

    expect(result).toEqual({ favorited: false })
    expect(prismaMock.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { favoritePackageIds: ['package-2'] },
      }),
    )
  })
})
