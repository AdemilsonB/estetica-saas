import type { Prisma } from "@prisma/client";

/**
 * Vai para `NotificationLog.template`. Não existe em `LEGACY_TEMPLATE_TO_EVENT` de
 * propósito: mensagem agendada é texto livre, e o gateway de WhatsApp só consulta
 * aquele mapa quando `payload.message` está vazio — o que aqui nunca acontece,
 * porque o corpo é obrigatório em todas as camadas.
 */
export const SCHEDULED_MESSAGE_TEMPLATE_KEY = "scheduled-message";

/** O que a lista da UI precisa: a mensagem mais quem a agendou. */
export type ScheduledMessageWithAuthor = Prisma.ScheduledMessageGetPayload<{
  include: { createdByUser: { select: { id: true; name: true } } };
}>;

/**
 * O que a UI recebe. `scheduledDate`/`scheduledTime` vêm **já formatados no fuso do
 * tenant** pelo service: o navegador nunca converte `scheduledAt`, senão um profissional
 * em outro fuso veria — e ao editar, reenviaria — um horário deslocado. São exatamente os
 * mesmos campos que o formulário manda de volta em `date`/`time`.
 */
export type ScheduledMessageListItem = ScheduledMessageWithAuthor & {
  scheduledDate: string;
  scheduledTime: string;
};

/** O que a varredura do cron precisa para renderizar e entregar sem N+1. */
export type ScheduledMessageForDelivery = Prisma.ScheduledMessageGetPayload<{
  include: {
    customer: { select: { id: true; name: true; phone: true } };
    tenant: {
      select: { name: true; slug: true; timezone: true; phone: true; address: true };
    };
  };
}>;

/**
 * As variáveis que fazem sentido numa mensagem avulsa. Não há agendamento no contexto,
 * então `data`, `hora`, `servico`, `profissional` e `valor` renderizariam vazio — e um
 * chip que produz string vazia é pior do que chip nenhum.
 */
export const SCHEDULED_MESSAGE_VARIABLES = [
  "cliente",
  "primeiro_nome",
  "negocio",
  "endereco",
  "telefone_negocio",
  "link_agendamento",
  "link_portal",
] as const;
