import { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { NotFoundError, ConflictError } from "@/shared/errors";
import { iamRepository } from "./iam.repository";
import type { SessionContext } from "@/shared/types/auth";

type RegisterInput = {
  businessName: string;
  userName: string;
};

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

  async register(userId: string, input: RegisterInput) {
    const { data: authUser, error } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !authUser.user) {
      throw new NotFoundError("Usuario Supabase");
    }

    let createResult: Awaited<
      ReturnType<typeof iamRepository.createTenantWithOwner>
    >;
    try {
      createResult = await iamRepository.createTenantWithOwner({
        userId,
        email: authUser.user.email!,
        businessName: input.businessName,
        userName: input.userName,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictError("Tenant ja cadastrado para este usuario.");
      }
      throw err;
    }

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        tenantId: createResult.tenant.id,
        role: UserRole.OWNER,
      },
    });

    return { tenantId: createResult.tenant.id, userId: createResult.user.id };
  }
}

export const iamService = new IamService();
