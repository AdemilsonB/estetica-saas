import { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { NotFoundError, ConflictError, ForbiddenError, UserNotFoundError } from "@/shared/errors";
import { iamRepository } from "./iam.repository";
import type { SessionContext } from "@/shared/types/auth";
import { billingService } from "@/domains/billing/billing.service";
import { featureGuard } from "@/domains/billing/feature-guard";

type RegisterInput = {
  businessName: string;
  userName: string;
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string;
    backgroundColor?: string;
  };
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
        roleId: true,
        customRole: { select: { id: true, name: true } },
        tenant: { select: { name: true } },
      },
    });

    if (!user) {
      throw new NotFoundError("Usuario");
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      isOwner: session.isOwner,
      roleId: user.roleId,
      roleName: session.isOwner ? "Dono" : (user.customRole?.name ?? "Sem cargo"),
      permissions: session.permissions,
      businessName: user.tenant.name,
    };
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
        branding: input.branding,
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

    await billingService.startTrial(createResult.tenant.id);

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

  async createInvite(tenantId: string, email: string, roleId: string, origin?: string) {
    const userCount = await iamRepository.countActiveUsers(tenantId);
    await featureGuard.assertWithinLimit(tenantId, "users", userCount);

    const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundError("Cargo");

    const invite = await iamRepository.createInviteByRoleId(tenantId, email, roleId);
    const baseUrl = (origin ?? 'https://estetica-saas-product.vercel.app').replace(/\/$/, '');
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${baseUrl}/callback`,
      data: { pendingTenantId: tenantId, pendingRoleId: roleId },
    });
    return invite;
  }

  async listInvites(tenantId: string) {
    return iamRepository.findInvites(tenantId);
  }

  async updateUserRoleById(
    tenantId: string,
    requesterId: string,
    targetUserId: string,
    roleId: string,
  ) {
    if (requesterId === targetUserId) {
      throw new ForbiddenError("Voce nao pode alterar seu proprio papel.");
    }
    const target = await iamRepository.findUserById(tenantId, targetUserId);
    if (!target) throw new UserNotFoundError();
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenError("O papel de OWNER nao pode ser alterado.");
    }
    return iamRepository.updateUserRoleById(tenantId, targetUserId, roleId);
  }

  async joinTenant(
    userId: string,
    email: string,
    pendingTenantId: string,
    pendingRoleId: string,
    userName: string,
  ) {
    const invite = await iamRepository.findInviteByEmailAndTenant(email, pendingTenantId);
    if (!invite) throw new ForbiddenError("Convite nao encontrado ou expirado.");

    // roleId do convite tem prioridade; fallback para o roleId passado
    const effectiveRoleId = invite.roleId ?? pendingRoleId;

    const user = await iamRepository.createUserInTenant({
      userId,
      tenantId: pendingTenantId,
      email,
      name: userName,
      role: UserRole.PROFESSIONAL, // enum mantido por compatibilidade
      roleId: effectiveRoleId,
    });

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { tenantId: pendingTenantId },
    });

    await iamRepository.acceptInvite(invite.id);

    return user;
  }

  async getTenant(tenantId: string) {
    const tenant = await iamRepository.findTenant(tenantId);
    if (!tenant) throw new NotFoundError("Tenant nao encontrado.");
    return tenant;
  }

  async updateTenant(
    tenantId: string,
    data: { name?: string; phone?: string | null; address?: string | null },
  ) {
    return iamRepository.updateTenant(tenantId, data);
  }

  async getBusinessHours(tenantId: string) {
    return iamRepository.getBusinessHours(tenantId);
  }

  async updateBusinessHours(
    tenantId: string,
    hours: Record<string, { open: string; close: string; active: boolean }>,
  ) {
    return iamRepository.updateBusinessHours(tenantId, hours);
  }
}

export const iamService = new IamService();
