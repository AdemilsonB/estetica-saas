// src/app/api/iam/users/[userId]/route.ts
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const updateRoleSchema = z.object({
  role: z.enum([UserRole.MANAGER, UserRole.PROFESSIONAL, UserRole.RECEPTIONIST]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.users.manage);
    const { userId } = await params;
    const { role } = await validateInput(request, updateRoleSchema);
    const updated = await iamService.updateUserRole(
      session.tenantId,
      session.userId,
      userId,
      role,
    );
    return Response.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
