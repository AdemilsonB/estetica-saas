import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";
import { evolutionProvider } from "@/domains/notifications/providers/evolution.provider";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    let tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: {
        evolutionInstanceId: true,
        evolutionConnected: true,
        evolutionStatus: true,
        evolutionConnectedAt: true,
        evolutionPhone: true,
      },
    });

    // Auto-cura: se o banco diz CONNECTING mas a Evolution já pareou, sincroniza
    // aqui — sem depender do webhook de conexão (que pode não chegar por APP_URL
    // ausente, formato de webhook ou Deployment Protection). O painel faz polling
    // deste endpoint a cada 3s enquanto CONNECTING, então a conexão é detectada
    // em segundos após o QR ser escaneado.
    if (tenant?.evolutionInstanceId && tenant.evolutionStatus === "CONNECTING") {
      const realState = await evolutionProvider
        .getStatus(tenant.evolutionInstanceId)
        .catch(() => null);

      if (realState === "CONNECTED") {
        const phone = await evolutionProvider
          .getConnectedPhone(tenant.evolutionInstanceId)
          .catch(() => null);

        tenant = await prisma.tenant.update({
          where: { id: session.tenantId },
          data: {
            evolutionStatus: "CONNECTED",
            evolutionConnected: true,
            evolutionConnectedAt: new Date(),
            ...(phone ? { evolutionPhone: phone } : {}),
          },
          select: {
            evolutionInstanceId: true,
            evolutionConnected: true,
            evolutionStatus: true,
            evolutionConnectedAt: true,
            evolutionPhone: true,
          },
        });
      }
    }

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
