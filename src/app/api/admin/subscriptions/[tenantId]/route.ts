import { billingService } from "@/domains/billing/billing.service";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { UnauthorizedError } from "@/shared/errors";
import { updateSubscriptionSchema } from "@/domains/billing/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const secret = process.env.ADMIN_API_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      throw new UnauthorizedError("Acesso restrito a administradores.");
    }

    const { tenantId } = await params;
    const input = await validateInput(request, updateSubscriptionSchema);

    const updated = await billingService.changePlan(
      tenantId,
      input.plan,
      input.status,
      "admin",
      input.reason,
    );

    return Response.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
