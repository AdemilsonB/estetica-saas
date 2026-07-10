import { activationRepository } from './activation.repository'
import { computeActivationStatus } from './activation.compute'
import type { ActivationStatus } from './types'

export class ActivationService {
  async getStatus(tenantId: string): Promise<ActivationStatus> {
    const counts = await activationRepository.getActivationCounts(tenantId)
    return computeActivationStatus(counts)
  }
}

export const activationService = new ActivationService()
