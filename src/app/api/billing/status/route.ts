import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { billingRepository } from "@/domains/billing/billing.repository";
import { PLAN_LIMITS } from "@/domains/billing/types";
import { prisma } from "@/shared/database/prisma";
import { startOfMonth, endOfDay } from "@/lib/dates";

export async function GET(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    const { plan, status } = await featureGuard.getSubscriptionState(session.tenantId);
    const sub = await billingRepository.getSubscription(session.tenantId);

    const limits = PLAN_LIMITS[plan];

    const [userCount, appointmentCount] = await Promise.all([
      prisma.user.count({ where: { tenantId: session.tenantId } }),
      prisma.appointment.count({
        where: {
          tenantId: session.tenantId,
          startsAt: { gte: startOfMonth(new Date()), lte: endOfDay(new Date()) },
        },
      }),
    ]);

    const activeFeatures: Record<string, boolean> = {};
    for (const f of Object.values(FEATURES)) {
      activeFeatures[f] = await featureGuard.canAccess(session.tenantId, f);
    }

    return Response.json({
      plan,
      status,
      trialEndsAt: sub?.trialEndsAt ?? null,
      features: activeFeatures,
      limits: {
        users:              { current: userCount,        max: limits.maxUsers },
        appointments_month: { current: appointmentCount, max: limits.maxAppointmentsPerMonth },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
