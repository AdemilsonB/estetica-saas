import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { SchedulingService } from '../scheduling.service'
import { ServiceNotFoundError } from '@/shared/errors'

vi.mock('@/shared/database/prisma', () => ({ prisma: prismaMock }))
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
  catalogServiceRepository: { findById: vi.fn(), update: vi.fn() },
}))
vi.mock('../package.repository', () => ({
  packageRepository: { update: vi.fn() },
}))
vi.mock('../promotion.repository', () => ({
  promotionRepository: { update: vi.fn() },
}))

import { catalogServiceRepository } from '../service.repository'
import { packageRepository } from '../package.repository'
import { promotionRepository } from '../promotion.repository'

describe('SchedulingService — enquadramento de imagem (crop)', () => {
  let service: SchedulingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SchedulingService()
  })

  describe('updateService', () => {
    beforeEach(() => {
      vi.mocked(catalogServiceRepository.findById).mockResolvedValue({ id: 'svc-1' } as never)
    })

    it('lança ServiceNotFoundError quando o serviço não existe', async () => {
      vi.mocked(catalogServiceRepository.findById).mockResolvedValue(null)
      await expect(
        service.updateService('tenant-1', 'svc-999', { imageCropX: 0.5, imageCropY: 0.5, imageCropZoom: 1 }),
      ).rejects.toThrow(ServiceNotFoundError)
    })

    it('salva crop válido quando enviado sem nova imagem', async () => {
      await service.updateService('tenant-1', 'svc-1', {
        imageCropX: 0.3,
        imageCropY: 0.4,
        imageCropZoom: 2,
      })

      expect(catalogServiceRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        'svc-1',
        expect.objectContaining({ imageCropX: 0.3, imageCropY: 0.4, imageCropZoom: 2 }),
      )
    })

    it('reseta o crop para null quando uma nova imagem é enviada sem crop junto', async () => {
      await service.updateService('tenant-1', 'svc-1', { imageUrl: 'https://cdn.test/novo.jpg' })

      expect(catalogServiceRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        'svc-1',
        expect.objectContaining({
          imageUrl: 'https://cdn.test/novo.jpg',
          imageCropX: null,
          imageCropY: null,
          imageCropZoom: null,
        }),
      )
    })

    it('preserva o crop quando enviado junto com a nova imagem na mesma chamada', async () => {
      await service.updateService('tenant-1', 'svc-1', {
        imageUrl: 'https://cdn.test/novo.jpg',
        imageCropX: 0.6,
        imageCropY: 0.2,
        imageCropZoom: 1.8,
      })

      expect(catalogServiceRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        'svc-1',
        expect.objectContaining({
          imageUrl: 'https://cdn.test/novo.jpg',
          imageCropX: 0.6,
          imageCropY: 0.2,
          imageCropZoom: 1.8,
        }),
      )
    })
  })

  describe('updatePackage', () => {
    it('reseta o crop para null quando uma nova imagem é enviada sem crop junto', async () => {
      await service.updatePackage('tenant-1', 'pkg-1', { imageUrl: 'https://cdn.test/novo.jpg' })

      expect(packageRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        'pkg-1',
        expect.objectContaining({ imageCropX: null, imageCropY: null, imageCropZoom: null }),
      )
    })

    it('preserva o crop quando enviado junto com a nova imagem', async () => {
      await service.updatePackage('tenant-1', 'pkg-1', {
        imageUrl: 'https://cdn.test/novo.jpg',
        imageCropX: 0.5,
        imageCropY: 0.5,
        imageCropZoom: 1.2,
      })

      expect(packageRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        'pkg-1',
        expect.objectContaining({ imageCropX: 0.5, imageCropY: 0.5, imageCropZoom: 1.2 }),
      )
    })
  })

  describe('updatePromotion', () => {
    it('reseta o crop para null quando uma nova imagem é enviada sem crop junto', async () => {
      await service.updatePromotion('tenant-1', 'promo-1', { imageUrl: 'https://cdn.test/novo.jpg' })

      expect(promotionRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        'promo-1',
        expect.objectContaining({ imageCropX: null, imageCropY: null, imageCropZoom: null }),
      )
    })

    it('preserva o crop quando enviado junto com a nova imagem', async () => {
      await service.updatePromotion('tenant-1', 'promo-1', {
        imageUrl: 'https://cdn.test/novo.jpg',
        imageCropX: 0.1,
        imageCropY: 0.9,
        imageCropZoom: 3,
      })

      expect(promotionRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        'promo-1',
        expect.objectContaining({ imageCropX: 0.1, imageCropY: 0.9, imageCropZoom: 3 }),
      )
    })
  })
})
