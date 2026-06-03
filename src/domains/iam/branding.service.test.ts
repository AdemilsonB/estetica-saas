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
  primaryColor: '#c8916a',
  secondaryColor: null,
  accentColor: '#fdf0e8',
  backgroundColor: '#faf7f4',
  borderColor: '#e8ddd3',
  foregroundColor: '#3d2b1f',
  mutedColor: '#8a7060',
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

    it('retorna defaults quando não encontrado — primaryColor é #c8916a', async () => {
      vi.mocked(repo.findByTenant).mockResolvedValue(null)
      const result = await service.get(TENANT_ID)
      expect(result.primaryColor).toBe('#c8916a')
      expect(result.tenantId).toBe(TENANT_ID)
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
