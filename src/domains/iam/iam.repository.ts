import { UserRole } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import { ROLE_PERMISSIONS } from "@/shared/auth/permissions";

type CreateTenantWithOwnerInput = {
  userId: string;
  email: string;
  businessName: string;
  userName: string;
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
          brandingConfig: {
            primaryColor: "#191919",
            logoUrl: null,
            displayName: input.businessName,
          },
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

      return { tenant, user };
    });
  }

  async findTenantBySlug(slug: string) {
    return prisma.tenant.findUnique({ where: { slug } });
  }
}

export const iamRepository = new IamRepository();
