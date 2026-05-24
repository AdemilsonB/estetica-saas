import { NotificationStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

import type { NotificationDeliveryResult, NotificationDraft } from "../types";

const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN ?? "";

function formatPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function buildMessage(template: string, payload: Record<string, unknown>): string {
  if (template === "appointment-created") {
    const date = new Date(payload.startsAt as string);
    const formatted = date.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      `Olá, ${payload.customerName}! 👋\n` +
      `Seu agendamento foi confirmado:\n` +
      `📅 ${formatted}\n` +
      `✂️ ${payload.serviceName}\n` +
      `Até lá!`
    );
  }
  return `Olá, ${payload.customerName}! Sua notificação foi enviada.`;
}

export class WhatsAppProvider {
  async send(draft: NotificationDraft): Promise<NotificationDeliveryResult> {
    if (!draft.recipient) {
      return { status: NotificationStatus.FAILED, errorMessage: "Destinatario sem telefone." };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: draft.tenantId },
      select: { zApiInstanceId: true, zApiToken: true, whatsappEnabled: true },
    });

    if (!tenant?.whatsappEnabled || !tenant.zApiInstanceId || !tenant.zApiToken) {
      return { status: NotificationStatus.PENDING, errorMessage: "WhatsApp nao configurado para este tenant." };
    }

    const phone = formatPhone(draft.recipient);
    const message = buildMessage(draft.template, draft.payload as Record<string, unknown>);

    try {
      const res = await fetch(
        `https://api.z-api.io/instances/${tenant.zApiInstanceId}/token/${tenant.zApiToken}/send-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": ZAPI_CLIENT_TOKEN,
          },
          body: JSON.stringify({ phone, message }),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        return { status: NotificationStatus.FAILED, errorMessage: `Z-API erro ${res.status}: ${body}` };
      }

      return { status: NotificationStatus.SENT };
    } catch (err) {
      return {
        status: NotificationStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : "Erro desconhecido ao enviar WhatsApp.",
      };
    }
  }
}

export const whatsAppProvider = new WhatsAppProvider();
