import { prisma } from "@/shared/database/prisma";

import { variantesDeTelefone } from "@/domains/crm/opt-out.service";

/** Chave de template do lembrete no `NotificationLog`. */
const TEMPLATE_LEMBRETE = "appointment-reminder";

const JANELA_MS = 48 * 60 * 60 * 1000;

export type AgendamentoCandidato = {
  id: string;
  startsAt: Date;
  customerId: string;
};

export class ReplyConfirmRepository {
  /**
   * Houve lembrete enviado a este telefone nas últimas 48 h?
   *
   * É o que evita interpretar um "1" solto de conversa como confirmação. Sem model
   * novo: o `NotificationLog` já é a memória de tudo que saiu.
   */
  async houveLembreteRecente(tenantId: string, telefone: string): Promise<boolean> {
    const total = await prisma.notificationLog.count({
      where: {
        tenantId,
        template: TEMPLATE_LEMBRETE,
        recipient: { in: variantesDeTelefone(telefone) },
        createdAt: { gte: new Date(Date.now() - JANELA_MS) },
      },
    });
    return total > 0;
  }

  /**
   * Agendamentos que a resposta pode estar endereçando: `SCHEDULED` nas próximas
   * 48 h, do cliente daquele telefone, **dentro do tenant**. Ordenados do mais
   * próximo para o mais distante — o service age no primeiro.
   */
  async candidatos(tenantId: string, telefone: string): Promise<AgendamentoCandidato[]> {
    const agora = new Date();
    return prisma.appointment.findMany({
      where: {
        tenantId,
        status: "SCHEDULED",
        startsAt: { gte: agora, lte: new Date(agora.getTime() + JANELA_MS) },
        customer: {
          phone: { in: variantesDeTelefone(telefone) },
          deletedAt: null,
        },
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, customerId: true },
    });
  }
}

export const replyConfirmRepository = new ReplyConfirmRepository();
