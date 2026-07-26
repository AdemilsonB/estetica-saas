import { interpolateTemplate } from "../user-notifications/notification-template-engine";

import { getCatalogEntry } from "./customer-message-catalog";
import {
  buildCustomerMessageVariables,
  type CustomerMessageContext,
} from "./customer-message-variables";
import { customerMessageTemplateRepository } from "./customer-message-template.repository";
import type {
  CustomerMessageChannel,
  CustomerMessageEventKey,
  RenderedCustomerMessage,
} from "./types";

export type ResolvedCustomerTemplate = {
  subject: string | null;
  body: string;
  mediaUrl: string | null;
  /** true = o tenant personalizou; false = está usando a mensagem padrão do sistema. */
  isCustom: boolean;
};

export class CustomerMessageService {
  /**
   * Duas camadas: personalização do tenant sobrescreve o padrão do sistema. Ausência de
   * registro no banco significa "usa o padrão", nunca "sem mensagem".
   */
  async resolveTemplate(
    tenantId: string,
    event: CustomerMessageEventKey,
    channel: CustomerMessageChannel,
  ): Promise<ResolvedCustomerTemplate> {
    const personalizado = await customerMessageTemplateRepository.findByEvent(
      tenantId,
      event,
      channel,
    );

    if (personalizado) {
      return {
        subject: personalizado.subject,
        body: personalizado.body,
        mediaUrl: personalizado.mediaUrl,
        isCustom: true,
      };
    }

    const padrao = getCatalogEntry(event).defaults[channel];
    return { subject: padrao.subject, body: padrao.body, mediaUrl: null, isCustom: false };
  }

  async render(
    tenantId: string,
    event: CustomerMessageEventKey,
    channel: CustomerMessageChannel,
    ctx: CustomerMessageContext,
  ): Promise<RenderedCustomerMessage> {
    const template = await this.resolveTemplate(tenantId, event, channel);
    const variaveis = buildCustomerMessageVariables(ctx);
    const escapar = channel === "EMAIL";

    return {
      subject: template.subject ? interpolateTemplate(template.subject, variaveis, escapar) : null,
      text: interpolateTemplate(template.body, variaveis, escapar),
      mediaUrl: template.mediaUrl,
    };
  }
}

export const customerMessageService = new CustomerMessageService();
