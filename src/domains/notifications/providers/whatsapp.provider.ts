import twilio from "twilio";

import { InvalidPhoneError } from "@/shared/errors";
import type { NotificationDraft } from "../types";
import type { IWhatsAppProvider, SendResult, TenantWhatsAppConfig } from "./whatsapp-provider.interface";

// Fail-fast na inicialização — nunca em build do Next.js
if (
  process.env.NODE_ENV !== "test" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  const required = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "APP_URL",
    "TWILIO_TPL_CONFIRMATION",
    "TWILIO_TPL_CONFIRMED",
    "TWILIO_TPL_REMINDER",
    "TWILIO_TPL_CANCELLATION",
    "TWILIO_TPL_NO_SHOW",
  ] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[TwilioProvider] Env var ${key} não configurada`);
    }
  }
}

const TEMPLATE_SIDS: Record<string, string> = {
  "appointment-created":   process.env.TWILIO_TPL_CONFIRMATION ?? "",
  "appointment-confirmed": process.env.TWILIO_TPL_CONFIRMED ?? "",
  "appointment-reminder":  process.env.TWILIO_TPL_REMINDER ?? "",
  "appointment-cancelled": process.env.TWILIO_TPL_CANCELLATION ?? "",
  "appointment-no-show":   process.env.TWILIO_TPL_NO_SHOW ?? "",
  "birthday":              process.env.TWILIO_TPL_BIRTHDAY ?? "",
};

const TEMPLATE_TO_CONFIG_KEY: Record<string, string> = {
  "appointment-created":   "confirmacao",
  "appointment-confirmed": "confirmado",
  "appointment-reminder":  "lembrete",
  "appointment-cancelled": "cancelamento",
  "appointment-no-show":   "nao_comparecimento",
  "birthday":              "aniversario",
};

const TEMPLATE_DEFAULTS: Record<string, { mensagemPrincipal: string; mensagemFinal: string }> = {
  confirmacao:        { mensagemPrincipal: "Seu agendamento foi criado.", mensagemFinal: "Até lá!" },
  confirmado:         { mensagemPrincipal: "Seu agendamento está confirmado.", mensagemFinal: "Te esperamos!" },
  lembrete:           { mensagemPrincipal: "Lembrete:", mensagemFinal: "Até lá!" },
  cancelamento:       { mensagemPrincipal: "Seu agendamento foi cancelado.", mensagemFinal: "Para reagendar, entre em contato conosco." },
  nao_comparecimento: { mensagemPrincipal: "Notamos que você não compareceu ao seu horário.", mensagemFinal: "Quando quiser reagendar, estamos à disposição!" },
  aniversario:        { mensagemPrincipal: "Feliz aniversário! Temos um presente especial para você.", mensagemFinal: "Venha nos visitar em breve!" },
};

type AppointmentNotificationPayload = {
  appointmentId: string;
  customerName: string;
  serviceName: string;
  startsAt?: string;
  status?: string;
};

type BirthdayNotificationPayload = {
  customerName: string;
};

type TemplateConfig = { mensagemPrincipal?: string; mensagemFinal?: string };

function toWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    throw new InvalidPhoneError(raw);
  }
  const e164 = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
  return `whatsapp:${e164}`;
}

function fmt(isoString: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, ...options }).format(
    new Date(isoString),
  );
}

export function buildTwilioTemplateParams(
  template: string,
  payload: AppointmentNotificationPayload,
  tenant: Pick<TenantWhatsAppConfig, "name" | "slug" | "timezone" | "whatsappTemplateConfig">,
): { contentSid: string; contentVariables: Record<string, string> } {
  const configKey = TEMPLATE_TO_CONFIG_KEY[template];
  const rawConfigs = tenant.whatsappTemplateConfig as Record<string, TemplateConfig> | null;
  const tenantConfig = rawConfigs?.[configKey] ?? {};
  const defaults = TEMPLATE_DEFAULTS[configKey];

  const principal = tenantConfig.mensagemPrincipal ?? defaults.mensagemPrincipal;
  const final = tenantConfig.mensagemFinal ?? defaults.mensagemFinal;
  const contentSid = TEMPLATE_SIDS[template];
  const tz = tenant.timezone;

  let contentVariables: Record<string, string>;

  if (template === "appointment-created" || template === "appointment-confirmed") {
    const startsAt = payload.startsAt!;
    contentVariables = {
      "1": payload.customerName,
      "2": principal,
      "3": fmt(startsAt, tz, { day: "2-digit", month: "2-digit", year: "numeric" }),
      "4": fmt(startsAt, tz, { hour: "2-digit", minute: "2-digit" }),
      "5": payload.serviceName,
      "6": tenant.name,
      "7": final,
      "8": `${process.env.APP_URL}/agendar/${tenant.slug}`,
    };
  } else if (template === "appointment-reminder") {
    const startsAt = payload.startsAt!;
    contentVariables = {
      "1": payload.customerName,
      "2": principal,
      "3": fmt(startsAt, tz, { hour: "2-digit", minute: "2-digit" }),
      "4": payload.serviceName,
      "5": tenant.name,
      "6": final,
    };
  } else if (template === "birthday") {
    const bPayload = payload as unknown as BirthdayNotificationPayload;
    contentVariables = {
      "1": bPayload.customerName,
      "2": principal,
      "3": tenant.name,
      "4": final,
    };
  } else {
    contentVariables = {
      "1": payload.customerName,
      "2": principal,
      "3": payload.serviceName,
      "4": tenant.name,
      "5": final,
    };
  }

  return { contentSid, contentVariables };
}

async function sendWithRetry(
  client: ReturnType<typeof twilio>,
  params: Parameters<typeof client.messages.create>[0],
  maxRetries = 2,
): Promise<Awaited<ReturnType<typeof client.messages.create>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw lastError;
}

export class TwilioProvider implements IWhatsAppProvider {
  private getClient() {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  async send(draft: NotificationDraft, tenant: TenantWhatsAppConfig): Promise<SendResult> {
    let to: string;
    try {
      to = toWhatsAppNumber(draft.recipient);
    } catch {
      return { success: false, errorMessage: `Telefone inválido: ${draft.recipient}`, provider: "twilio" };
    }

    const payload = draft.payload as AppointmentNotificationPayload;
    const { contentSid, contentVariables } = buildTwilioTemplateParams(draft.template, payload, tenant);

    try {
      const client = this.getClient();
      const message = await sendWithRetry(client, {
        from: process.env.TWILIO_WHATSAPP_FROM,
        to,
        contentSid,
        contentVariables: JSON.stringify(contentVariables),
        statusCallback: `${process.env.APP_URL}/api/webhooks/twilio/status`,
      });
      return { success: true, externalId: message.sid, provider: "twilio" };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Erro ao enviar via Twilio.",
        provider: "twilio",
      };
    }
  }
}

export const twilioProvider = new TwilioProvider();
// alias retrocompatível com código existente que já importa whatsAppProvider
export const whatsAppProvider = twilioProvider;
