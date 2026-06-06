import { schedulingPolicyRepository } from './scheduling-policy.repository'

export class SchedulingPolicyService {
  async getPolicy(tenantId: string) {
    return schedulingPolicyRepository.findOrCreateByTenant(tenantId)
  }

  async updatePolicy(
    tenantId: string,
    data: {
      paddingMinutes?: number
      minAdvanceMinutes?: number
      maxAdvanceDays?: number
      allowPublicBooking?: boolean
    },
  ) {
    return schedulingPolicyRepository.upsert(tenantId, data)
  }
}

export const schedulingPolicyService = new SchedulingPolicyService()
