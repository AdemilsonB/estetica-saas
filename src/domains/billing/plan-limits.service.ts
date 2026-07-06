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
        subscription: { select: { plan: true, status: true, trialEndsAt: true } },
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
    if (limit === 999999) return

    const { kind } = LIMIT_REGISTRY[limitKey]
    const threshold = kind === 'soft' ? Math.floor(limit * 1.1) : limit

    if (currentCount >= threshold) {
      throw new PlanLimitError(LIMIT_REGISTRY[limitKey].label, limit, currentCount)
    }
  }

  async checkUsage(
    tenantId: string,
    limitKey: LimitKey,
    current: number
  ): Promise<{ status: 'ok' | 'warning' | 'exceeded'; percent: number; limit: number; current: number }> {
    const limit = await this.get(tenantId, limitKey)
    const { unlimitedThreshold } = LIMIT_REGISTRY[limitKey]

    if (limit >= unlimitedThreshold) {
      return { status: 'ok', percent: 0, limit, current }
    }

    const percent = (current / limit) * 100
    const status = percent >= 100 ? 'exceeded' : percent >= 80 ? 'warning' : 'ok'

    return { status, percent, limit, current }
  }

  private resolveEffectivePlan(tenant: {
    subscription: { plan: PlanName; status: string; trialEndsAt: Date | null } | null
  }): PlanName {
    const status = tenant.subscription?.status
    if (!status || !ACTIVE_STATUSES.includes(status)) return PlanName.FREE
    if (status === 'TRIALING' && tenant.subscription?.trialEndsAt) {
      if (tenant.subscription.trialEndsAt < new Date()) return PlanName.FREE
    }
    return tenant.subscription?.plan ?? PlanName.FREE
  }
}

export const planLimitsService = new PlanLimitsService()
