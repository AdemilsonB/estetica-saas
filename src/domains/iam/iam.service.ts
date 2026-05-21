import { prisma } from "@/shared/database/prisma";
import { NotFoundError } from "@/shared/errors";
import type { SessionContext } from "@/shared/types/auth";

export class IamService {
  async getCurrentUser(session: SessionContext) {
    const user = await prisma.user.findFirst({
      where: {
        id: session.userId,
        tenantId: session.tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
      },
    });

    if (!user) {
      throw new NotFoundError("Usuario");
    }

    return user;
  }
}

export const iamService = new IamService();
