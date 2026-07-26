import type { CustomerMessageTemplate } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

import type { CustomerMessageChannel, CustomerMessageEventKey } from "./types";

export type CustomerMessageTemplateInput = {
  event: CustomerMessageEventKey;
  channel: CustomerMessageChannel;
  subject: string | null;
  body: string;
  mediaUrl: string | null;
};

export class CustomerMessageTemplateRepository {
  async findByEvent(
    tenantId: string,
    event: CustomerMessageEventKey,
    channel: CustomerMessageChannel,
  ): Promise<CustomerMessageTemplate | null> {
    return prisma.customerMessageTemplate.findFirst({
      where: { tenantId, event, channel },
    });
  }

  async listByTenant(tenantId: string): Promise<CustomerMessageTemplate[]> {
    return prisma.customerMessageTemplate.findMany({ where: { tenantId } });
  }

  async upsert(
    tenantId: string,
    input: CustomerMessageTemplateInput,
  ): Promise<CustomerMessageTemplate> {
    return prisma.customerMessageTemplate.upsert({
      where: {
        tenantId_event_channel: { tenantId, event: input.event, channel: input.channel },
      },
      create: {
        tenantId,
        event: input.event,
        channel: input.channel,
        subject: input.subject,
        body: input.body,
        mediaUrl: input.mediaUrl,
      },
      update: { subject: input.subject, body: input.body, mediaUrl: input.mediaUrl },
    });
  }

  /**
   * Apagar o registro é o que "restaurar padrão" faz: sem registro, a resolução cai
   * no catálogo do sistema. `deleteMany` em vez de `delete` para não lançar quando
   * o tenant nunca personalizou aquele evento.
   */
  async remove(
    tenantId: string,
    event: CustomerMessageEventKey,
    channel: CustomerMessageChannel,
  ): Promise<void> {
    await prisma.customerMessageTemplate.deleteMany({ where: { tenantId, event, channel } });
  }
}

export const customerMessageTemplateRepository = new CustomerMessageTemplateRepository();
