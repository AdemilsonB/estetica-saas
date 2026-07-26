import type { RenderedCustomerMessage } from "../customer-messages/types";
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
  phone: string | null;
  address: string | null;
  whatsappEnabled: boolean;
  whatsappTemplateConfig: unknown;
  evolutionInstanceId: string | null;
  evolutionConnected: boolean;
  evolutionStatus: string;
  evolutionPhone: string | null;
};

export interface IWhatsAppProvider {
  send(
    draft: NotificationDraft,
    tenant: TenantWhatsAppConfig,
    rendered: RenderedCustomerMessage,
  ): Promise<SendResult>;
}
