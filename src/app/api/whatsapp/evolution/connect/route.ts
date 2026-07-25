import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";
import { env } from "@/shared/config/env";
import { evolutionProvider } from "@/domains/notifications/providers/evolution.provider";
import { createEvolutionWebhookToken } from "@/shared/auth/evolution-webhook-token";
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
    if (!env.EVOLUTION_WEBHOOK_SECRET) {
      throw new ValidationError("EVOLUTION_WEBHOOK_SECRET não configurada neste servidor.");
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { id: true, evolutionInstanceId: true, evolutionStatus: true },
    });

    if (!tenant) throw new Error("Tenant não encontrado.");

    // Se já existe uma instância, excluir antes de reconectar (logout + delete).
    // Se falhar, o createInstance ainda se auto-cura no 403 "already in use".
    if (tenant.evolutionInstanceId) {
      await evolutionProvider.deleteInstance(tenant.evolutionInstanceId).catch((err: unknown) => {
        console.warn("[Evolution] Falha ao excluir instância antiga:", err instanceof Error ? err.message : "erro desconhecido");
      });
    }

    const instanceName = session.tenantId;

    // Token derivado do tenantId — a Evolution não assina seus webhooks, então a
    // autenticação vai embutida na própria URL registrada (ver evolution-webhook-token.ts).
    // A Evolution guarda UM único webhook por instância: registrar duas URLs em
    // sequência sobrescreve a primeira. Por isso é uma URL só (dispatcher) com os
    // dois eventos, registrada inline no create.
    const webhookToken = createEvolutionWebhookToken(instanceName);
    const webhook = env.APP_URL
      ? {
          url: `${env.APP_URL}/api/webhooks/evolution?token=${webhookToken}`,
          events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
        }
      : undefined;
    if (!webhook) {
      // Sem APP_URL o webhook não tem pra onde apontar — a conexão ainda completa
      // pela auto-cura do GET /status (polling), mas o chatbot inbound fica mudo.
      console.warn("[Evolution] APP_URL ausente — instância criada sem webhook.");
    }

    const { qrCode } = await evolutionProvider.createInstance(instanceName, webhook);

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
