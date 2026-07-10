import { prisma } from "@/shared/database/prisma";
import { Prisma } from "@prisma/client";
import type { DiscountApplyType } from "@prisma/client";
import { DiscountTypeInUseError, NotFoundError } from "@/shared/errors/domain-error";

export type CreateDiscountTypeInput = {
  name: string;
  type: DiscountApplyType;
  defaultValue?: number;
};

export class DiscountTypeRepository {
  async list(tenantId: string, onlyActive = false) {
    const types = await prisma.discountType.findMany({
      where: { tenantId, ...(onlyActive && { active: true }) },
      orderBy: { name: "asc" },
      include: { _count: { select: { appointments: true } } },
    });
    return types.map(({ _count, ...type }) => ({ ...type, inUse: _count.appointments > 0 }));
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

  /** Exclusão física quando nunca usado; senão bloqueia com DiscountTypeInUseError (usar archive). */
  async delete(tenantId: string, id: string) {
    const discountType = await prisma.discountType.findFirst({ where: { id, tenantId } });
    if (!discountType) throw new NotFoundError("Tipo de desconto");

    const usageCount = await prisma.appointment.count({ where: { discountTypeId: id } });
    if (usageCount > 0) throw new DiscountTypeInUseError();

    await prisma.discountType.delete({ where: { id } });
  }
}

export const discountTypeRepository = new DiscountTypeRepository();
