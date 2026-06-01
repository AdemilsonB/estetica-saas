import { prisma } from "@/shared/database/prisma";
import { Prisma } from "@prisma/client";
import type { DiscountApplyType } from "@prisma/client";

export type CreateDiscountTypeInput = {
  name: string;
  type: DiscountApplyType;
  defaultValue?: number;
};

export class DiscountTypeRepository {
  async list(tenantId: string, onlyActive = false) {
    return prisma.discountType.findMany({
      where: { tenantId, ...(onlyActive && { active: true }) },
      orderBy: { name: "asc" },
    });
  }

  async create(tenantId: string, input: CreateDiscountTypeInput) {
    return prisma.discountType.create({
      data: {
        tenantId,
        name: input.name,
        type: input.type,
        defaultValue: input.defaultValue !== undefined ? new Prisma.Decimal(input.defaultValue) : undefined,
      },
    });
  }

  async update(tenantId: string, id: string, data: Partial<CreateDiscountTypeInput> & { active?: boolean }) {
    return prisma.discountType.updateMany({
      where: { id, tenantId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.type && { type: data.type }),
        ...(data.defaultValue !== undefined && { defaultValue: new Prisma.Decimal(data.defaultValue) }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    return prisma.discountType.updateMany({ where: { id, tenantId }, data: { active: false } });
  }
}

export const discountTypeRepository = new DiscountTypeRepository();
