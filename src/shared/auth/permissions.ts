import { UserRole } from "@prisma/client";

import { ForbiddenError } from "@/shared/errors";
import type { SessionContext } from "@/shared/types/auth";

export const PERMISSIONS = {
  appointments: {
    view: "appointments:view",
    create: "appointments:create",
    edit: "appointments:edit",
    delete: "appointments:delete",
  },
  customers: {
    view: "customers:view",
    create: "customers:create",
    edit: "customers:edit",
  },
  financial: {
    view: "financial:view",
    manage: "financial:manage",
  },
  users: {
    view: "users:view",
    invite: "users:invite",
    manage: "users:manage",
  },
  services: {
    view: "services:view",
    manage: "services:manage",
  },
  settings: {
    view: "settings:view",
    manage: "settings:manage",
  },
} as const;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.OWNER]: Object.values(PERMISSIONS).flatMap((group) =>
    Object.values(group),
  ),
  [UserRole.MANAGER]: [
    PERMISSIONS.appointments.view,
    PERMISSIONS.appointments.create,
    PERMISSIONS.appointments.edit,
    PERMISSIONS.customers.view,
    PERMISSIONS.customers.create,
    PERMISSIONS.customers.edit,
    PERMISSIONS.financial.view,
    PERMISSIONS.services.view,
    PERMISSIONS.services.manage,
    PERMISSIONS.users.view,
    PERMISSIONS.settings.view,
    PERMISSIONS.settings.manage,
  ],
  [UserRole.PROFESSIONAL]: [
    PERMISSIONS.appointments.view,
    PERMISSIONS.appointments.create,
    PERMISSIONS.customers.view,
    PERMISSIONS.services.view,
  ],
  [UserRole.RECEPTIONIST]: [
    PERMISSIONS.appointments.view,
    PERMISSIONS.appointments.create,
    PERMISSIONS.appointments.edit,
    PERMISSIONS.customers.view,
    PERMISSIONS.customers.create,
    PERMISSIONS.customers.edit,
    PERMISSIONS.services.view,
  ],
};

export function ensurePermission(
  session: SessionContext,
  permission: string,
) {
  const rolePermissions = ROLE_PERMISSIONS[session.role] ?? [];
  const permissions = new Set([...rolePermissions, ...session.permissions]);

  if (!permissions.has(permission)) {
    throw new ForbiddenError("Permissao insuficiente para esta operacao.");
  }
}
