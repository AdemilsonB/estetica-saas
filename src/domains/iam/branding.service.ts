import { NotFoundError } from '@/shared/errors'
import { eventBus } from '@/shared/events/event-bus'
import type { BrandingRepository } from './branding.repository'
import { brandingRepository } from './branding.repository'
import type { UpdateBrandingInput } from './branding.schemas'

export class BrandingService {
  constructor(private readonly repo: BrandingRepository) {}

  async get(tenantId: string) {
    const config = await this.repo.findByTenant(tenantId)
    if (!config) throw new NotFoundError('BrandingConfig')
    return config
  }

  async update(tenantId: string, input: UpdateBrandingInput) {
    const updated = await this.repo.update(tenantId, input)
    eventBus.publish({
      type: 'tenant.branding.updated',
      payload: { tenantId, changes: input },
    })
    return updated
  }
}

export const brandingService = new BrandingService(brandingRepository)
