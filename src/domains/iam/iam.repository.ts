import { UserRole } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import { ROLE_PERMISSIONS } from "@/shared/auth/permissions";
import { buildDefaultRolePermissions } from "@/shared/permissions/nav-registry";

type CreateTenantWithOwnerInput = {
  userId: string;
  email: string;
  businessName: string;
  userName: string;
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string;
    backgroundColor?: string;
  };
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export class IamRepository {
  async createTenantWithOwner(input: CreateTenantWithOwnerInput) {
    const slug = generateSlug(input.businessName);

    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.businessName,
          slug,
        },
      });

      await tx.brandingConfig.create({
        data: {
          tenantId: tenant.id,
          ...(input.branding ?? {}),
        },
      });

      const user = await tx.user.create({
        data: {
          id: input.userId,
          tenantId: tenant.id,
          email: input.email,
          name: input.userName,
          role: UserRole.OWNER,
          permissions: ROLE_PERMISSIONS[UserRole.OWNER],
        },
      });

      await tx.role.createMany({
        data: (
          [
            { preset: "MANAGER" as const, name: "Gerente" },
            { preset: "PROFESSIONAL" as const, name: "Profissional" },
            { preset: "RECEPTIONIST" as const, name: "Recepcionista" },
          ] as const
        ).map(({ preset, name }) => ({
          tenantId: tenant.id,
          name,
          isDefault: true,
          permissions: buildDefaultRolePermissions(preset),
        })),
      });

      return { tenant, user };
    });
  }

  async findTenantBySlug(slug: string) {
    return prisma.tenant.findUnique({ where: { slug } });
  }

  async findAllUsers(tenantId: string) {
    const users = await prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roleId: true,
        customRole: { select: { name: true } },
        createdAt: true,
      },
    })
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isOwner: u.role === "OWNER",
      roleId: u.roleId,
      roleName: u.role === "OWNER" ? "Dono" : (u.customRole?.name ?? "Sem cargo"),
      createdAt: u.createdAt,
    }))
  }

  async countActiveUsers(tenantId: string): Promise<number> {
    return prisma.user.count({ where: { tenantId } });
  }

  async findUserById(tenantId: string, userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
  }

  async updateUserRole(tenantId: string, userId: string, role: UserRole) {
    await prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { role, permissions: ROLE_PERMISSIONS[role] },
    });
    return prisma.user.findFirstOrThrow({
      where: { id: userId, tenantId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }

  async createInvite(tenantId: string, email: string, role: UserRole) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return prisma.tenantInvite.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { role, status: "PENDING", expiresAt },
      create: { tenantId, email, role, expiresAt },
    });
  }

  async createInviteByRoleId(tenantId: string, email: string, roleId: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return prisma.tenantInvite.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { roleId, status: "PENDING", expiresAt },
      create: { tenantId, email, role: "PROFESSIONAL" as any, roleId, expiresAt },
    });
  }

  async findInvites(tenantId: string) {
    return prisma.tenantInvite.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  }

  async findInviteByEmailAndTenant(email: string, tenantId: string) {
    return prisma.tenantInvite.findFirst({
      where: { email, tenantId, status: "PENDING" },
    });
  }

  async acceptInvite(inviteId: string) {
    await prisma.tenantInvite.update({
      where: { id: inviteId },
      data: { status: "ACCEPTED" },
    });
  }

  async deleteInvite(tenantId: string, inviteId: string) {
    return prisma.tenantInvite.deleteMany({
      where: { id: inviteId, tenantId, status: 'PENDING' },
    })
  }

  async createUserInTenant(input: {
    userId: string;
    tenantId: string;
    email: string;
    name: string;
    role: UserRole;
    roleId?: string;
  }) {
    return prisma.user.create({
      data: {
        id: input.userId,
        tenantId: input.tenantId,
        email: input.email,
        name: input.name,
        role: input.role,
        roleId: input.roleId ?? null,
        permissions: ROLE_PERMISSIONS[input.role],
      },
    });
  }

  async updateUserRoleById(tenantId: string, userId: string, roleId: string) {
    await prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { roleId },
    });
    return prisma.user.findFirstOrThrow({
      where: { id: userId, tenantId },
      select: { id: true, name: true, email: true, role: true, roleId: true, createdAt: true },
    });
  }

  async findTenant(tenantId: string) {
    return prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
      },
    });
  }

  async updateTenant(
    tenantId: string,
    data: { name?: string; phone?: string | null; address?: string | null },
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
      },
    });
  }

  static defaultBusinessHours(): Record<string, { open: string; close: string; active: boolean }> {
    return {
      "0": { open: "09:00", close: "18:00", active: false },
      "1": { open: "09:00", close: "18:00", active: true },
      "2": { open: "09:00", close: "18:00", active: true },
      "3": { open: "09:00", close: "18:00", active: true },
      "4": { open: "09:00", close: "18:00", active: true },
      "5": { open: "09:00", close: "18:00", active: true },
      "6": { open: "09:00", close: "13:00", active: true },
    };
  }

  async getBusinessHours(tenantId: string) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { businessHours: true },
    });
    return (tenant?.businessHours as Record<string, { open: string; close: string; active: boolean }> | null)
      ?? IamRepository.defaultBusinessHours();
  }

  async updateBusinessHours(
    tenantId: string,
    hours: Record<string, { open: string; close: string; active: boolean }>,
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { businessHours: hours },
      select: { businessHours: true },
    });
  }
}

export const iamRepository = new IamRepository();
