import { billingService } from "@/domains/billing/billing.service";
import { getAdminContext } from "@/shared/auth/admin-context";
import { logAdminAction } from "@/shared/audit/admin-audit";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { updateSubscriptionSchema } from "@/domains/billing/types";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getAdminContext(request);
    const { tenantId } = await params;
    const input = await validateInput(request, updateSubscriptionSchema);

    const updated = await billingService.changePlan(
      tenantId,
      input.plan,
      input.status,
      session.userId,
      input.reason,
    );

    await logAdminAction({
      adminUserId: session.userId,
      action: "billing.subscription_changed",
      targetType: "Subscription",
      targetId: tenantId,
      metadata: { plan: input.plan, status: input.status, reason: input.reason ?? null },
      request,
    });

    return Response.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
