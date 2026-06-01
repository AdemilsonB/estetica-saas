import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { CustomerRepository } from './customer.repository'

const TENANT_ID = 'tenant-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CustomerRepository.findAll — filtros avançados', () => {
  it('onlyVip: passa isVip: true no where do Prisma', async () => {
    prismaMock.customer.findMany.mockResolvedValue([])
    prismaMock.customer.count.mockResolvedValue(0)

    const repo = new CustomerRepository()
    await repo.findAll(TENANT_ID, { onlyVip: true })

    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isVip: true, tenantId: TENANT_ID }),
      }),
    )
  })

  it('birthdayMonth: executa $queryRaw com EXTRACT e intersecta IDs', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }])
    prismaMock.customer.findMany.mockResolvedValue([])
    prismaMock.customer.count.mockResolvedValue(0)

    const repo = new CustomerRepository()
    await repo.findAll(TENANT_ID, { birthdayMonth: 6 })

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['c1', 'c2'] } }),
      }),
    )
  })

  it('hasPendingDebt: executa $queryRaw e passa IDs ao Prisma', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'c3' }])
    prismaMock.customer.findMany.mockResolvedValue([])
    prismaMock.customer.count.mockResolvedValue(0)

    const repo = new CustomerRepository()
    await repo.findAll(TENANT_ID, { hasPendingDebt: true })

    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['c3'] } }),
      }),
    )
  })

  it('múltiplos filtros raw: intersecta os conjuntos de IDs', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }])
      .mockResolvedValueOnce([{ id: 'c2' }, { id: 'c3' }])
    prismaMock.customer.findMany.mockResolvedValue([])
    prismaMock.customer.count.mockResolvedValue(0)

    const repo = new CustomerRepository()
    await repo.findAll(TENANT_ID, { noAppointmentDays: 30, hasPendingDebt: true })

    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['c2'] } }),
      }),
    )
  })

  it('sem filtros: não executa $queryRaw', async () => {
    prismaMock.customer.findMany.mockResolvedValue([])
    prismaMock.customer.count.mockResolvedValue(0)

    const repo = new CustomerRepository()
    await repo.findAll(TENANT_ID, {})

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })
})
