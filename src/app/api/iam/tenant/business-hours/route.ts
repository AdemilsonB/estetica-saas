import { z } from "zod";

import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const daySchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  active: z.boolean(),
});

const businessHoursSchema = z.object({
  "0": daySchema, "1": daySchema, "2": daySchema,
  "3": daySchema, "4": daySchema, "5": daySchema, "6": daySchema,
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const hours = await iamService.getBusinessHours(session.tenantId);
    return Response.json(hours);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, businessHoursSchema);
    const result = await iamService.updateBusinessHours(session.tenantId, input);
    return Response.json(result.businessHours);
  } catch (error) {
    return handleApiError(error);
  }
}
