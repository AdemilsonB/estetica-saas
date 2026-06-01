import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";
import { evolutionProvider } from "@/domains/notifications/providers/evolution.provider";
import { NotFoundError } from "@/shared/errors";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { evolutionInstanceId: true },
    });

    if (!tenant?.evolutionInstanceId) {
      throw new NotFoundError("Instância Evolution");
    }

    const qrCode = await evolutionProvider.getQrCode(tenant.evolutionInstanceId);

    return Response.json({ qrCode });
  } catch (error) {
    return handleApiError(error);
  }
}
