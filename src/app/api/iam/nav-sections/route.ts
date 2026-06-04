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

    const enabledConfigs = await prisma.planFeatureConfig.findMany({
      where: { plan: tenant?.plan, enabled: true },
      select: { sectionKey: true },
    })

    const enabledKeys = new Set(enabledConfigs.map((c) => c.sectionKey))

    const sections = enabledKeys.size === 0
      ? NAV_REGISTRY
      : NAV_REGISTRY.filter((s) => enabledKeys.has(s.key))

    return Response.json(sections)
  } catch (error) {
    return handleApiError(error)
  }
}
