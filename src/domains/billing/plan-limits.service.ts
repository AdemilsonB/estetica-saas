import { PlanName } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { LIMIT_REGISTRY, type LimitKey } from '@/shared/permissions/limit-registry'
import { PlanLimitError } from '@/shared/errors'

const ACTIVE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE']

export class PlanLimitsService {
  async get(tenantId: string, limitKey: LimitKey): Promise<number> {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        plan: true,
        subscription: { select: { status: true, trialEndsAt: true } },
      },
    })
    if (!tenant) throw new Error(`Tenant ${tenantId} não encontrado.`)

    const effectivePlan = this.resolveEffectivePlan(tenant)

    const config = await prisma.planLimitConfig.findFirst({
      where: { plan: effectivePlan, limitKey },
    })

    return config?.value ?? LIMIT_REGISTRY[limitKey].defaults[effectivePlan]
  }

  async assertWithinLimit(tenantId: string, limitKey: LimitKey, currentCount: number): Promise<void> {
    const limit = await this.get(tenantId, limitKey)
    if (limit !== 999999 && currentCount >= limit) {
      throw new PlanLimitError(LIMIT_REGISTRY[limitKey].label, limit, currentCount)
    }
  }

  private resolveEffectivePlan(tenant: {
    plan: PlanName
    subscription: { status: string; trialEndsAt: Date | null } | null
  }): PlanName {
    const status = tenant.subscription?.status
    if (!status || !ACTIVE_STATUSES.includes(status)) return PlanName.FREE
    if (status === 'TRIALING' && tenant.subscription?.trialEndsAt) {
      if (tenant.subscription.trialEndsAt < new Date()) return PlanName.FREE
    }
    return tenant.plan
  }
}

export const planLimitsService = new PlanLimitsService()
