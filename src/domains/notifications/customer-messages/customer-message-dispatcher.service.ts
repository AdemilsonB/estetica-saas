import { NotificationChannel } from "@prisma/client";

import { CUSTOMER_MESSAGE_TEMPLATE_KEY } from "./customer-message-catalog";
import { customerMessageSettingService } from "./customer-message-setting.service";
import type { CustomerMessageChannel, CustomerMessageEventKey } from "./types";

export type CustomerMessageDispatchInput = {
  tenantId: string;
  event: CustomerMessageEventKey;
  appointmentId?: string;
  customerId?: string;
  recipient: { phone?: string | null; email?: string | null };
  /** Override pontual da ação. `undefined` = usa o padrão do tenant. */
  notifyOverride?: boolean;
  /** Mensagem escrita na hora pelo profissional; tem precedência sobre o template. */
  message?: string;
  /** Dados do template — vira `NotificationLog.payload`. */
  payload: Record<string, unknown>;
};

export type CustomerMessageDispatchResult = {
  dispatched: CustomerMessageChannel[];
  skipReason: "desligado" | "sem-destinatario" | null;
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
    const enviar = await customerMessageSettingService.shouldNotify(
      input.tenantId,
      input.event,
      input.notifyOverride,
    );
    if (!enviar) {
      return { dispatched: [], skipReason: "desligado" };
    }

    const { channels } = await customerMessageSettingService.resolve(
      input.tenantId,
      input.event,
    );

    const { notificationService } = await import("../notification.service");

    const template = CUSTOMER_MESSAGE_TEMPLATE_KEY[input.event];
    const payload = {
      ...input.payload,
      ...(input.message ? { message: input.message } : {}),
    };

    const dispatched: CustomerMessageChannel[] = [];

    for (const channel of channels) {
      const destinatario =
        channel === "WHATSAPP" ? input.recipient.phone : input.recipient.email;
      if (!destinatario) continue;

      try {
        await notificationService.logAndDispatch({
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
      } catch (err) {
        // logAndDispatch já converte falha de envio em log FAILED; um throw aqui é
        // falha da própria gravação do log. Registrar e seguir para o outro canal.
        console.error(
          "[customer-messages] Falha ao despachar",
          input.event,
          channel,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return {
      dispatched,
      skipReason: dispatched.length === 0 ? "sem-destinatario" : null,
    };
  }
}

export const customerMessageDispatcher = new CustomerMessageDispatcherService();
