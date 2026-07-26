import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { CUSTOMER_MESSAGE_CATALOG } from "@/domains/notifications/customer-messages/customer-message-catalog";
import { customerMessageTemplateRepository } from "@/domains/notifications/customer-messages/customer-message-template.repository";
import { updateCustomerMessageTemplateSchema } from "@/domains/notifications/customer-messages/schemas";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const personalizados = await customerMessageTemplateRepository.listByTenant(session.tenantId);
    const porChave = new Map(personalizados.map((t) => [`${t.event}:${t.channel}`, t]));

    const items = CUSTOMER_MESSAGE_CATALOG.flatMap((entrada) =>
      (["WHATSAPP", "EMAIL"] as const).map((channel) => {
        const personalizado = porChave.get(`${entrada.event}:${channel}`);
        const padrao = entrada.defaults[channel];
        return {
          event: entrada.event,
          channel,
          label: entrada.label,
          description: entrada.description,
          nature: entrada.nature,
          variables: entrada.variables,
          subject: personalizado?.subject ?? padrao.subject,
          body: personalizado?.body ?? padrao.body,
          mediaUrl: personalizado?.mediaUrl ?? null,
          isCustom: Boolean(personalizado),
          defaultBody: padrao.body,
          defaultSubject: padrao.subject,
        };
      }),
    );

    return Response.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const input = await validateInput(request, updateCustomerMessageTemplateSchema);

    // tenantId vem SEMPRE da sessão — nunca do body.
    const salvo = await customerMessageTemplateRepository.upsert(session.tenantId, {
      event: input.event,
      channel: input.channel,
      subject: input.channel === "EMAIL" ? input.subject : null,
      body: input.body,
      mediaUrl: input.mediaUrl,
    });

    return Response.json(salvo);
  } catch (error) {
    return handleApiError(error);
  }
}
