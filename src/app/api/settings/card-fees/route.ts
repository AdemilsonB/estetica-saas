import { z } from "zod";
import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const cardFeeSchema = z.object({
  DEBIT_CARD: z.number().min(0).max(20),
  CREDIT_CARD: z.number().min(0).max(20),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { cardFeeConfig: true },
    });
    return Response.json(tenant?.cardFeeConfig ?? { DEBIT_CARD: 0, CREDIT_CARD: 0 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, cardFeeSchema);
    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: { cardFeeConfig: input },
    });
    return Response.json(input);
  } catch (error) {
    return handleApiError(error);
  }
}
