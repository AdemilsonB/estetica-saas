// TODO(Task 4): implementação completa da Evolution API
// Este stub garante que o TypeScript resolve o import dinâmico no WhatsAppGateway
// enquanto a Task 4 não está concluída.

import type { IWhatsAppProvider, SendResult, TenantWhatsAppConfig } from "./whatsapp-provider.interface";
import type { NotificationDraft } from "../types";

export class EvolutionProvider implements IWhatsAppProvider {
  async send(_draft: NotificationDraft, _tenant: TenantWhatsAppConfig): Promise<SendResult> {
    return { success: false, errorMessage: "EvolutionProvider não implementado.", provider: "evolution" };
  }
}

export const evolutionProvider = new EvolutionProvider();
