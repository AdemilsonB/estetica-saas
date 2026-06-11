import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { billingRepository } from "@/domains/billing/billing.repository";
import { planLimitsService } from "@/domains/billing/plan-limits.service";
import { prisma } from "@/shared/database/prisma";
import { startOfMonth, endOfDay } from "@/lib/dates";

export async function GET(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    const { plan, status } = await featureGuard.getSubscriptionState(session.tenantId);
    const sub = await billingRepository.getSubscription(session.tenantId);

    const isExpiredTrial =
      status === 'EXPIRED' &&
      sub?.trialEndsAt != null &&
      sub.trialEndsAt < new Date() &&
      sub.stripeSubId == null

    const [userCount, appointmentCount, maxUsers, maxAppointments] = await Promise.all([
      prisma.user.count({ where: { tenantId: session.tenantId } }),
      prisma.appointment.count({
        where: {
          tenantId: session.tenantId,
          startsAt: { gte: startOfMonth(new Date()), lte: endOfDay(new Date()) },
        },
      }),
      planLimitsService.get(session.tenantId, 'max_users'),
      planLimitsService.get(session.tenantId, 'max_appointments_month'),
    ]);

    const activeFeatures: Record<string, boolean> = {};
    for (const f of Object.values(FEATURES)) {
      activeFeatures[f] = await featureGuard.canAccess(session.tenantId, f);
    }

    return Response.json({
      plan,
      status,
      trialEndsAt: sub?.trialEndsAt ?? null,
      stripeSubId: sub?.stripeSubId ?? null,
      isExpiredTrial,
      originalPlan: isExpiredTrial ? (sub?.plan ?? plan) : null,
      features: activeFeatures,
      limits: {
        users:              { current: userCount,        max: maxUsers },
        appointments_month: { current: appointmentCount, max: maxAppointments },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
