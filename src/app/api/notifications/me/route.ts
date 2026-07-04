import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { userNotificationService } from "@/domains/notifications/user-notifications/user-notification.service";

const querySchema = z.object({
  period: z.enum(["7", "30", "all"]).default("30"),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const { searchParams } = new URL(request.url);
    const { period } = querySchema.parse({
      period: searchParams.get("period") ?? undefined,
    });

    const result = await userNotificationService.listForUser(session.tenantId, session.userId, {
      period,
      limit: 50,
    });
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
