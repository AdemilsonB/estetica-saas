import { PlanName, SubscriptionStatus } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";
import { addDays } from "@/lib/dates";
import { prisma } from "@/shared/database/prisma";

import { billingRepository } from "./billing.repository";

export class BillingService {
  async startTrial(tenantId: string) {
    return this.startTrialForPlan(tenantId, PlanName.STARTER)
  }

  async startTrialForPlan(tenantId: string, planName: PlanName) {
    const now = new Date();
    const plan = await prisma.plan.findUnique({ where: { name: planName }, select: { trialDays: true } });
    const trialEndsAt = addDays(now, plan?.trialDays ?? 14);

    const existing = await billingRepository.getSubscription(tenantId);

    // Migra de FREE para o plano com trial (cobre o caso do onboarding pós-registro)
    if (existing) {
      const updated = await billingRepository.updateSubscription(tenantId, {
        plan: planName,
        status: SubscriptionStatus.TRIALING,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      });
      return updated;
    }

    const sub = await billingRepository.createSubscription({
      tenantId,
      plan: planName,
      status: SubscriptionStatus.TRIALING,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    });

    return sub;
  }

  async changePlan(
    tenantId: string,
    newPlan: PlanName,
    newStatus: SubscriptionStatus,
    changedBy: string,
    reason: string,
    periodDates?: { currentPeriodStart: Date; currentPeriodEnd: Date },
  ) {
    const current = await billingRepository.getSubscription(tenantId);
    const now = new Date();

    // Usa datas reais do Stripe quando fornecidas; caso contrário preserva as
    // datas existentes para não sobrescrever com valor fixo (causaria expiração falsa)
    const periodStart = periodDates?.currentPeriodStart ?? current?.currentPeriodStart ?? now;
    const periodEnd   = periodDates?.currentPeriodEnd   ?? current?.currentPeriodEnd   ?? addDays(now, 30);

    const updated = await billingRepository.updateSubscription(tenantId, {
      plan: newPlan,
      status: newStatus,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
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

    eventBus.publish({
      type: "billing.subscription.upgraded",
      payload: { tenantId, fromPlan: current?.plan, toPlan: newPlan },
    });

    return updated;
  }

  async runExpireSweep(): Promise<{ expiredTrials: number; expiredActive: number }> {
    const now = new Date();

    const expiredTrials = await billingRepository.findExpiredTrials(now);
    for (const sub of expiredTrials) {
      await this.changePlan(sub.tenantId, sub.plan, SubscriptionStatus.EXPIRED, "system", "trial_expired");
      eventBus.publish({ type: "billing.trial.expired", payload: { tenantId: sub.tenantId } });
    }

    const expiredActive = await billingRepository.findExpiredActive(now);
    for (const sub of expiredActive) {
      await this.changePlan(sub.tenantId, sub.plan, SubscriptionStatus.EXPIRED, "system", "period_expired");
    }

    return { expiredTrials: expiredTrials.length, expiredActive: expiredActive.length };
  }

  async resetTrial(tenantId: string, adminId: string) {
    const now = new Date()
    const trialEndsAt = addDays(now, 14)

    const current = await billingRepository.getSubscription(tenantId)

    const updated = await billingRepository.updateSubscription(tenantId, {
      plan: PlanName.STARTER,
      status: SubscriptionStatus.TRIALING,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      cancelledAt: null,
    })

    await billingRepository.addHistory({
      subscriptionId: updated.id,
      fromPlan: current?.plan ?? null,
      toPlan: PlanName.STARTER,
      fromStatus: current?.status ?? null,
      toStatus: SubscriptionStatus.TRIALING,
      reason: 'admin_reset_trial',
      changedBy: adminId,
    })

    return updated
  }
}

export const billingService = new BillingService();
