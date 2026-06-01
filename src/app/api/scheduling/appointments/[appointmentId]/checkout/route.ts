import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { schedulingService } from "@/domains/scheduling/scheduling.service";

const checkoutSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod),
  discountTypeId: z.string().cuid().optional(),
  discountValue: z.number().min(0).optional(),
  tipAmount: z.number().min(0).default(0),
});

type RouteContext = {
  params: Promise<{ appointmentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.manage);
    const { appointmentId } = await context.params;
    const input = await validateInput(request, checkoutSchema);
    const result = await schedulingService.markPayment(session.tenantId, appointmentId, input);
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
