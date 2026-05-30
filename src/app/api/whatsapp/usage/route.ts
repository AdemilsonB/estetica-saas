import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { whatsAppQuotaService } from "@/domains/notifications/quota/whatsapp-quota.service";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { prisma } from "@/shared/database/prisma";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const usage = await whatsAppQuotaService.getUsage(session.tenantId);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { plan: true },
    });

    return Response.json({
      used: usage.used,
      limit: usage.limit,
      resetDate: usage.resetDate,
      plan: tenant?.plan ?? "STARTER",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
