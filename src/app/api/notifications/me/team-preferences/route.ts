import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { userNotificationService } from "@/domains/notifications/user-notifications/user-notification.service";

const patchSchema = z.object({
  notificationDeliveryMode: z.enum(["realtime", "digest"]).optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  notifyOwnAppointments: z.boolean().optional(),
  emailOverrides: z
    .array(
      z.object({
        eventType: z.enum([
          "appointment_created", "appointment_cancelled", "appointment_rescheduled",
          "appointment_no_show", "customer_created", "daily_digest",
        ]),
        enabled: z.boolean(),
      }),
    )
    .optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const settings = await userNotificationService.getMyNotificationSettings(session.tenantId, session.userId);
    return Response.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const input = await validateInput(request, patchSchema);
    await userNotificationService.updateMyNotificationSettings(session.tenantId, session.userId, input);
    return Response.json(input);
  } catch (error) {
    return handleApiError(error);
  }
}
