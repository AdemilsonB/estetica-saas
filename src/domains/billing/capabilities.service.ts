import { getGateableCapabilities } from '@/shared/permissions/capability-registry'
import { featureGuard } from './feature-guard'

export type CapabilityStatus = {
  key: string
  allowed: boolean
  requiredPlan: string | null
  requiredPlanLabel: string | null
}

export async function getTenantCapabilities(tenantId: string): Promise<CapabilityStatus[]> {
  const caps = getGateableCapabilities()
  return Promise.all(
    caps.map(async (cap) => {
      const gate = await featureGuard.resolveGate(tenantId, cap.key)
      return {
        key: cap.key,
        allowed: gate.allowed,
        requiredPlan: gate.requiredPlan,
        requiredPlanLabel: gate.requiredPlanLabel,
      }
    }),
  )
}
