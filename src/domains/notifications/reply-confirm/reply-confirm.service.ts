import { AppointmentStatus } from "@prisma/client";

import { schedulingService } from "@/domains/scheduling/scheduling.service";

import { REPLY_CONFIRM_DEFAULTS } from "./reply-confirm-catalog";
import { interpretarResposta } from "./reply-confirm-keywords";
import { replyConfirmRepository } from "./reply-confirm.repository";

export type ProcessarInput = {
  tenantId: string;
  telefone: string;
  texto: string;
  timezone: string;
};

/** Formata no fuso do TENANT, nunca no fuso do processo. */
function formatarDataHora(data: Date, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(data);
}

export class ReplyConfirmService {
  /**
   * Interpreta a resposta do cliente e age no agendamento.
   *
   * Devolve `null` sempre que a mensagem NÃO é uma resposta de confirmação —
   * incluindo os casos em que parece uma mas não há lembrete recente ou candidato.
   * O webhook usa esse `null` para seguir ao chatbot sem alteração de comportamento.
   */
  async processar(input: ProcessarInput): Promise<{ resposta: string } | null> {
    const intencao = interpretarResposta(input.texto);
    if (!intencao) return null;

    const houveLembrete = await replyConfirmRepository.houveLembreteRecente(
      input.tenantId,
      input.telefone,
    );
    if (!houveLembrete) return null;

    const candidatos = await replyConfirmRepository.candidatos(
      input.tenantId,
      input.telefone,
    );
    if (candidatos.length === 0) return null;

    const alvo = candidatos[0];

    try {
      await schedulingService.updateAppointmentStatus(input.tenantId, alvo.id, {
        status:
          intencao === "confirmar"
            ? AppointmentStatus.CONFIRMED
            : AppointmentStatus.CANCELLED,
        // A ação nasceu de uma mensagem do próprio cliente: reenviar a ele o aviso
        // do motor seria mensagem duplicada. A equipe continua sendo notificada
        // pelos eventos de domínio que o service publica.
        notify: false,
      });
    } catch (err) {
      // Roda dentro do webhook. Deixar escapar derruba o handler, e o WhatsApp
      // reentrega o evento — podendo agir duas vezes sobre o mesmo horário.
      console.error(
        "[reply-confirm] Falha ao aplicar a resposta do cliente",
        alvo.id,
        err instanceof Error ? err.message : err,
      );
      return null;
    }

    const base =
      intencao === "confirmar"
        ? REPLY_CONFIRM_DEFAULTS.confirmado
        : REPLY_CONFIRM_DEFAULTS.cancelado;

    // Mais de um candidato: age no mais próximo e DIZ qual foi. Nunca agir em
    // silêncio sobre horário ambíguo.
    if (candidatos.length > 1) {
      const aviso = REPLY_CONFIRM_DEFAULTS.ambiguo.replace(
        "{{data_hora}}",
        formatarDataHora(alvo.startsAt, input.timezone),
      );
      return { resposta: `${aviso}\n\n${base}` };
    }

    return { resposta: base };
  }
}

export const replyConfirmService = new ReplyConfirmService();
