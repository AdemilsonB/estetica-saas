import { PlanName, SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { PlanFeatureError, PlanLimitError } from "@/shared/errors";

export const FEATURES = {
  WHATSAPP_BASIC:   "whatsapp_basic",
  WHATSAPP_PREMIUM: "whatsapp_premium",
  REPORTS_BASIC:    "reports_basic",
  REPORTS_ADVANCED: "reports_advanced",
  CAMPAIGNS:        "campaigns",
  MULTI_UNIT:       "multi_unit",
} as const;

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES];

const PLAN_FEATURES: Record<PlanName, Set<FeatureName>> = {
  FREE:       new Set(["reports_basic"]),
  STARTER:    new Set(["reports_basic", "whatsapp_basic", "campaigns"]),
  PRO:        new Set(["reports_basic", "reports_advanced", "whatsapp_basic", "whatsapp_premium", "campaigns", "multi_unit"]),
  ENTERPRISE: new Set(Object.values(FEATURES) as FeatureName[]),
};

const PLAN_LIMITS: Record<PlanName, Record<string, number>> = {
  FREE:       { users: 2,   appointments_month: 50   },
  STARTER:    { users: 5,   appointments_month: 300  },
  PRO:        { users: 20,  appointments_month: 2000 },
  ENTERPRISE: { users: -1,  appointments_month: -1   },
};

const FEATURE_MIN_PLAN: Record<FeatureName, PlanName> = {
  whatsapp_basic:    PlanName.STARTER,
  whatsapp_premium:  PlanName.PRO,
  reports_basic:     PlanName.FREE,
  reports_advanced:  PlanName.PRO,
  campaigns:         PlanName.STARTER,
  multi_unit:        PlanName.PRO,
};

export class FeatureGuard {
  async canAccess(tenantId: string, feature: FeatureName): Promise<boolean> {
    const { plan, status } = await this.getSubscriptionState(tenantId);
    if (!this.isActive(status)) return false;
    return PLAN_FEATURES[plan].has(feature);
  }

  async assertAccess(tenantId: string, feature: FeatureName): Promise<void> {
    const has = await this.canAccess(tenantId, feature);
    if (!has) {
      throw new PlanFeatureError(feature, FEATURE_MIN_PLAN[feature]);
    }
  }

  async assertWithinLimit(
    tenantId: string,
    limitType: "users" | "appointments_month",
    currentCount: number,
  ): Promise<void> {
    const { plan, status } = await this.getSubscriptionState(tenantId);
    if (!this.isActive(status)) return;
    const limit = PLAN_LIMITS[plan][limitType];
    if (limit !== -1 && currentCount >= limit) {
      throw new PlanLimitError(limitType, limit, currentCount);
    }
  }

  async getSubscriptionState(tenantId: string): Promise<{ plan: PlanName; status: string }> {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        plan: true,
        subscription: { select: { status: true, trialEndsAt: true } },
      },
    });

    const status = tenant.subscription?.status ?? SubscriptionStatus.EXPIRED;

    if (status === SubscriptionStatus.TRIALING && tenant.subscription?.trialEndsAt) {
      if (tenant.subscription.trialEndsAt < new Date()) {
        return { plan: PlanName.FREE, status: SubscriptionStatus.EXPIRED };
      }
    }

    return { plan: tenant.plan, status };
  }

  private isActive(status: string): boolean {
    const activeStatuses = [
      SubscriptionStatus.TRIALING as string,
      SubscriptionStatus.ACTIVE as string,
      SubscriptionStatus.PAST_DUE as string,
    ];
    return activeStatuses.includes(status);
  }
}

export const featureGuard = new FeatureGuard();
