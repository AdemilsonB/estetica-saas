import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { createScheduledMessageSchema } from "@/domains/notifications/scheduled-messages/scheduled-message.schemas";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { ValidationError } from "@/shared/errors";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "view");

    const customerId = new URL(request.url).searchParams.get("customerId");
    if (!customerId) {
      throw new ValidationError("Informe o customerId na query.");
    }

    const items = await scheduledMessageService.list(session.tenantId, customerId);
    return Response.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "edit");

    const input = await validateInput(request, createScheduledMessageSchema);

    // tenantId e autor vêm SEMPRE da sessão — nunca do body.
    const criada = await scheduledMessageService.create(
      session.tenantId,
      session.userId,
      input,
    );

    return Response.json(criada);
  } catch (error) {
    return handleApiError(error);
  }
}
