import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { featureGuard } from '@/domains/billing/feature-guard'
import { prisma } from '@/shared/database/prisma'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)

    // Usa o plano efetivo — lida com trial expirado (retorna FREE) e status inativo
    const { plan, status } = await featureGuard.getSubscriptionState(session.tenantId)

    const isActive = ['TRIALING', 'ACTIVE', 'PAST_DUE'].includes(status)

    // Assinatura inativa: expõe apenas as seções do plano FREE para o tenant não ficar preso
    const effectivePlan = isActive ? plan : 'FREE'

    const configs = await prisma.planFeatureConfig.findMany({
      where: { plan: effectivePlan as any },
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
