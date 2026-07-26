import twilio from "twilio";

import { InvalidPhoneError } from "@/shared/errors";
import type { NotificationDraft } from "../types";
import type { IWhatsAppProvider, SendResult, TenantWhatsAppConfig } from "./whatsapp-provider.interface";
import type { RenderedCustomerMessage } from "../customer-messages/types";

const REQUIRED_TWILIO_VARS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  "APP_URL",
] as const;

function assertTwilioConfigured(): void {
  for (const key of REQUIRED_TWILIO_VARS) {
    if (!process.env[key]) {
      throw new Error(`[TwilioProvider] Env var ${key} não configurada`);
    }
  }
}

function toWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    throw new InvalidPhoneError(raw);
  }
  const e164 = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
  return `whatsapp:${e164}`;
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

  /**
   * Fallback. Envia o texto já renderizado como `body`, o que só é aceito pelo WhatsApp
   * Business dentro da janela de 24 h de atendimento. Fora dela a Meta exige template
   * pré-aprovado — incompatível com texto livre escrito pelo tenant. Aceitável porque a
   * Evolution é o provedor primário; a alternativa (manter contentSid) faria a
   * personalização do tenant ser ignorada em silêncio.
   */
  async send(
    draft: NotificationDraft,
    _tenant: TenantWhatsAppConfig,
    rendered: RenderedCustomerMessage,
  ): Promise<SendResult> {
    try {
      assertTwilioConfigured();
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Twilio não configurado.",
        provider: "twilio",
      };
    }

    let to: string;
    try {
      to = toWhatsAppNumber(draft.recipient);
    } catch {
      return { success: false, errorMessage: `Telefone inválido: ${draft.recipient}`, provider: "twilio" };
    }

    try {
      const client = this.getClient();
      const message = await sendWithRetry(client, {
        from: process.env.TWILIO_WHATSAPP_FROM,
        to,
        body: rendered.text,
        ...(rendered.mediaUrl ? { mediaUrl: [rendered.mediaUrl] } : {}),
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
