import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { CUSTOMER_MESSAGE_CATALOG } from "@/domains/notifications/customer-messages/customer-message-catalog";
import { customerMessageTemplateRepository } from "@/domains/notifications/customer-messages/customer-message-template.repository";
import { SCHEDULED_MESSAGE_VARIABLES } from "@/domains/notifications/scheduled-messages/types";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

/**
 * Ponto de partida do formulário: os textos de WhatsApp que o tenant já tem (o
 * personalizado quando existe, senão o padrão do catálogo) e as variáveis oferecidas
 * como chips.
 *
 * Não exige `configuracoes:view` — precedente do ADR-016: é leitura de apoio de quem
 * atende, não edição de configuração. Escrever template continua exigindo a permissão
 * de configurações, na rota da Fase 1.
 */
export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "view");

    const personalizados = await customerMessageTemplateRepository.listByTenant(
      session.tenantId,
    );
    const porEvento = new Map(
      personalizados
        .filter((t) => t.channel === "WHATSAPP")
        .map((t) => [t.event as string, t.body]),
    );

    const templates = CUSTOMER_MESSAGE_CATALOG.map((entrada) => ({
      event: entrada.event,
      label: entrada.label,
      body: porEvento.get(entrada.event) ?? entrada.defaults.WHATSAPP.body,
    }));

    return Response.json({ templates, variables: [...SCHEDULED_MESSAGE_VARIABLES] });
  } catch (error) {
    return handleApiError(error);
  }
}
