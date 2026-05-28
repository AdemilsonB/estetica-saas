import { eventBus } from '@/shared/events/event-bus'
import type { BrandingRepository } from './branding.repository'
import { brandingRepository } from './branding.repository'
import type { BrandingUpdateData } from './branding.schemas'

const BRANDING_DEFAULTS = {
  logoUrl: null,
  primaryColor: '#e11d48',
  secondaryColor: '#6366f1',
  accentColor: '#f59e0b',
  backgroundColor: '#f8f8f7',
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
