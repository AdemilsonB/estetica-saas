import { PlanName, SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

type CreateSubscriptionData = {
  tenantId: string;
  plan: PlanName;
  status: SubscriptionStatus;
  trialEndsAt?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
};

type UpdateSubscriptionData = {
  plan?: PlanName;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date | null;
};

type CreateHistoryData = {
  subscriptionId: string;
  fromPlan?: PlanName | null;
  toPlan: PlanName;
  fromStatus?: SubscriptionStatus | null;
  toStatus: SubscriptionStatus;
  reason?: string;
  changedBy?: string;
};

export class BillingRepository {
  async createSubscription(data: CreateSubscriptionData) {
    return prisma.subscription.create({ data });
  }

  async getSubscription(tenantId: string) {
    return prisma.subscription.findUnique({ where: { tenantId } });
  }

  async updateSubscription(tenantId: string, data: UpdateSubscriptionData) {
    return prisma.subscription.update({ where: { tenantId }, data });
  }

  async addHistory(data: CreateHistoryData) {
    return prisma.subscriptionHistory.create({ data });
  }

  async updateTenantPlanCache(tenantId: string, plan: PlanName) {
    await prisma.tenant.update({ where: { id: tenantId }, data: { plan } });
  }

  async findExpiredTrials(now: Date) {
    return prisma.subscription.findMany({
      where: { status: "TRIALING", trialEndsAt: { lt: now } },
    });
  }

  async findExpiredActive(now: Date) {
    return prisma.subscription.findMany({
      where: { status: "ACTIVE", currentPeriodEnd: { lt: now } },
    });
  }
}

export const billingRepository = new BillingRepository();
