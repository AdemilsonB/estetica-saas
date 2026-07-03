import { PlanName, SubscriptionStatus } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";
import { addDays } from "@/lib/dates";
import { prisma } from "@/shared/database/prisma";
import { TrialAlreadyUsedError } from "@/shared/errors";

import { billingRepository } from "./billing.repository";

export class BillingService {
  async startTrial(tenantId: string) {
    return this.startTrialForPlan(tenantId, PlanName.STARTER)
  }

  async startTrialForPlan(tenantId: string, planName: PlanName) {
    const existing = await billingRepository.getSubscription(tenantId);

    // Trial é benefício de primeiro cadastro — uma vez que existe subscription
    // (mesmo que o tenant nunca tenha chegado a usar o trial), não há mais
    // direito a novo trial; só assinatura direta via Stripe.
    if (existing) {
      throw new TrialAlreadyUsedError();
    }

    const now = new Date();
    const plan = await prisma.plan.findUnique({ where: { name: planName }, select: { trialDays: true } });
    const trialEndsAt = addDays(now, plan?.trialDays ?? 0);

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

    // Atômico: a mudança de plano e o registro no histórico ocorrem juntos,
    // evitando trilha de auditoria incompleta caso o segundo write falhe.
    const updated = await prisma.$transaction(async (tx) => {
      const sub = await billingRepository.updateSubscription(
        tenantId,
        {
          plan: newPlan,
          status: newStatus,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          ...(newStatus === SubscriptionStatus.CANCELLED ? { cancelledAt: now } : {}),
        },
        tx,
      );

      await billingRepository.addHistory(
        {
          subscriptionId: sub.id,
          fromPlan: current?.plan ?? null,
          toPlan: newPlan,
          fromStatus: current?.status ?? null,
          toStatus: newStatus,
          reason,
          changedBy,
        },
        tx,
      );

      return sub;
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
    const starterPlan = await prisma.plan.findUnique({ where: { name: PlanName.STARTER }, select: { trialDays: true } })
    const trialEndsAt = addDays(now, starterPlan?.trialDays ?? 0)

    const current = await billingRepository.getSubscription(tenantId)

    return prisma.$transaction(async (tx) => {
      const updated = await billingRepository.updateSubscription(
        tenantId,
        {
          plan: PlanName.STARTER,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          cancelledAt: null,
        },
        tx,
      )

      await billingRepository.addHistory(
        {
          subscriptionId: updated.id,
          fromPlan: current?.plan ?? null,
          toPlan: PlanName.STARTER,
          fromStatus: current?.status ?? null,
          toStatus: SubscriptionStatus.TRIALING,
          reason: 'admin_reset_trial',
          changedBy: adminId,
        },
        tx,
      )

      return updated
    })
  }
}

export const billingService = new BillingService();
