import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { updateScheduledMessageSchema } from "@/domains/notifications/scheduled-messages/scheduled-message.schemas";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "edit");

    const { id } = await params;
    const input = await validateInput(request, updateScheduledMessageSchema);

    await scheduledMessageService.update(session.tenantId, id, input);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "edit");

    const { id } = await params;

    // Cancelar muda o status; a linha continua na lista, com o histórico preservado.
    await scheduledMessageService.cancel(session.tenantId, id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
