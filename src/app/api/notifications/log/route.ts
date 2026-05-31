import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { notificationRepository } from "@/domains/notifications/notification.repository";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  template: z.string().optional(),
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const query = querySchema.parse(params);

    const result = await notificationRepository.findMany(session.tenantId, {
      page: query.page,
      limit: query.limit,
      template: query.template,
      status: query.status as import("@prisma/client").NotificationStatus | undefined,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
