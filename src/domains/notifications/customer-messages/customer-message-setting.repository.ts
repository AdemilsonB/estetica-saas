import type { CustomerMessageSetting } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

import type { CustomerMessageChannel, CustomerMessageEventKey } from "./types";

export type CustomerMessageSettingInput = {
  event: CustomerMessageEventKey;
  enabled: boolean;
  channels: CustomerMessageChannel[];
};

export class CustomerMessageSettingRepository {
  async findByEvent(
    tenantId: string,
    event: CustomerMessageEventKey,
  ): Promise<CustomerMessageSetting | null> {
    return prisma.customerMessageSetting.findFirst({ where: { tenantId, event } });
  }

  async listByTenant(tenantId: string): Promise<CustomerMessageSetting[]> {
    return prisma.customerMessageSetting.findMany({ where: { tenantId } });
  }

  /**
   * O registro só passa a existir quando o tenant muda alguma coisa. Enquanto não
   * existir, a resolução cai no padrão do catálogo — mesma regra dos templates.
   * `tenantId` vem sempre do argumento (extraído da sessão), nunca do input.
   */
  async upsert(
    tenantId: string,
    input: CustomerMessageSettingInput,
  ): Promise<CustomerMessageSetting> {
    return prisma.customerMessageSetting.upsert({
      where: { tenantId_event: { tenantId, event: input.event } },
      create: {
        tenantId,
        event: input.event,
        enabled: input.enabled,
        channels: input.channels,
      },
      update: { enabled: input.enabled, channels: input.channels },
    });
  }
}

export const customerMessageSettingRepository = new CustomerMessageSettingRepository();
