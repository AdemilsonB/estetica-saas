import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class NotificationRepository {
  async createLog(
    tenantId: string,
    data: Prisma.NotificationLogUncheckedCreateInput,
  ) {
    return prisma.notificationLog.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }
}

export const notificationRepository = new NotificationRepository();
