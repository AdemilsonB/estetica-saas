import { UserRole } from "@prisma/client";

export type SessionContext = {
  tenantId: string;
  userId: string;
  role: UserRole;
  permissions: string[];
};
