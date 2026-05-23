// src/app/api/iam/invites/route.ts
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([UserRole.MANAGER, UserRole.PROFESSIONAL, UserRole.RECEPTIONIST]),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.users.view);
    const invites = await iamService.listInvites(session.tenantId);
    return Response.json(invites);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.users.invite);
    const { email, role } = await validateInput(request, createInviteSchema);
    const invite = await iamService.createInvite(session.tenantId, email, role);
    return Response.json(invite, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
