import { prisma } from '@/shared/database/prisma'
import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { plan: true },
    })

    const configs = await prisma.planFeatureConfig.findMany({
      where: { plan: tenant?.plan },
      select: { sectionKey: true, enabled: true },
    })

    const configMap = new Map(configs.map((c) => [c.sectionKey, c.enabled]))

    // Opt-out: seções sem entrada em PlanFeatureConfig são habilitadas por padrão.
    // Apenas enabled: false bloqueia explicitamente.
    const sections = NAV_REGISTRY.filter((s) => configMap.get(s.key) !== false)

    return Response.json(sections)
  } catch (error) {
    return handleApiError(error)
  }
}
