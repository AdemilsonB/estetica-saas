import { localDateTimeToUtc } from "@/lib/dates";
import {
  CustomerNotFoundError,
  NotFoundError,
  ScheduledMessageInPastError,
  ScheduledMessageNotEditableError,
  ScheduledMessageNotFoundError,
  ValidationError,
} from "@/shared/errors";

import {
  customerMessageDispatcher,
  type CustomerMessageDispatchResult,
} from "../customer-messages/customer-message-dispatcher.service";
import { buildCustomerMessageVariables } from "../customer-messages/customer-message-variables";
import { interpolateTemplate } from "../user-notifications/notification-template-engine";

import { scheduledMessageRepository } from "./scheduled-message.repository";
import {
  SCHEDULED_MESSAGE_TEMPLATE_KEY,
  type ScheduledMessageForDelivery,
  type ScheduledMessageListItem,
} from "./types";
import type {
  CreateScheduledMessageInput,
  UpdateScheduledMessageInput,
} from "./scheduled-message.schemas";

/** Quantas mensagens vencidas um único tick processa. Mesmo teto de `runBatch` no cron tick. */
const TAMANHO_DO_LOTE = 10;

/**
 * Depois disso, uma linha em SENDING é considerada abandonada. Precisa ser bem maior
 * que a duração de um envio e menor que o intervalo em que alguém repararia na falta.
 */
const JANELA_DE_TRAVAMENTO_MS = 15 * 60 * 1000;

export type DeliverDueSummary = {
  enviadas: number;
  falhas: number;
  expiradas: number;
};

export class ScheduledMessageService {
  /**
   * Devolve data e hora **já no fuso do tenant**. A UI nunca converte `scheduledAt`:
   * um profissional acessando de outro fuso veria o horário deslocado e, ao editar,
   * reenviaria esse valor errado — o formulário devolve exatamente estes dois campos.
   */
  async list(tenantId: string, customerId: string): Promise<ScheduledMessageListItem[]> {
    const [tenant, itens] = await Promise.all([
      scheduledMessageRepository.findTenantContext(tenantId),
      scheduledMessageRepository.listByCustomer(tenantId, customerId),
    ]);

    if (!tenant) throw new NotFoundError("Negocio");

    return itens.map((item) => ({
      ...item,
      ...this.formatarNoFusoDoTenant(item.scheduledAt, tenant.timezone),
    }));
  }

  /** Mesma técnica de `src/lib/dates.ts`: Intl, sem lib externa. */
  private formatarNoFusoDoTenant(quando: Date, timezone: string) {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(quando);

    const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;

    return {
      scheduledDate: `${parte("year")}-${parte("month")}-${parte("day")}`,
      scheduledTime: `${parte("hour")}:${parte("minute")}`,
    };
  }

  async create(tenantId: string, userId: string, input: CreateScheduledMessageInput) {
    const { tenant, cliente } = await this.contexto(tenantId, input.customerId);

    if (!cliente.phone) {
      throw new ValidationError(
        "Este cliente nao tem telefone cadastrado. Cadastre o telefone antes de agendar a mensagem.",
      );
    }

    const scheduledAt = this.paraUtc(input.date, input.time, tenant.timezone);

    return scheduledMessageRepository.create(tenantId, {
      customerId: input.customerId,
      body: input.body,
      scheduledAt,
      createdByUserId: userId,
    });
  }

  async update(tenantId: string, id: string, input: UpdateScheduledMessageInput) {
    const existente = await scheduledMessageRepository.findById(tenantId, id);
    if (!existente) throw new ScheduledMessageNotFoundError();
    if (existente.status !== "PENDING") {
      throw new ScheduledMessageNotEditableError(existente.status);
    }

    const tenant = await scheduledMessageRepository.findTenantContext(tenantId);
    if (!tenant) throw new NotFoundError("Negocio");

    const scheduledAt = this.paraUtc(input.date, input.time, tenant.timezone);

    const alterou = await scheduledMessageRepository.update(tenantId, id, {
      body: input.body,
      scheduledAt,
    });

    // Corrida real: a varredura do cron pode ter reivindicado a linha entre a leitura
    // acima e este update. Reler o status faz o erro dizer a verdade ao usuário.
    if (!alterou) {
      const atual = await scheduledMessageRepository.findById(tenantId, id);
      throw new ScheduledMessageNotEditableError(atual?.status ?? "SENDING");
    }
  }

  async cancel(tenantId: string, id: string) {
    const existente = await scheduledMessageRepository.findById(tenantId, id);
    if (!existente) throw new ScheduledMessageNotFoundError();
    if (existente.status !== "PENDING") {
      throw new ScheduledMessageNotEditableError(existente.status);
    }

    const cancelou = await scheduledMessageRepository.cancel(tenantId, id);
    if (!cancelou) {
      const atual = await scheduledMessageRepository.findById(tenantId, id);
      throw new ScheduledMessageNotEditableError(atual?.status ?? "SENDING");
    }
  }

