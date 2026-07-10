import { prisma } from "@/shared/database/prisma";
import { Prisma } from "@prisma/client";

export class CommissionRepository {
  async listByTenant(tenantId: string) {
    return prisma.serviceCommission.findMany({
      where: { tenantId },
    });
  }

  async upsert(tenantId: string, serviceId: string, professionalId: string, rate: number) {
    return prisma.serviceCommission.upsert({
      where: { tenantId_serviceId_professionalId: { tenantId, serviceId, professionalId } },
      update: { rate: new Prisma.Decimal(rate) },
      create: { tenantId, serviceId, professionalId, rate: new Prisma.Decimal(rate) },
    });
  }

  async delete(tenantId: string, id: string) {
    return prisma.serviceCommission.deleteMany({ where: { id, tenantId } });
  }

  async findRate(tenantId: string, serviceId: string, professionalId: string) {
    return prisma.serviceCommission.findUnique({
      where: { tenantId_serviceId_professionalId: { tenantId, serviceId, professionalId } },
    });
  }

  async applyRateToRole(tenantId: string, roleId: string, rate: number) {
    const users = await prisma.user.findMany({
      where: { tenantId, roleId },
      select: { id: true, professionalServices: { select: { serviceId: true } } },
    });

    const pairs = users.flatMap((u) =>
      u.professionalServices.map((ps) => ({ serviceId: ps.serviceId, professionalId: u.id })),
    );

    if (pairs.length === 0) return { applied: 0 };

    await prisma.$transaction(
      pairs.map(({ serviceId, professionalId }) =>
        prisma.serviceCommission.upsert({
          where: { tenantId_serviceId_professionalId: { tenantId, serviceId, professionalId } },
          update: { rate: new Prisma.Decimal(rate) },
          create: { tenantId, serviceId, professionalId, rate: new Prisma.Decimal(rate) },
        }),
      ),
    );

    return { applied: pairs.length };
  }
}

export const commissionRepository = new CommissionRepository();
