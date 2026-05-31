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