  /** Mesma interpolação do envio real — a prévia nunca mente sobre o que vai sair. */
  async renderPreview(tenantId: string, customerId: string, body: string): Promise<string> {
    const { tenant, cliente } = await this.contexto(tenantId, customerId);

    return interpolateTemplate(
      body,
      buildCustomerMessageVariables({
        customerName: cliente.name,
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          timezone: tenant.timezone,
          phone: tenant.phone,
          address: tenant.address,
        },
      }),
      // WhatsApp é texto puro: escapar HTML aqui produziria "&amp;" no celular.
      false,
    );
  }

  /**
   * A varredura chamada pelo /api/cron/tick a cada ~10 minutos. Idempotente por
   * construção: cada linha só é enviada por quem vencer o `claim` atômico.
   */
  async deliverDue(now: Date = new Date()): Promise<DeliverDueSummary> {
    const expiradas = await scheduledMessageRepository.expireStuck(
      new Date(now.getTime() - JANELA_DE_TRAVAMENTO_MS),
    );

    const vencidas = await scheduledMessageRepository.findDue(now, TAMANHO_DO_LOTE);

    let enviadas = 0;
    let falhas = 0;

    for (const candidata of vencidas) {
      const mensagem = await scheduledMessageRepository.claim(candidata.id, now);
      if (!mensagem) continue;

      try {
        const saiu = await this.entregar(mensagem, now);
        if (saiu) enviadas += 1;
        else falhas += 1;
      } catch (err) {
        // Uma linha problemática não pode derrubar o lote inteiro nem deixar a linha
        // presa em SENDING até a janela de travamento expirar.
        await scheduledMessageRepository.markFailed(
          candidata.id,
          `Falha inesperada no envio: ${err instanceof Error ? err.message : "erro desconhecido"}`,
          null,
        );
        falhas += 1;
      }
    }

    return { enviadas, falhas, expiradas };
  }

  private async entregar(
    mensagem: ScheduledMessageForDelivery,
    now: Date,
  ): Promise<boolean> {
    if (!mensagem.customer.phone) {
      await scheduledMessageRepository.markFailed(
        mensagem.id,
        "Cliente sem telefone cadastrado.",
        null,
      );
      return false;
    }

    const texto = interpolateTemplate(
      mensagem.body,
      buildCustomerMessageVariables({
        customerName: mensagem.customer.name,
        tenant: {
          name: mensagem.tenant.name,
          slug: mensagem.tenant.slug,
          timezone: mensagem.tenant.timezone,
          phone: mensagem.tenant.phone,
          address: mensagem.tenant.address,
        },
      }),
      false,
    );

    // O dispatcher é o único caminho de envio ao cliente (ADR-018). A cota de WhatsApp
    // é incrementada e devolvida dentro do gateway — nada a fazer aqui.
    const resultado = await customerMessageDispatcher.dispatch({
      kind: "direct",
      tenantId: mensagem.tenantId,
      customerId: mensagem.customerId,
      channels: ["WHATSAPP"],
      message: texto,
      templateKey: SCHEDULED_MESSAGE_TEMPLATE_KEY,
      recipient: { phone: mensagem.customer.phone },
      payload: {
        customerName: mensagem.customer.name,
        scheduledMessageId: mensagem.id,
      },
    });

    const entregue = resultado.logs.find((log) => log.status === "SENT");
    if (entregue) {
      await scheduledMessageRepository.markSent(mensagem.id, entregue.notificationLogId, now);
      return true;
    }

    const log = resultado.logs[0] ?? null;
    await scheduledMessageRepository.markFailed(
      mensagem.id,
      this.motivoDaFalha(resultado.skipReason, log?.errorMessage ?? null),
      log?.notificationLogId ?? null,
    );
    return false;
  }

  private motivoDaFalha(
    skipReason: CustomerMessageDispatchResult["skipReason"],
    errorMessage: string | null,
  ): string {
    if (errorMessage) return errorMessage;
    // `skipReason === "sem-destinatario"` NUNCA significa "cliente sem telefone" aqui:
    // `entregar` já barrou esse caso antes de chamar o dispatcher, e no modo `direct`
    // ele só volta quando o dispatcher engoliu uma falha ao gravar o NotificationLog
    // (catch interno). Um texto de "sem telefone" mentiria sobre a causa real.
    if (skipReason === "sem-destinatario") {
      return "Nao foi possivel registrar o envio. Tente agendar de novo.";
    }
    // Os motivos de consentimento ("sem-consentimento"/"opt-out"/"anti-fadiga") nunca
    // acontecem de fato aqui: a guarda só roda no caminho `kind: "catalog"` do
    // dispatcher, e mensagem agendada sempre chama em modo `direct`. O tipo é
    // compartilhado com o dispatcher, então o compilador exige tratar o caso mesmo
    // assim — cai no mesmo texto genérico abaixo.
    // Status PENDING no log: o gateway não chegou a tentar (WhatsApp desligado ou
    // desconectado). Não é erro de entrega, e por isso não tem errorMessage.
    return "O WhatsApp do seu negocio nao estava pronto para enviar.";
  }

  private paraUtc(date: string, time: string, timezone: string): Date {
    const quando = localDateTimeToUtc(date, time, timezone);
    if (quando.getTime() <= Date.now()) throw new ScheduledMessageInPastError();
    return quando;
  }

  private async contexto(tenantId: string, customerId: string) {
    const [tenant, cliente] = await Promise.all([
      scheduledMessageRepository.findTenantContext(tenantId),
      scheduledMessageRepository.findCustomerForMessage(tenantId, customerId),
    ]);

    if (!tenant) throw new NotFoundError("Negocio");
    if (!cliente) throw new CustomerNotFoundError();

    return { tenant, cliente };
  }
}

export const scheduledMessageService = new ScheduledMessageService();
