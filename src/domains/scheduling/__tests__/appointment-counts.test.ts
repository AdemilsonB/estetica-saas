import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { AppointmentRepository } from '../appointment.repository'
import { AppointmentStatus } from '@prisma/client'

describe('AppointmentRepository.countByDateRange', () => {
  let repo: AppointmentRepository

  beforeEach(() => {
    repo = new AppointmentRepository()
  })

  it('retorna contagem zerada quando não há agendamentos', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([])
    const result = await repo.countByDateRange('tenant-1', new Date('2026-07-01'), new Date('2026-07-31'))
    expect(result).toEqual({})
  })

  it('agrupa agendamentos por data local e exclui CANCELLED e NO_SHOW', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      { startsAt: new Date('2026-07-05T10:00:00-03:00'), status: AppointmentStatus.SCHEDULED } as any,
      { startsAt: new Date('2026-07-05T14:00:00-03:00'), status: AppointmentStatus.CONFIRMED } as any,
      { startsAt: new Date('2026-07-10T11:00:00-03:00'), status: AppointmentStatus.COMPLETED } as any,
    ])
    const result = await repo.countByDateRange('tenant-1', new Date('2026-07-01'), new Date('2026-07-31'))
    expect(result['2026-07-05']).toBe(2)
    expect(result['2026-07-10']).toBe(1)
    expect(Object.keys(result)).toHaveLength(2)
  })

  it('filtra pelo tenantId corretamente', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([])
    await repo.countByDateRange('tenant-abc', new Date('2026-07-01'), new Date('2026-07-31'))
    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-abc' })
      })
    )
  })
})
