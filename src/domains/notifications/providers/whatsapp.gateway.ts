import { NotificationStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { env } from "@/shared/config/env";
import { whatsAppQuotaService } from "../quota/whatsapp-quota.service";
import { twilioProvider } from "./whatsapp.provider";
import { evolutionProvider } from "./evolution.provider";
import { customerMessageService } from "../customer-messages/customer-message.service";
import { LEGACY_TEMPLATE_TO_EVENT } from "../customer-messages/customer-message-catalog";
import type { NotificationDraft, NotificationDeliveryResult } from "../types";
import type { TenantWhatsAppConfig } from "./whatsapp-provider.interface";
import type { RenderedCustomerMessage } from "../customer-messages/types";

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
        phone: true,
        address: true,
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

    const payload = draft.payload as {
      customerName?: string;
      serviceName?: string;
      professionalName?: string;
      startsAt?: string;
      newStartsAt?: string;
      message?: string;
    };

    let rendered: RenderedCustomerMessage;

    if (payload.message) {
      // Mensagem escrita na hora pelo profissional tem precedência sobre o template.
      rendered = { subject: null, text: payload.message, mediaUrl: null };
    } else {
      const event = LEGACY_TEMPLATE_TO_EVENT[draft.template];
      if (!event) {
        // A quota já foi incrementada acima — devolvê-la, senão o tenant perde uma
        // cota de WhatsApp por uma mensagem que nunca chegou a sair.
        await whatsAppQuotaService.decrement(draft.tenantId);
        return {
          status: NotificationStatus.FAILED,
          errorMessage: `Template desconhecido: ${draft.template}`,
        };
      }

      // No reagendamento o payload traz a data nova em `newStartsAt` — ela tem
      // precedência sobre `startsAt` (a data original do agendamento).
      const quando = payload.newStartsAt ?? payload.startsAt;
      rendered = await customerMessageService.render(draft.tenantId, event, "WHATSAPP", {
        customerName: payload.customerName ?? "Cliente",
        serviceName: payload.serviceName,
        professionalName: payload.professionalName,
        startsAt: quando ? new Date(quando) : undefined,
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          timezone: tenant.timezone,
          phone: tenant.phone,
          address: tenant.address,
        },
      });
    }

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
      const result = await evolutionProvider.send(draft, tenantConfig, rendered);
      if (result.success) {
        return { status: NotificationStatus.SENT, externalId: result.externalId, provider: "evolution" };
      }

      // Evolution era o provedor do tenant e falhou → tenta Twilio como fallback.
      // Se o Twilio também falhar, o erro reportado carrega os DOIS motivos, para
      // o log não mascarar a falha real da Evolution com "Twilio não configurado".
      const fallback = await twilioProvider.send(draft, tenantConfig, rendered);
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
    const twilioResult = await twilioProvider.send(draft, tenantConfig, rendered);
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
