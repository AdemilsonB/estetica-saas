import { PlanName, SubscriptionStatus, type Prisma } from "@prisma/client";

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
  trialEndsAt?: Date | null;
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
  async createSubscription(
    data: CreateSubscriptionData,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.subscription.create({ data });
  }

  async getSubscription(tenantId: string) {
    return prisma.subscription.findUnique({ where: { tenantId } });
  }

  async updateSubscription(
    tenantId: string,
    data: UpdateSubscriptionData,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.subscription.update({ where: { tenantId }, data });
  }

  async addHistory(
    data: CreateHistoryData,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.subscriptionHistory.create({ data });
  }

  async findExpiredTrials(now: Date) {
    // Exclui subscriptions com stripeSubId — o Stripe gerencia essas via webhook
    return prisma.subscription.findMany({
      where: { status: "TRIALING", trialEndsAt: { lt: now }, stripeSubId: null },
    });
  }

  async findExpiredActive(now: Date) {
    // Ignora subscriptions com stripeSubId — o Stripe gerencia essas via webhook
    return prisma.subscription.findMany({
      where: { status: 'ACTIVE', currentPeriodEnd: { lt: now }, stripeSubId: null },
    });
  }

  async findByStripeCustomerId(stripeCustomerId: string) {
    return prisma.subscription.findFirst({ where: { stripeCustomerId } })
  }

  async findByStripeSubId(stripeSubId: string) {
    return prisma.subscription.findFirst({ where: { stripeSubId } })
  }

  async setStripeIds(tenantId: string, data: {
    stripeCustomerId?: string
    stripeSubId?: string
    stripePriceId?: string
    cancelAtPeriodEnd?: boolean
  }) {
    return prisma.subscription.update({ where: { tenantId }, data })
  }
}

export const billingRepository = new BillingRepository();
