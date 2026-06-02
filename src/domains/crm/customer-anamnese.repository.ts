import { prisma } from "@/shared/database/prisma";
import type { AnamneseData, AnamneseHistorySnapshot } from "./types";

const MAX_HISTORY = 10;

export class CustomerAnamneseRepository {
  async findByCustomer(tenantId: string, customerId: string) {
    return prisma.customerAnamnese.findFirst({
      where: { customerId, tenantId },
    });
  }

  async findByPublicToken(publicToken: string) {
    return prisma.customerAnamnese.findFirst({
      where: { publicToken },
      include: {
        customer: { select: { name: true, tenantId: true } },
      },
    });
  }

  async save(
    tenantId: string,
    customerId: string,
    data: AnamneseData,
    savedBy: "professional" | "client",
  ) {
    const existing = await this.findByCustomer(tenantId, customerId);

    const rawHistory = (existing?.history ?? []) as AnamneseHistorySnapshot[];
    const snapshot: AnamneseHistorySnapshot = {
      data: (existing?.data ?? {}) as AnamneseData,
      savedAt: new Date().toISOString(),
      savedBy,
    };
    const history = [...rawHistory, snapshot].slice(-MAX_HISTORY);

    return prisma.customerAnamnese.upsert({
      where: { customerId },
      create: {
        tenantId,
        customerId,
        data: data as object,
        history: history as object[],
        filledAt: new Date(),
        filledBy: savedBy,
      },
      update: {
        data: data as object,
        history: history as object[],
        filledAt: new Date(),
        filledBy: savedBy,
      },
    });
  }
}

export const customerAnamneseRepository = new CustomerAnamneseRepository();
