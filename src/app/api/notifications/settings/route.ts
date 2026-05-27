import { z } from "zod";

import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const updateNotificationSettingsSchema = z.object({
  zApiInstanceId: z.string().trim().nullable().optional(),
  zApiToken: z.string().trim().nullable().optional(),
  whatsappEnabled: z.boolean().optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { zApiInstanceId: true, zApiToken: true, whatsappEnabled: true },
    });
    return Response.json(tenant ?? { zApiInstanceId: null, zApiToken: null, whatsappEnabled: false });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, updateNotificationSettingsSchema);
    const tenant = await prisma.tenant.update({
      where: { id: session.tenantId },
      data: input,
      select: { zApiInstanceId: true, zApiToken: true, whatsappEnabled: true },
    });
    return Response.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
