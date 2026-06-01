import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";
import { evolutionProvider } from "@/domains/notifications/providers/evolution.provider";

export async function DELETE(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { evolutionInstanceId: true },
    });

    if (tenant?.evolutionInstanceId) {
      await evolutionProvider.deleteInstance(tenant.evolutionInstanceId).catch(() => {});
    }

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: {
        evolutionInstanceId: null,
        evolutionConnected: false,
        evolutionStatus: "DISCONNECTED",
        evolutionConnectedAt: null,
        evolutionPhone: null,
      },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
