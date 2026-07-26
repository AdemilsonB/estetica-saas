import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { customerMessageTemplateRepository } from "@/domains/notifications/customer-messages/customer-message-template.repository";
import {
  customerMessageChannelSchema,
  customerMessageEventSchema,
} from "@/domains/notifications/customer-messages/schemas";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { ValidationError } from "@/shared/errors";
import { handleApiError } from "@/shared/http/handle-api-error";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ event: string; channel: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const { event, channel } = await params;

    // safeParse em vez de parse: .parse() lançaria ZodError puro, que handleApiError
    // não reconhece (cai no branch genérico e responde 500 para uma entrada inválida
    // do cliente). Traduzimos aqui, na rota, para o erro de domínio do projeto — mexer
    // no handleApiError global está fora do escopo e afetaria todas as rotas.
    const eventoResult = customerMessageEventSchema.safeParse(event);
    const canalResult = customerMessageChannelSchema.safeParse(channel);
    if (!eventoResult.success || !canalResult.success) {
      throw new ValidationError("event ou channel inválido na URL.", { event, channel });
    }

    // Apagar o registro devolve o evento à mensagem padrão do sistema.
    await customerMessageTemplateRepository.remove(session.tenantId, eventoResult.data, canalResult.data);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
