import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { userNotificationService } from "@/domains/notifications/user-notifications/user-notification.service";

const bodySchema = z
  .object({ id: z.string().optional(), all: z.boolean().optional() })
  .refine((v) => Boolean(v.id) || v.all === true, {
    message: "Informe 'id' ou 'all: true'.",
  });

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const body = bodySchema.parse(await request.json());
    await userNotificationService.markRead(session.tenantId, session.userId, body);
    const { unreadCount } = await userNotificationService.listForUser(
      session.tenantId,
      session.userId,
      { period: "all", limit: 1 },
    );
    return Response.json({ unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}
