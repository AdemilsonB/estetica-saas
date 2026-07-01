import { Prisma, TenantDocumentType, UserRole } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { NotFoundError, ConflictError, ForbiddenError, UserNotFoundError, ValidationError } from "@/shared/errors";
import { iamRepository } from "./iam.repository";
import { resolveImageCrop } from "@/shared/utils/image-crop";
import { validarCpf } from "@/shared/utils/cpf";
import { validarCnpj } from "@/shared/utils/cnpj";
import type { SessionContext } from "@/shared/types/auth";
import { featureGuard } from "@/domains/billing/feature-guard";
import { resolveGooglePlaceId } from "@/lib/google-places";

type RegisterInput = {
  businessName: string;
  userName: string;
  documentType: TenantDocumentType;
  document: string;
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
        avatarUrl: true,
        avatarCropX: true,
        avatarCropY: true,
        avatarCropZoom: true,
        customRole: { select: { id: true, name: true } },
        tenant: { select: { name: true, slug: true } },
      },
    });

    if (!user) {
      throw new NotFoundError("Usuario");
    }

    // Prioridade: foto manual do DB > OAuth avatar_url (Google etc.) > null
    // Foto manual é escolha explícita do usuário — deve prevalecer sobre OAuth
    let oauthAvatarUrl: string | null = null
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(session.userId)
      const raw = authData?.user?.user_metadata?.['avatar_url']
      if (typeof raw === 'string' && raw.length > 0) oauthAvatarUrl = raw
    } catch {
      // avatar_url é dado não-crítico; degrada para null sem derrubar o endpoint
    }
    const avatarUrl = user.avatarUrl ?? oauthAvatarUrl

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      isOwner: session.isOwner,
      roleId: user.roleId,
      roleName: session.isOwner ? "Dono" : (user.customRole?.name ?? "Sem cargo"),
      permissions: session.permissions,
      businessName: user.tenant.name,
      tenantSlug: user.tenant.slug,
      avatarUrl,
      avatarCropX: user.avatarCropX,
      avatarCropY: user.avatarCropY,
      avatarCropZoom: user.avatarCropZoom,
    };
  }

  async register(userId: string, input: RegisterInput) {
    const { data: authUser, error } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !authUser.user) {
      throw new NotFoundError("Usuario Supabase");
    }

    if (authUser.user.app_metadata?.isSystemAdmin) {
      throw new ForbiddenError(
        "Contas de administrador do sistema não podem criar ou possuir um negócio.",
      );
    }

    const meta = (authUser.user.user_metadata ?? {}) as Record<string, string>

    const document = input.document.replace(/\D/g, "");
    const isValidDocument =
      input.documentType === TenantDocumentType.CPF
        ? validarCpf(document)
        : validarCnpj(document);
    if (!isValidDocument) {
      throw new ValidationError(
        input.documentType === TenantDocumentType.CPF
          ? "CPF invalido."
          : "CNPJ invalido.",
      );
    }

    const existingByDocument = await iamRepository.findTenantByDocument(document);
    if (existingByDocument) {
      throw new ConflictError("Este CPF/CNPJ ja esta cadastrado para outro negocio.");
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
        documentType: input.documentType,
        document,
        branding: input.branding,
        ownerPhone: meta.phone,
        ownerCpf: meta.cpf,
        zipCode: meta.cep,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictError("Este CPF/CNPJ ja esta cadastrado para outro negocio.");
      }
      throw err;
    }

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        tenantId: createResult.tenant.id,
        role: UserRole.OWNER,
      },
      user_metadata: {
        onboardingStep: 'plan',
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

  async cancelInvite(tenantId: string, inviteId: string): Promise<void> {
    const { count } = await iamRepository.deleteInvite(tenantId, inviteId)
    if (count === 0) throw new NotFoundError('Convite')
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

  async updateMember(
    tenantId: string,
    requesterId: string,
    targetId: string,
    input: {
      name?: string
      email?: string
      avatarUrl?: string | null
      avatarCropX?: number | null
      avatarCropY?: number | null
      avatarCropZoom?: number | null
      bio?: string | null
      showOnPublicPage?: boolean
    },
  ) {
    const requester = await iamRepository.findUserById(tenantId, requesterId)
    if (!requester) throw new UserNotFoundError()

    const target = await iamRepository.findUserById(tenantId, targetId)
    if (!target) throw new UserNotFoundError()

    const isOwner = requester.role === UserRole.OWNER
    const isManager = requester.role === UserRole.MANAGER
    const isSelf = requesterId === targetId

    if (isOwner) {
      // OWNER pode editar qualquer membro, inclusive si mesmo
    } else if (isManager) {
      if (!isSelf && (target.role === UserRole.OWNER || target.role === UserRole.MANAGER)) {
        throw new ForbiddenError('Gerentes não podem editar o dono ou outros gerentes.')
      }
    } else {
      throw new ForbiddenError('Sem permissão para editar membros.')
    }

    if (input.email && input.email !== target.email) {
      const conflict = await prisma.user.findFirst({ where: { tenantId, email: input.email } })
      if (conflict) throw new ConflictError('E-mail já cadastrado neste negócio.')
    }

    const crop = resolveImageCrop(input.avatarUrl !== undefined, {
      x: input.avatarCropX,
      y: input.avatarCropY,
      zoom: input.avatarCropZoom,
    })
    return iamRepository.updateUser(tenantId, targetId, {
      ...input,
      avatarCropX: crop.x,
      avatarCropY: crop.y,
      avatarCropZoom: crop.zoom,
    })
  }

  async setMemberServices(tenantId: string, requesterId: string, userId: string, serviceIds: string[]) {
    // Mesma hierarquia de updateMember: gerentes não podem alterar dono/outros gerentes.
    const requester = await iamRepository.findUserById(tenantId, requesterId)
    if (!requester) throw new UserNotFoundError()
    const target = await iamRepository.findUserById(tenantId, userId)
    if (!target) throw new UserNotFoundError()

    const isOwner = requester.role === UserRole.OWNER
    const isManager = requester.role === UserRole.MANAGER
    const isSelf = requesterId === userId

    if (isOwner) {
      // OWNER pode gerenciar serviços de qualquer membro
    } else if (isManager) {
      if (!isSelf && (target.role === UserRole.OWNER || target.role === UserRole.MANAGER)) {
        throw new ForbiddenError('Gerentes não podem alterar serviços do dono ou de outros gerentes.')
      }
    } else {
      throw new ForbiddenError('Sem permissão para alterar serviços de membros.')
    }

    const currentServices = await iamRepository.findUserServices(tenantId, userId)
    const currentServiceIds = new Set(currentServices.map((ps) => ps.serviceId))
    const newServiceIds = serviceIds.filter((id) => !currentServiceIds.has(id))

    const updated = await iamRepository.setUserServices(tenantId, userId, serviceIds)

    await prisma.serviceCommission.createMany({
      data: newServiceIds.map((serviceId) => ({
        tenantId,
        serviceId,
        professionalId: userId,
        rate: 0,
      })),
      skipDuplicates: true,
    })

    return updated
  }

  async getMemberServices(tenantId: string, userId: string) {
    return iamRepository.findUserServices(tenantId, userId)
  }

  async joinTenant(
    userId: string,
    email: string,
    pendingTenantId: string,
    pendingRoleId: string,
    userName: string,
  ) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser.user?.app_metadata?.isSystemAdmin) {
      throw new ForbiddenError(
        "Contas de administrador do sistema não podem ingressar em um negócio.",
      );
    }

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
    data: {
      name?: string
      phone?: string | null
      address?: string | null
      bio?: string | null
      instagramUrl?: string | null
      coverImageUrl?: string | null
      whatsappContactEnabled?: boolean
      googleBusinessUrl?: string | null
      googlePlaceId?: string | null
    },
  ) {
    const payload = { ...data }
    if ('googleBusinessUrl' in data) {
      payload.googlePlaceId = data.googleBusinessUrl
        ? await resolveGooglePlaceId(data.googleBusinessUrl)
        : null
    }
    return iamRepository.updateTenant(tenantId, payload)
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

  async listProfessionalsByService(tenantId: string, serviceId: string) {
    return iamRepository.findProfessionalsByService(tenantId, serviceId);
  }
}

export const iamService = new IamService();
