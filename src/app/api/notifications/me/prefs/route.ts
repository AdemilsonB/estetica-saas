import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { userNotificationService } from "@/domains/notifications/user-notifications/user-notification.service";

const bodySchema = z.object({
  notifyEmailAppointments: z.boolean().optional(),
  notifyOwnAppointments: z.boolean().optional(),
  notifyTeamAppointments: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const prefs = bodySchema.parse(await request.json());
    const updated = await userNotificationService.updatePreferences(
      session.tenantId,
      session.userId,
      prefs,
    );
    return Response.json({ prefs: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
