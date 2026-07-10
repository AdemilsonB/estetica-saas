import { EXTRA_PERMISSION_REGISTRY } from '@/shared/permissions/extra-permission-registry'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { featureGuard } from '@/domains/billing/feature-guard'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)

    const sections = await Promise.all(
      EXTRA_PERMISSION_REGISTRY.map(async (s) => {
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
