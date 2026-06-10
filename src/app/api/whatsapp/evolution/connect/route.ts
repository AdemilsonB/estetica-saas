import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";
import { env } from "@/shared/config/env";
import { evolutionProvider } from "@/domains/notifications/providers/evolution.provider";
import { ValidationError } from "@/shared/errors";

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    if (!env.EVOLUTION_API_URL) {
      throw new ValidationError("Evolution API não está configurada neste servidor.");
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { id: true, evolutionInstanceId: true, evolutionStatus: true },
    });

    if (!tenant) throw new Error("Tenant não encontrado.");

    // Se já existe uma instância, excluir antes de reconectar
    if (tenant.evolutionInstanceId) {
      await evolutionProvider.deleteInstance(tenant.evolutionInstanceId).catch(() => {});
    }

    const instanceName = session.tenantId;
    const { qrCode } = await evolutionProvider.createInstance(instanceName);

    // Configura webhook para receber atualizações de conexão
    const webhookUrl = `${process.env.APP_URL}/api/webhooks/evolution/connection`;
    await evolutionProvider.configureWebhook(instanceName, webhookUrl).catch((err: unknown) => {
      // Webhook é best-effort — instância funcionará mas precisará de polling manual
      console.warn("[Evolution] Falha ao configurar webhook:", err instanceof Error ? err.message : "erro desconhecido");
    });

    // Configura webhook para mensagens inbound (chatbot)
    const messagesWebhookUrl = `${process.env.APP_URL}/api/webhooks/evolution/messages`;
    await evolutionProvider.configureMessagesWebhook(instanceName, messagesWebhookUrl).catch((err: unknown) => {
      console.warn("[Evolution] Falha ao configurar webhook de mensagens:", err instanceof Error ? err.message : "erro desconhecido");
    });

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: {
        evolutionInstanceId: instanceName,
        evolutionConnected: false,
        evolutionStatus: "CONNECTING",
        evolutionConnectedAt: null,
        evolutionPhone: null,
      },
    });

    return Response.json({ qrCode });
  } catch (error) {
    return handleApiError(error);
  }
}
