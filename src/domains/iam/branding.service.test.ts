import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrandingService } from './branding.service'
import type { BrandingRepository } from './branding.repository'
import { eventBus } from '@/shared/events/event-bus'

vi.mock('@/shared/events/event-bus', () => ({
  eventBus: { publish: vi.fn() },
}))

const TENANT_ID = 'tenant-abc'

const defaultBranding = {
  id: 'branding-1',
  tenantId: TENANT_ID,
  logoUrl: null,
  primaryColor: '#191919',
  secondaryColor: '#6366f1',
  accentColor: '#f59e0b',
  backgroundColor: '#f8f8f7',
  fontFamily: 'inter',
  borderRadius: 'medium',
  colorScheme: 'light',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

function makeRepoMock(): BrandingRepository {
  return {
    findByTenant: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  } as unknown as BrandingRepository
}

describe('BrandingService', () => {
  let repo: BrandingRepository
  let service: BrandingService

  beforeEach(() => {
    repo = makeRepoMock()
    service = new BrandingService(repo)
    vi.clearAllMocks()
  })

  describe('get', () => {
    it('retorna BrandingConfig do tenant', async () => {
      vi.mocked(repo.findByTenant).mockResolvedValue(defaultBranding)
      const result = await service.get(TENANT_ID)
      expect(result).toEqual(defaultBranding)
    })

    it('lança NotFoundError se não encontrado', async () => {
      vi.mocked(repo.findByTenant).mockResolvedValue(null)
      await expect(service.get(TENANT_ID)).rejects.toThrow('BrandingConfig')
    })
  })

  describe('update', () => {
    it('atualiza e publica evento tenant.branding.updated', async () => {
      const updated = { ...defaultBranding, primaryColor: '#ff0000' }
      vi.mocked(repo.update).mockResolvedValue(updated)
      const result = await service.update(TENANT_ID, { primaryColor: '#ff0000' })
      expect(result).toEqual(updated)
      expect(eventBus.publish).toHaveBeenCalledWith({
        type: 'tenant.branding.updated',
        payload: { tenantId: TENANT_ID, changes: { primaryColor: '#ff0000' } },
      })
    })
  })
})
