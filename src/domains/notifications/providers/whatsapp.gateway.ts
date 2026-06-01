import { NotificationStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { env } from "@/shared/config/env";
import { whatsAppQuotaService } from "../quota/whatsapp-quota.service";
import { twilioProvider } from "./whatsapp.provider";
import type { NotificationDraft, NotificationDeliveryResult } from "../types";
import type { TenantWhatsAppConfig } from "./whatsapp-provider.interface";

async function getEvolutionProvider() {
  const mod = await import("./evolution.provider");
  return mod.evolutionProvider;
}

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

    const useEvolution =
      env.WHATSAPP_PROVIDER === "evolution" &&
      !!env.EVOLUTION_API_URL &&
      tenantConfig.evolutionConnected &&
      tenantConfig.evolutionStatus === "CONNECTED";

    if (useEvolution) {
      const evolution = await getEvolutionProvider();
      const result = await evolution.send(draft, tenantConfig);
      if (result.success) {
        return { status: NotificationStatus.SENT, externalId: result.externalId, provider: "evolution" };
      }
      console.warn(`[WhatsAppGateway] Evolution falhou para tenant ${draft.tenantId}, usando Twilio como fallback`);
    }

    const twilioResult = await twilioProvider.send(draft, tenantConfig);
    if (!twilioResult.success) {
      await whatsAppQuotaService.decrement(draft.tenantId);
      return {
        status: NotificationStatus.FAILED,
        errorMessage: twilioResult.errorMessage,
        provider: useEvolution ? "evolution→twilio" : "twilio",
      };
    }

    return {
      status: NotificationStatus.SENT,
      externalId: twilioResult.externalId,
      provider: useEvolution ? "evolution→twilio" : "twilio",
    };
  }
}

export const whatsAppGateway = new WhatsAppGateway();
