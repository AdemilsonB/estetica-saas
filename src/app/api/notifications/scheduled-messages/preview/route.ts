import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { customerMessageBlockedReason } from "@/domains/notifications/customer-messages/customer-message-delivery";
import { previewScheduledMessageSchema } from "@/domains/notifications/scheduled-messages/scheduled-message.schemas";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { prisma } from "@/shared/database/prisma";
import { NotFoundError } from "@/shared/errors";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

/**
 * Prévia do que a cliente vai ler, com as variáveis já interpoladas, mais o motivo de
 * bloqueio quando o WhatsApp não tem como sair. Mesma renderização do envio real
 * (`scheduledMessageService.renderPreview`) — a prévia nunca pode mentir.
 *
 * Esta rota lê o Prisma direto porque só monta os argumentos do
 * `customerMessageBlockedReason` — é o mesmo desenho da rota de prévia da Fase 2
 * (`customer-messages/preview/route.ts`), que já faz exatamente isso. Não é regra de
 * negócio; a renderização, que é, mora no service.
 */
export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "view");

    const input = await validateInput(request, previewScheduledMessageSchema);
    const tenantId = session.tenantId;

    const [tenant, cliente] = await Promise.all([
      prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { whatsappEnabled: true, evolutionConnected: true, evolutionStatus: true },
      }),
      prisma.customer.findFirst({
        where: { id: input.customerId, tenantId },
        select: { phone: true, email: true },
      }),
    ]);

    if (!tenant || !cliente) throw new NotFoundError("Cliente");

    const [preview, blockedReason] = await Promise.all([
      scheduledMessageService.renderPreview(tenantId, input.customerId, input.body),
      customerMessageBlockedReason({
        tenantId,
        // A v1 só entrega por WhatsApp.
        channels: ["WHATSAPP"],
        cliente,
        tenant,
      }),
    ]);

    return Response.json({ preview, blockedReason });
  } catch (error) {
    return handleApiError(error);
  }
}
