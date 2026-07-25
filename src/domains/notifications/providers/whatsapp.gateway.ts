import { NotificationStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { env } from "@/shared/config/env";
import { whatsAppQuotaService } from "../quota/whatsapp-quota.service";
import { twilioProvider } from "./whatsapp.provider";
import { evolutionProvider } from "./evolution.provider";
import type { NotificationDraft, NotificationDeliveryResult } from "../types";
import type { TenantWhatsAppConfig } from "./whatsapp-provider.interface";

export class WhatsAppGateway {
  async send(draft: NotificationDraft): Promise<NotificationDeliveryResult> {
    try {
      await featureGuard.assertAccess(draft.tenantId, FEATURES.WHATSAPP_BASIC);
    } catch {
      return { status: NotificationStatus.FAILED, errorMessage: "Plano não suporta WhatsApp." };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: draft.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        whatsappEnabled: true,
        whatsappTemplateConfig: true,
        evolutionInstanceId: true,
        evolutionConnected: true,
        evolutionStatus: true,
        evolutionPhone: true,
      },
    });

    if (!tenant?.whatsappEnabled) {
      return { status: NotificationStatus.PENDING };
    }

    const canSend = await whatsAppQuotaService.checkAndIncrement(draft.tenantId);
    if (!canSend) {
      return { status: NotificationStatus.FAILED, errorMessage: "Limite mensal de WhatsApp atingido." };
    }

    const tenantConfig = tenant as TenantWhatsAppConfig;

    // Evolution é o provedor PRIMÁRIO e por-tenant: se o tenant conectou o
    // WhatsApp dele e a EVOLUTION_API_URL está configurada, o envio vai por ele.
    // O roteamento é pela CONEXÃO DO TENANT — não por um flag global de ambiente.
    // (Antes, o gateway exigia WHATSAPP_PROVIDER === "evolution", cujo default era
    // "twilio"; em produção sem esse env a Evolution NUNCA era tentada e tudo caía
    // no Twilio não configurado — mensagens falhavam com "TWILIO_ACCOUNT_SID não
    // configurada" mesmo com o WhatsApp conectado.)
    const evolutionReady =
      !!env.EVOLUTION_API_URL &&
      tenantConfig.evolutionConnected &&
      tenantConfig.evolutionStatus === "CONNECTED";

    if (evolutionReady) {
      const result = await evolutionProvider.send(draft, tenantConfig);
      if (result.success) {
        return { status: NotificationStatus.SENT, externalId: result.externalId, provider: "evolution" };
      }

      // Evolution era o provedor do tenant e falhou → tenta Twilio como fallback.
      // Se o Twilio também falhar, o erro reportado carrega os DOIS motivos, para
      // o log não mascarar a falha real da Evolution com "Twilio não configurado".
      const fallback = await twilioProvider.send(draft, tenantConfig);
      if (!fallback.success) {
        await whatsAppQuotaService.decrement(draft.tenantId);
        return {
          status: NotificationStatus.FAILED,
          errorMessage: `Evolution falhou (${result.errorMessage ?? "erro desconhecido"}); fallback Twilio falhou (${fallback.errorMessage ?? "erro desconhecido"})`,
          provider: "evolution→twilio",
        };
      }
      return { status: NotificationStatus.SENT, externalId: fallback.externalId, provider: "evolution→twilio" };
    }

    // Tenant sem Evolution conectada → Twilio (fallback global, quando configurado).
    const twilioResult = await twilioProvider.send(draft, tenantConfig);
    if (!twilioResult.success) {
      await whatsAppQuotaService.decrement(draft.tenantId);
      return {
        status: NotificationStatus.FAILED,
        errorMessage: twilioResult.errorMessage,
        provider: "twilio",
      };
    }

    return {
      status: NotificationStatus.SENT,
      externalId: twilioResult.externalId,
      provider: "twilio",
    };
  }
}

export const whatsAppGateway = new WhatsAppGateway();
