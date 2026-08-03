import { NotificationChannel, type NotificationStatus } from "@prisma/client";

import { CUSTOMER_MESSAGE_TEMPLATE_KEY } from "./customer-message-catalog";
import { avaliarConsentimento } from "./customer-message-consent";
import { customerMessageConsentRepository } from "./customer-message-consent.repository";
import { customerMessageSettingService } from "./customer-message-setting.service";
import type { CustomerMessageChannel, CustomerMessageEventKey } from "./types";

type CustomerMessageDispatchBase = {
  tenantId: string;
  appointmentId?: string;
  customerId?: string;
  recipient: { phone?: string | null; email?: string | null };
  /** Dados do template — vira `NotificationLog.payload`. */
  payload: Record<string, unknown>;
};

/** Mensagem de um evento do catálogo: o padrão do tenant decide se envia e por onde. */
export type CustomerMessageCatalogDispatch = CustomerMessageDispatchBase & {
  kind?: "catalog";
  event: CustomerMessageEventKey;
  /** Override pontual da ação. `undefined` = usa o padrão do tenant. */
  notifyOverride?: boolean;
  /** Mensagem escrita na hora pelo profissional; tem precedência sobre o template. */
  message?: string;
};

/**
 * Mensagem avulsa escrita pelo profissional — hoje, a mensagem agendada. NÃO passa
 * pelo liga/desliga por evento: quem escreveu e marcou a hora já decidiu enviar, e um
 * toggle de configuração cancelando um envio explícito seria uma surpresa ruim. O
 * canal é explícito pela mesma razão.
 */
export type CustomerMessageDirectDispatch = CustomerMessageDispatchBase & {
  kind: "direct";
  channels: CustomerMessageChannel[];
  message: string;
  /** Vai cru para `NotificationLog.template`; identifica a origem do envio. */
  templateKey: string;
};

export type CustomerMessageDispatchInput =
  | CustomerMessageCatalogDispatch
  | CustomerMessageDirectDispatch;

export type CustomerMessageDispatchLog = {
  channel: CustomerMessageChannel;
  notificationLogId: string;
  status: NotificationStatus;
  /** Causa preservada do `NotificationLog` — vira o motivo que a profissional lê. */
  errorMessage: string | null;
};

export type CustomerMessageDispatchResult = {
  dispatched: CustomerMessageChannel[];
  skipReason:
    | "desligado"
    | "sem-destinatario"
    | "sem-consentimento"
    | "opt-out"
    | "anti-fadiga"
    | null;
  /**
   * Um registro por canal em que a entrega foi tentada. `dispatched` só diz que a
   * gravação do log não explodiu; o status REAL da entrega mora aqui, porque é o
   * `NotificationLog` que o gateway preenche com SENT/FAILED/PENDING.
   */
  logs: CustomerMessageDispatchLog[];
};

/**
 * Único caminho de envio de mensagem AO CLIENTE. Resolve o padrão do negócio (com
 * override pontual), escolhe os canais e delega o transporte ao notificationService.
 *
 * Toda falha é contida: este método é chamado de handlers assíncronos do event bus,
 * que engolem rejeições — deixar escapar significaria mensagem sumindo sem rastro.
 */
export class CustomerMessageDispatcherService {
  async dispatch(input: CustomerMessageDispatchInput): Promise<CustomerMessageDispatchResult> {
    let channels: CustomerMessageChannel[];
    let template: string;

    if (input.kind === "direct") {
      channels = input.channels;
      template = input.templateKey;
    } else {
      try {
        const enviar = await customerMessageSettingService.shouldNotify(
          input.tenantId,
          input.event,
          input.notifyOverride,
        );
        if (!enviar) {
          return { dispatched: [], skipReason: "desligado", logs: [] };
        }

        ({ channels } = await customerMessageSettingService.resolve(input.tenantId, input.event));
      } catch (err) {
        // shouldNotify/resolve tocam o banco (CustomerMessageSetting). Uma falha aqui — soluço
        // transitório do Postgres, migration atrasada — não pode escapar: dispatch() é chamado
        // de handlers assíncronos do event bus, que engolem a rejeição, e a mensagem sumiria
        // sem deixar rastro (o mesmo tipo de bug histórico do reagendamento).
        console.error(
          "[customer-messages] Falha ao resolver configuração de envio",
          input.event,
          err instanceof Error ? err.message : err,
        );
        return { dispatched: [], skipReason: null, logs: [] };
      }

      // Guarda de consentimento. Só no caminho do catálogo: `kind: "direct"` é
      // mensagem individual escrita e agendada por uma pessoa, que já decidiu enviar.
      // Sem `customerId` não há a quem consultar — casos legados de envio avulso.
      if (input.customerId) {
        try {
          const snapshot = await customerMessageConsentRepository.carregarSnapshot(
            input.tenantId,
            input.customerId,
          );

          // Cliente não encontrado não vira bloqueio: o evento já passou pelo
          // liga/desliga do tenant, e engolir a mensagem aqui a faria sumir sem
          // rastro — o mesmo tipo de bug histórico do reagendamento.
          if (snapshot) {
            const decisao = avaliarConsentimento(input.event, snapshot);
            if (!decisao.permitido) {
              return { dispatched: [], skipReason: decisao.motivo, logs: [] };
            }
          }
        } catch (err) {
          console.error(
            "[customer-messages] Falha ao avaliar consentimento",
            input.event,
            err instanceof Error ? err.message : err,
          );
        }
      }

      template = CUSTOMER_MESSAGE_TEMPLATE_KEY[input.event];
    }

    const { notificationService } = await import("../notification.service");

    const payload = {
      ...input.payload,
      ...(input.message ? { message: input.message } : {}),
    };

    const dispatched: CustomerMessageChannel[] = [];
    const logs: CustomerMessageDispatchLog[] = [];

    for (const channel of channels) {
      const destinatario =
        channel === "WHATSAPP" ? input.recipient.phone : input.recipient.email;
      if (!destinatario) continue;

      try {
        const log = await notificationService.logAndDispatch({
          tenantId: input.tenantId,
          appointmentId: input.appointmentId,
          customerId: input.customerId,
          channel:
            channel === "WHATSAPP" ? NotificationChannel.WHATSAPP : NotificationChannel.EMAIL,
          template,
          recipient: destinatario,
          payload,
        });
        dispatched.push(channel);
        logs.push({
          channel,
          notificationLogId: log.id,
          status: log.status,
          errorMessage: log.errorMessage,
        });
      } catch (err) {
        // logAndDispatch já converte falha de envio em log FAILED; um throw aqui é
        // falha da própria gravação do log. Registrar e seguir para o outro canal.
        console.error(
          "[customer-messages] Falha ao despachar",
          template,
          channel,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return {
      dispatched,
      skipReason: dispatched.length === 0 ? "sem-destinatario" : null,
      logs,
    };
  }
}

export const customerMessageDispatcher = new CustomerMessageDispatcherService();
