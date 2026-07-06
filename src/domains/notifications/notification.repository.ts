import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import type { NotificationLogFilter } from "./types";

export class NotificationRepository {
  async createLog(
    tenantId: string,
    data: Omit<Prisma.NotificationLogUncheckedCreateInput, "tenantId">,
  ) {
    return prisma.notificationLog.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async countEmailsThisMonth(tenantId: string): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return prisma.notificationLog.count({
      where: { tenantId, channel: "EMAIL", createdAt: { gte: start, lt: end } },
    });
  }

  async findMany(tenantId: string, filter: NotificationLogFilter) {
    const { template, status, startDate, endDate, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationLogWhereInput = {
      tenantId,
      ...(template && { template }),
      ...(status && { status }),
      ...(startDate || endDate
        ? { createdAt: { ...(startDate && { gte: startDate }), ...(endDate && { lte: endDate }) } }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}

export const notificationRepository = new NotificationRepository();
