import { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { NotFoundError, ConflictError, ForbiddenError, UserNotFoundError } from "@/shared/errors";
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

  async listUsers(tenantId: string) {
    return iamRepository.findAllUsers(tenantId);
  }

  async updateUserRole(
    tenantId: string,
    requesterId: string,
    targetUserId: string,
    role: UserRole,
  ) {
    if (requesterId === targetUserId) {
      throw new ForbiddenError("Voce nao pode alterar seu proprio papel.");
    }
    const target = await iamRepository.findUserById(tenantId, targetUserId);
    if (!target) throw new UserNotFoundError();
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenError("O papel de OWNER nao pode ser alterado.");
    }
    return iamRepository.updateUserRole(tenantId, targetUserId, role);
  }

  async createInvite(tenantId: string, email: string, role: UserRole) {
    const invite = await iamRepository.createInvite(tenantId, email, role);
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { pendingTenantId: tenantId, pendingRole: role },
    });
    return invite;
  }

  async listInvites(tenantId: string) {
    return iamRepository.findInvites(tenantId);
  }

  async joinTenant(
    userId: string,
    email: string,
    pendingTenantId: string,
    pendingRole: UserRole,
    userName: string,
  ) {
    const invite = await iamRepository.findInviteByEmailAndTenant(email, pendingTenantId);
    if (!invite) throw new ForbiddenError("Convite nao encontrado ou expirado.");

    const user = await iamRepository.createUserInTenant({
      userId,
      tenantId: pendingTenantId,
      email,
      name: userName,
      role: pendingRole,
    });

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { tenantId: pendingTenantId, role: pendingRole },
    });

    await iamRepository.acceptInvite(invite.id);

    return user;
  }
}

export const iamService = new IamService();
