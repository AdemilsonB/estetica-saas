import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: {
        evolutionInstanceId: true,
        evolutionConnected: true,
        evolutionStatus: true,
        evolutionConnectedAt: true,
        evolutionPhone: true,
      },
    });

    return Response.json({
      instanceId: tenant?.evolutionInstanceId ?? null,
      connected: tenant?.evolutionConnected ?? false,
      status: tenant?.evolutionStatus ?? "DISCONNECTED",
      connectedAt: tenant?.evolutionConnectedAt ?? null,
      phone: tenant?.evolutionPhone ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
