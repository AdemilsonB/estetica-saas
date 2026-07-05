import { PlanName, SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { PlanFeatureError, NotFoundError } from '@/shared/errors'
import { planLimitsService } from '@/domains/billing/plan-limits.service'
import { getPlanOrder } from './plan-order'
import type { LimitKey } from '@/shared/permissions/limit-registry'

export const FEATURES = {
  WHATSAPP_BASIC:   'whatsapp_basic',
  WHATSAPP_PREMIUM: 'whatsapp_premium',
  REPORTS_BASIC:    'reports_basic',
  REPORTS_ADVANCED: 'reports_advanced',
  CAMPAIGNS:        'campaigns',
  MULTI_UNIT:       'multi_unit',
} as const

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES]

const LIMIT_TYPE_MAP: Record<string, LimitKey> = {
  users:              'max_users',
  appointments_month: 'max_appointments_month',
}

export class FeatureGuard {
  async canAccess(tenantId: string, feature: FeatureName): Promise<boolean> {
    const { plan, status } = await this.getSubscriptionState(tenantId)
    if (!this.isActive(status)) return false
    const config = await prisma.planFeatureConfig.findFirst({
      where: { plan, sectionKey: feature },
    })
    return config?.enabled ?? false
  }

  async assertAccess(tenantId: string, feature: FeatureName): Promise<void> {
    const has = await this.canAccess(tenantId, feature)
    if (!has) {
      const minPlan = await this.findMinPlanForFeature(feature)
      throw new PlanFeatureError(feature, minPlan ?? PlanName.ENTERPRISE)
    }
  }

  async assertWithinLimit(
    tenantId: string,
    limitType: 'users' | 'appointments_month',
    currentCount: number,
  ): Promise<void> {
    const limitKey = LIMIT_TYPE_MAP[limitType]
    if (!limitKey) throw new Error(`Tipo de limite desconhecido: ${limitType}`)
    await planLimitsService.assertWithinLimit(tenantId, limitKey, currentCount)
  }

  async getSubscriptionState(tenantId: string): Promise<{ plan: PlanName; status: SubscriptionStatus }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscription: { select: { plan: true, status: true, trialEndsAt: true } },
      },
    })
    if (!tenant) throw new NotFoundError('Tenant')

    const status = tenant.subscription?.status ?? SubscriptionStatus.EXPIRED

    if (status === SubscriptionStatus.TRIALING && tenant.subscription?.trialEndsAt) {
      if (tenant.subscription.trialEndsAt < new Date()) {
        return { plan: PlanName.FREE, status: SubscriptionStatus.EXPIRED }
      }
    }

    return { plan: tenant.subscription?.plan ?? PlanName.FREE, status }
  }

  async resolveGate(
    tenantId: string,
    feature: FeatureName,
  ): Promise<{
    allowed: boolean
    currentPlan: PlanName
    requiredPlan: PlanName | null
    requiredPlanLabel: string | null
  }> {
    const { plan: currentPlan } = await this.getSubscriptionState(tenantId)
    const allowed = await this.canAccess(tenantId, feature)
    if (allowed) {
      return { allowed: true, currentPlan, requiredPlan: null, requiredPlanLabel: null }
    }
    const requiredPlan = await this.findMinPlanForFeature(feature)
    const requiredPlanLabel = requiredPlan
      ? (await prisma.plan.findUnique({ where: { name: requiredPlan }, select: { displayName: true } }))?.displayName ?? null
      : null
    return { allowed: false, currentPlan, requiredPlan, requiredPlanLabel }
  }

  private async findMinPlanForFeature(feature: FeatureName): Promise<PlanName | null> {
    const [configs, order] = await Promise.all([
      prisma.planFeatureConfig.findMany({
        where: { sectionKey: feature, enabled: true },
        select: { plan: true },
      }),
      getPlanOrder(),
    ])
    const enabledPlans = new Set(configs.map((c) => c.plan))
    return order.find((p) => enabledPlans.has(p)) ?? null
  }

  private isActive(status: SubscriptionStatus): boolean {
    const activeStatuses: SubscriptionStatus[] = [
      SubscriptionStatus.TRIALING,
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.PAST_DUE,
    ]
    return activeStatuses.includes(status)
  }
}

export const featureGuard = new FeatureGuard()
