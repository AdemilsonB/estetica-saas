import { PlanName, SubscriptionStatus } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";
import { addDays } from "@/lib/dates";

import { billingRepository } from "./billing.repository";

export class BillingService {
  async startTrial(tenantId: string) {
    const now = new Date();
    const trialEndsAt = addDays(now, 14);

    const sub = await billingRepository.createSubscription({
      tenantId,
      plan: PlanName.STARTER,
      status: SubscriptionStatus.TRIALING,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    });

    await billingRepository.updateTenantPlanCache(tenantId, PlanName.STARTER);

    return sub;
  }

  async changePlan(
    tenantId: string,
    newPlan: PlanName,
    newStatus: SubscriptionStatus,
    changedBy: string,
    reason: string,
  ) {
    const current = await billingRepository.getSubscription(tenantId);
    const now = new Date();

    const updated = await billingRepository.updateSubscription(tenantId, {
      plan: newPlan,
      status: newStatus,
      currentPeriodStart: now,
      currentPeriodEnd: addDays(now, 30),
      ...(newStatus === SubscriptionStatus.CANCELLED ? { cancelledAt: now } : {}),
    });

    await billingRepository.addHistory({
      subscriptionId: updated.id,
      fromPlan: current?.plan ?? null,
      toPlan: newPlan,
      fromStatus: current?.status ?? null,
      toStatus: newStatus,
      reason,
      changedBy,
    });

    await billingRepository.updateTenantPlanCache(tenantId, newPlan);

    eventBus.publish({
      type: "billing.subscription.upgraded",
      payload: { tenantId, fromPlan: current?.plan, toPlan: newPlan },
    });

    return updated;
  }

  async runExpireSweep() {
    const now = new Date();

    const expiredTrials = await billingRepository.findExpiredTrials(now);
    for (const sub of expiredTrials) {
      await this.changePlan(sub.tenantId, PlanName.FREE, SubscriptionStatus.EXPIRED, "system", "trial_expired");
      eventBus.publish({ type: "billing.trial.expired", payload: { tenantId: sub.tenantId } });
    }

    const expiredActive = await billingRepository.findExpiredActive(now);
    for (const sub of expiredActive) {
      await this.changePlan(sub.tenantId, sub.plan, SubscriptionStatus.EXPIRED, "system", "period_expired");
    }
  }
}

export const billingService = new BillingService();
