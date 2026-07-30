import { iamService } from "@/domains/iam/iam.service";
import { schedulingPolicyService } from "@/domains/scheduling/scheduling-policy.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.view);

    const [businessHours, policy] = await Promise.all([
      iamService.getBusinessHours(session.tenantId),
      schedulingPolicyService.getPolicy(session.tenantId),
    ]);

    return Response.json({
      businessHours,
      slotIntervalMinutes: policy.slotIntervalMinutes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
