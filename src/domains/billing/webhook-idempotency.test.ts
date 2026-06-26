import { describe, it, expect, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { claimStripeEvent, releaseStripeEvent } from './webhook-idempotency'

describe('claimStripeEvent', () => {
  beforeEach(() => {
    prismaMock.processedStripeEvent.create.mockReset()
  })

  it('retorna true e registra o evento no primeiro processamento', async () => {
    prismaMock.processedStripeEvent.create.mockResolvedValue({
      eventId: 'evt_1',
      type: 'checkout.session.completed',
      createdAt: new Date(),
    })

    const result = await claimStripeEvent('evt_1', 'checkout.session.completed')

    expect(result).toBe(true)
    expect(prismaMock.processedStripeEvent.create).toHaveBeenCalledWith({
      data: { eventId: 'evt_1', type: 'checkout.session.completed' },
    })
  })

  it('retorna false quando o evento já foi processado (violação de PK P2002)', async () => {
    prismaMock.processedStripeEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    )

    const result = await claimStripeEvent('evt_1', 'checkout.session.completed')

    expect(result).toBe(false)
  })

  it('propaga erros que não sejam de duplicidade', async () => {
    prismaMock.processedStripeEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Connection lost', {
        code: 'P1001',
        clientVersion: 'test',
      }),
    )

    await expect(claimStripeEvent('evt_1', 'checkout.session.completed')).rejects.toThrow()
  })
})

describe('releaseStripeEvent', () => {
  it('remove o registro do evento para permitir reprocessamento', async () => {
    prismaMock.processedStripeEvent.deleteMany.mockResolvedValue({ count: 1 })

    await releaseStripeEvent('evt_1')

    expect(prismaMock.processedStripeEvent.deleteMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_1' },
    })
  })
})
