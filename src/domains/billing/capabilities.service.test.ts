import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName } from '@prisma/client'
import { getTenantCapabilities } from './capabilities.service'
import { featureGuard } from './feature-guard'

vi.mock('./feature-guard', async (orig) => {
  const mod = await orig<typeof import('./feature-guard')>()
  return { ...mod, featureGuard: { resolveGate: vi.fn() } }
})

describe('getTenantCapabilities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolve o gate de cada capacidade gateável', async () => {
    vi.mocked(featureGuard.resolveGate).mockResolvedValue({
      allowed: false, currentPlan: PlanName.STARTER, requiredPlan: PlanName.PRO, requiredPlanLabel: 'Pro',
    })
    const caps = await getTenantCapabilities('tenant-1')
    expect(caps.length).toBeGreaterThan(0)
    const reports = caps.find((c) => c.key === 'reports_advanced')
    expect(reports).toEqual({ key: 'reports_advanced', allowed: false, requiredPlan: 'PRO', requiredPlanLabel: 'Pro' })
    expect(featureGuard.resolveGate).toHaveBeenCalled()
  })
})
