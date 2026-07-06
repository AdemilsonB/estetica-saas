import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'
import { isEssential } from '@/shared/permissions/capability-registry'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { featureGuard } from '@/domains/billing/feature-guard'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)

    const sections = await Promise.all(
      NAV_REGISTRY.map(async (s) => {
        // Essenciais nunca bloqueiam.
        if (isEssential(s.key)) {
          return { ...s, locked: false, requiredPlan: null, requiredPlanLabel: null }
        }
        const gate = await featureGuard.resolveGate(session.tenantId, s.key)
        return {
          ...s,
          locked: !gate.allowed,
          requiredPlan: gate.requiredPlan,
          requiredPlanLabel: gate.requiredPlanLabel,
        }
      }),
    )

    return Response.json(sections)
  } catch (error) {
    return handleApiError(error)
  }
}
