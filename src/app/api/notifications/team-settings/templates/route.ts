import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { ValidationError } from "@/shared/errors";
import { notificationTemplateService } from "@/domains/notifications/user-notifications/notification-template.service";

const eventTypeSchema = z.enum([
  "appointment_created",
  "appointment_cancelled",
  "appointment_rescheduled",
  "appointment_no_show",
  "customer_created",
  "daily_digest",
  "birthday_digest",
]);
const channelSchema = z.enum(["IN_APP", "EMAIL"]);

const putSchema = z.object({
  eventType: eventTypeSchema,
  channel: channelSchema,
  subject: z.string().nullable(),
  body: z.string().min(1),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const url = new URL(request.url);
    const eventTypeResult = eventTypeSchema.safeParse(url.searchParams.get("eventType"));
    const channelResult = channelSchema.safeParse(url.searchParams.get("channel"));
    if (!eventTypeResult.success || !channelResult.success) {
      throw new ValidationError("eventType/channel inválidos ou ausentes na query string.");
    }

    const template = await notificationTemplateService.getForTenant(
      session.tenantId, eventTypeResult.data, channelResult.data,
    );
    return Response.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, putSchema);
    const updated = await notificationTemplateService.upsert(session.tenantId, input.eventType, input.channel, {
      subject: input.subject, body: input.body,
    });
    return Response.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
