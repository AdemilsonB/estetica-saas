import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { teamNotificationSettingsService } from "@/domains/notifications/user-notifications/team-notification-settings.service";

const updateSchema = z.object({
  eventType: z.enum([
    "appointment_created",
    "appointment_cancelled",
    "appointment_rescheduled",
    "appointment_no_show",
    "customer_created",
    "daily_digest",
    "birthday_digest",
  ]),
  enabled: z.boolean(),
  defaultChannels: z.array(z.enum(["IN_APP", "EMAIL"])),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    // Leitura liberada para qualquer membro autenticado do tenant, sem checar
    // configuracoes:view — a aba pessoal "Minhas preferências" depende desta
    // lista (quais eventos existem, se suportam e-mail) para qualquer usuário,
    // independente de ter acesso às configurações gerais do negócio.
    const session = await getSessionContext(request);
    const settings = await teamNotificationSettingsService.listForTenant(session.tenantId);
    return Response.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, updateSchema);
    const updated = await teamNotificationSettingsService.updateEvent(session.tenantId, input.eventType, {
      enabled: input.enabled,
      defaultChannels: input.defaultChannels,
    });
    return Response.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
