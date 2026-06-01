import type { NotificationDraft } from "../types";

export type SendResult = {
  success: boolean;
  externalId?: string;
  errorMessage?: string;
  provider: "evolution" | "twilio" | "evolution→twilio";
};

export type TenantWhatsAppConfig = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  whatsappEnabled: boolean;
  whatsappTemplateConfig: unknown;
  evolutionInstanceId: string | null;
  evolutionConnected: boolean;
  evolutionStatus: string;
  evolutionPhone: string | null;
};

export interface IWhatsAppProvider {
  send(draft: NotificationDraft, tenant: TenantWhatsAppConfig): Promise<SendResult>;
}
