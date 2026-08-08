import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SchedulingService } from '../scheduling.service'
import { PriceType } from '@prisma/client'

vi.mock('@/shared/database/prisma', () => ({
  prisma: { $transaction: vi.fn() },
}))
vi.mock('@/shared/events/event-bus', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}))
vi.mock('../availability.service', () => ({
  availabilityService: { ensureSlotAvailable: vi.fn(), ensureSlotAvailableExcluding: vi.fn() },
}))
vi.mock('../appointment.repository', () => ({
  appointmentRepository: { findById: vi.fn(), update: vi.fn(), countThisMonth: vi.fn(), create: vi.fn(), updateStatus: vi.fn() },
}))
vi.mock('@/domains/billing/feature-guard', () => ({
  featureGuard: { assertWithinLimit: vi.fn() },
}))
vi.mock('@/shared/queue/jobs/appointment-reminder', () => ({
  scheduleAppointmentReminder: vi.fn(),
  cancelAppointmentReminder: vi.fn(),
}))
vi.mock('../service.repository', () => ({
  catalogServiceRepository: { count: vi.fn(), create: vi.fn(), findById: vi.fn(), update: vi.fn() },
}))

import { catalogServiceRepository } from '../service.repository'
import { featureGuard } from '@/domains/billing/feature-guard'

const baseCreateInput = {
  name: 'Escova',
  duration: 45,
  price: 80,
  priceType: PriceType.FIXED,
  active: true,
}

describe('SchedulingService — retorno programado (returnIntervalDays)', () => {
  let service: SchedulingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SchedulingService()
  })

  describe('createService', () => {
    beforeEach(() => {
      vi.mocked(catalogServiceRepository.count).mockResolvedValue(1)
      vi.mocked(featureGuard.assertWithinLimit).mockResolvedValue(undefined)
      vi.mocked(catalogServiceRepository.create).mockResolvedValue({ id: 'svc-1' } as never)
    })

    it('repassa returnIntervalDays ao repositório', async () => {
      await service.createService('tenant-1', {
        ...baseCreateInput,
        returnIntervalDays: 30,
      } as never)

      expect(catalogServiceRepository.create).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ returnIntervalDays: 30 }),
      )
    })

    it('repassa returnIntervalDays undefined quando o campo não foi enviado', async () => {
      await service.createService('tenant-1', { ...baseCreateInput } as never)

      expect(catalogServiceRepository.create).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ returnIntervalDays: undefined }),
      )
    })
  })

  describe('updateService', () => {
    beforeEach(() => {
      vi.mocked(catalogServiceRepository.findById).mockResolvedValue({ id: 'svc-1' } as never)
    })

    it('repassa returnIntervalDays ao repositório', async () => {
      await service.updateService('tenant-1', 'svc-1', { returnIntervalDays: 60 } as never)

      expect(catalogServiceRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        'svc-1',
        expect.objectContaining({ returnIntervalDays: 60 }),
      )
    })

    it('repassa null explícito — é como o tenant desliga o lembrete deste serviço', async () => {
      await service.updateService('tenant-1', 'svc-1', { returnIntervalDays: null } as never)

      expect(catalogServiceRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        'svc-1',
        expect.objectContaining({ returnIntervalDays: null }),
      )
    })

    it('não inclui returnIntervalDays quando o campo não foi enviado na atualização', async () => {
      await service.updateService('tenant-1', 'svc-1', { name: 'Escova premium' } as never)

      const call = vi.mocked(catalogServiceRepository.update).mock.calls[0]
      expect(call[2]).not.toHaveProperty('returnIntervalDays')
    })
  })
})
