import { UserRole } from "@prisma/client";

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

    const existingUser = await prisma.user.findFirst({ where: { id: userId } });
    if (existingUser) {
      throw new ConflictError("Tenant ja cadastrado para este usuario.");
    }

    const { tenant, user } = await iamRepository.createTenantWithOwner({
      userId,
      email: authUser.user.email!,
      businessName: input.businessName,
      userName: input.userName,
    });

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        tenantId: tenant.id,
        role: UserRole.OWNER,
      },
    });

    return { tenantId: tenant.id, userId: user.id };
  }
}

export const iamService = new IamService();
