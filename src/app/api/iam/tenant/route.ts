import { z } from "zod";
import { revalidateTag } from "next/cache";

import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  instagramUrl: z.string().trim().url().max(200).nullable().optional(),
  coverImageUrl: z.string().trim().url().max(500).nullable().optional(),
})

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const tenant = await iamService.getTenant(session.tenantId);
    return Response.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, updateTenantSchema);
    const tenant = await iamService.updateTenant(session.tenantId, input);
    revalidateTag(`tenant-${session.tenantId}`, 'default');
    return Response.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
