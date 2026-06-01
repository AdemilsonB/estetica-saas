import { env } from "@/shared/config/env";
import { InvalidPhoneError } from "@/shared/errors";
import type { NotificationDraft } from "../types";
import type { IWhatsAppProvider, SendResult, TenantWhatsAppConfig } from "./whatsapp-provider.interface";

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

type AppointmentPayload = {
  appointmentId: string;
  customerName: string;
  serviceName: string;
  startsAt?: string;
  status?: string;
};

type TemplateConfig = { mensagemPrincipal?: string; mensagemFinal?: string };

function toE164Number(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    throw new InvalidPhoneError(raw);
  }
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function fmt(isoString: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, ...options }).format(new Date(isoString));
}

export function buildEvolutionMessage(
  template: string,
  payload: AppointmentPayload,
  tenant: Pick<TenantWhatsAppConfig, "name" | "slug" | "timezone" | "whatsappTemplateConfig">,
): string {
  const configKey = TEMPLATE_TO_CONFIG_KEY[template];
  const rawConfigs = tenant.whatsappTemplateConfig as Record<string, TemplateConfig> | null;
  const config = rawConfigs?.[configKey] ?? {};
  const defaults = TEMPLATE_DEFAULTS[configKey];

  const principal = config.mensagemPrincipal ?? defaults.mensagemPrincipal;
  const final = config.mensagemFinal ?? defaults.mensagemFinal;
  const tz = tenant.timezone;

  if (template === "appointment-created" || template === "appointment-confirmed") {
    if (!payload.startsAt) {
      return `Olá, ${payload.customerName}! ${principal} | ${payload.serviceName} | ${tenant.name}. ${final}`;
    }
    const date = fmt(payload.startsAt, tz, { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = fmt(payload.startsAt, tz, { hour: "2-digit", minute: "2-digit" });
    const link = `${process.env.APP_URL ?? ""}/agendar/${tenant.slug}`;
    return `Olá, ${payload.customerName}! ${principal} 📅 ${date} às ${time} | ${payload.serviceName} | ${tenant.name}. ${final} 🔗 ${link}`;
  }

  if (template === "appointment-reminder") {
    if (!payload.startsAt) {
      return `Olá, ${payload.customerName}! ${principal} | ${payload.serviceName} | ${tenant.name}. ${final}`;
    }
    const time = fmt(payload.startsAt, tz, { hour: "2-digit", minute: "2-digit" });
    return `Olá, ${payload.customerName}! ${principal} Hoje às ${time} | ${payload.serviceName} | ${tenant.name}. ${final}`;
  }

  if (template === "birthday") {
    return `Olá, ${payload.customerName}! ${principal} De ${tenant.name}. ${final}`;
  }

  // cancelamento / nao_comparecimento
  return `Olá, ${payload.customerName}! ${principal} | ${payload.serviceName} | ${tenant.name}. ${final}`;
}

export class EvolutionProvider implements IWhatsAppProvider {
  private get baseUrl(): string {
    return (env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
  }

  private get apiKey(): string {
    return env.EVOLUTION_API_KEY ?? "";
  }

  private headers() {
    return { "Content-Type": "application/json", apikey: this.apiKey };
  }

  async send(draft: NotificationDraft, tenant: TenantWhatsAppConfig): Promise<SendResult> {
    if (!tenant.evolutionInstanceId) {
      return { success: false, errorMessage: "Instância Evolution não configurada.", provider: "evolution" };
    }

    let number: string;
    try {
      number = toE164Number(draft.recipient);
    } catch {
      return { success: false, errorMessage: `Telefone inválido: ${draft.recipient}`, provider: "evolution" };
    }

    const text = buildEvolutionMessage(draft.template, draft.payload as AppointmentPayload, tenant);

    try {
      const response = await fetch(
        `${this.baseUrl}/message/sendText/${tenant.evolutionInstanceId}`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ number, text }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          errorMessage: `Evolution API error ${response.status}: ${JSON.stringify(body)}`,
          provider: "evolution",
        };
      }

      const data = await response.json();
      return { success: true, externalId: data?.key?.id, provider: "evolution" };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Erro ao enviar via Evolution.",
        provider: "evolution",
      };
    }
  }

  async createInstance(instanceName: string): Promise<{ qrCode: string }> {
    const response = await fetch(`${this.baseUrl}/instance/create`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar instância Evolution: ${response.status}`);
    }

    const data = await response.json();
    const qrCode: string = data?.qrcode?.base64 ?? "";
    return { qrCode };
  }

  async configureWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    await fetch(`${this.baseUrl}/webhook/set/${instanceName}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: true,
        webhook_base64: false,
        events: ["CONNECTION_UPDATE"],
      }),
    });
  }

  async getQrCode(instanceName: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/instance/connect/${instanceName}`, {
      headers: this.headers(),
    });

    if (!response.ok) throw new Error(`Erro ao obter QR Code: ${response.status}`);

    const data = await response.json();
    return data?.base64 ?? "";
  }

  async getStatus(instanceName: string): Promise<"CONNECTED" | "CONNECTING" | "DISCONNECTED" | "ERROR"> {
    try {
      const response = await fetch(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
        headers: this.headers(),
      });

      if (!response.ok) return "ERROR";

      const data = await response.json();
      const state: string = data?.instance?.state ?? "close";

      if (state === "open") return "CONNECTED";
      if (state === "connecting") return "CONNECTING";
      return "DISCONNECTED";
    } catch {
      return "ERROR";
    }
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await fetch(`${this.baseUrl}/instance/delete/${instanceName}`, {
      method: "DELETE",
      headers: this.headers(),
    });
  }

  async getContacts(instanceName: string): Promise<Array<{ id: string; pushName: string }>> {
    const response = await fetch(`${this.baseUrl}/chat/findContacts/${instanceName}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ where: {} }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }
}

export const evolutionProvider = new EvolutionProvider();
