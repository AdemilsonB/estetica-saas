import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '../public-booking.repository'

vi.mock('@/shared/database/prisma', () => ({
  prisma: { appointment: { groupBy: vi.fn() } },
}))

describe('findMostBookedItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna o serviço de maior volume acima do mínimo', async () => {
    vi.mocked(prisma.appointment.groupBy)
      // 1ª chamada: por serviceId
      .mockResolvedValueOnce([{ serviceId: 's1', _count: { _all: 8 } }] as never)
      // 2ª chamada: por packageId
      .mockResolvedValueOnce([{ packageId: 'p1', _count: { _all: 6 } }] as never)

    const result = await publicBookingRepository.findMostBookedItem('t1')
    expect(result).toEqual({ type: 'service', id: 's1' })
  })

  it('retorna null quando nada cruza o mínimo de 5', async () => {
    vi.mocked(prisma.appointment.groupBy)
      .mockResolvedValueOnce([{ serviceId: 's1', _count: { _all: 3 } }] as never)
      .mockResolvedValueOnce([{ packageId: 'p1', _count: { _all: 2 } }] as never)

    const result = await publicBookingRepository.findMostBookedItem('t1')
    expect(result).toBeNull()
  })

  it('escolhe o pacote quando ele tem mais volume que o serviço', async () => {
    vi.mocked(prisma.appointment.groupBy)
      .mockResolvedValueOnce([{ serviceId: 's1', _count: { _all: 6 } }] as never)
      .mockResolvedValueOnce([{ packageId: 'p1', _count: { _all: 9 } }] as never)

    const result = await publicBookingRepository.findMostBookedItem('t1')
    expect(result).toEqual({ type: 'package', id: 'p1' })
  })
})
