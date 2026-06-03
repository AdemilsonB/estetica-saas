import { eventBus } from '@/shared/events/event-bus'
import type { BrandingRepository } from './branding.repository'
import { brandingRepository } from './branding.repository'
import type { BrandingUpdateData } from './branding.schemas'

const BRANDING_DEFAULTS = {
  logoUrl: null,
  primaryColor: '#c8916a',
  accentColor: '#fdf0e8',
  backgroundColor: '#faf7f4',
  borderColor: '#e8ddd3',
  foregroundColor: '#3d2b1f',
  mutedColor: '#8a7060',
  fontFamily: 'inter',
  borderRadius: 'medium',
  colorScheme: 'light',
}

export class BrandingService {
  constructor(private readonly repo: BrandingRepository) {}

  async get(tenantId: string) {
    const config = await this.repo.findByTenant(tenantId)
    return config ?? { ...BRANDING_DEFAULTS, tenantId, id: '', createdAt: new Date(), updatedAt: new Date() }
  }

  async update(tenantId: string, input: BrandingUpdateData) {
    const updated = await this.repo.update(tenantId, input)
    eventBus.publish({
      type: 'tenant.branding.updated',
      payload: { tenantId, changes: input },
    })
    return updated
  }
}

export const brandingService = new BrandingService(brandingRepository)
