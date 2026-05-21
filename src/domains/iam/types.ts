import { UserRole } from "@prisma/client";
import { z } from "zod";

export const userRoleSchema = z.nativeEnum(UserRole);

export const sessionSummarySchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  role: userRoleSchema,
  permissions: z.array(z.string()),
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;
