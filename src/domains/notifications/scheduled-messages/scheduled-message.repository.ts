import { prisma } from "@/shared/database/prisma";

import type { ScheduledMessageForDelivery, ScheduledMessageWithAuthor } from "./types";

export type CreateScheduledMessageData = {
  customerId: string;
  body: string;
  scheduledAt: Date;
  createdByUserId: string;
};

export type UpdateScheduledMessageData = {
  body: string;
  scheduledAt: Date;
};

const AUTOR = { createdByUser: { select: { id: true, name: true } } } as const;

export class ScheduledMessageRepository {
  /** Só os campos que a montagem das variáveis do template precisa. */
  async findTenantContext(tenantId: string) {
    return prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, slug: true, timezone: true, phone: true, address: true },
    });
  }

  /** Filtra o tenant: id de cliente de outro negócio nunca resolve. */
  async findCustomerForMessage(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, name: true, phone: true },
    });
  }

  /** `tenantId` vem sempre do argumento (extraído da sessão), nunca do input. */
  async create(tenantId: string, data: CreateScheduledMessageData) {
    return prisma.scheduledMessage.create({
      data: {
        tenantId,
        customerId: data.customerId,
        body: data.body,
        scheduledAt: data.scheduledAt,
        createdByUserId: data.createdByUserId,
        // A v1 só entrega por WhatsApp. O campo existe para o e-mail plugar depois.
        channel: "WHATSAPP",
      },
    });
  }

  async listByCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<ScheduledMessageWithAuthor[]> {
    return prisma.scheduledMessage.findMany({
      where: { tenantId, customerId },
      include: AUTOR,
      orderBy: { scheduledAt: "desc" },
    });
  }

  async findById(tenantId: string, id: string): Promise<ScheduledMessageWithAuthor | null> {
    return prisma.scheduledMessage.findFirst({
      where: { id, tenantId },
      include: AUTOR,
    });
  }

  /**
   * O `status: "PENDING"` no `where` não é redundância com a checagem do service: ele
   * fecha a corrida entre a edição e a varredura do cron. Devolve `false` quando a
   * linha já saiu do PENDING no meio do caminho.
   */
  async update(
    tenantId: string,
    id: string,
    data: UpdateScheduledMessageData,
  ): Promise<boolean> {
    const { count } = await prisma.scheduledMessage.updateMany({
      where: { id, tenantId, status: "PENDING" },
      data: { body: data.body, scheduledAt: data.scheduledAt },
    });
    return count === 1;
  }

  /** Cancelar é mudar o status, nunca apagar a linha — o histórico fica. */
  async cancel(tenantId: string, id: string): Promise<boolean> {
    const { count } = await prisma.scheduledMessage.updateMany({
      where: { id, tenantId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    return count === 1;
  }

  /**
   * VARREDURA DO CRON — cross-tenant de propósito. O tick processa todos os tenants
   * numa passada só; filtrar por tenant aqui exigiria varrer a tabela de tenants a
   * cada 10 minutos. Este método não é alcançável a partir de nenhuma rota HTTP.
   */
  async findDue(now: Date, limit: number): Promise<ScheduledMessageForDelivery[]> {
    return prisma.scheduledMessage.findMany({
      where: { status: "PENDING", scheduledAt: { lte: now } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        tenant: {
          select: { name: true, slug: true, timezone: true, phone: true, address: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    });
  }

  /**
   * A reivindicação atômica que garante a idempotência: o `where` exige `PENDING` E
   * `scheduledAt` já vencido NO MOMENTO do claim — não no momento em que `findDue` leu a
   * linha. Se a profissional reagendou para o futuro entre o `findDue` e aqui, o `where`
   * não bate e ninguém reivindica. Depois de vencer o claim, relê a linha (não reusa o
   * que `findDue` tinha em mãos) para nunca enviar um `body` que já foi editado nesse
   * meio-tempo. Cross-tenant pelo mesmo motivo do `findDue`.
   */
  async claim(id: string, now: Date): Promise<ScheduledMessageForDelivery | null> {
    const { count } = await prisma.scheduledMessage.updateMany({
      where: { id, status: "PENDING", scheduledAt: { lte: now } },
      data: { status: "SENDING" },
    });
    if (count !== 1) return null;

    return this.findByIdForDelivery(id);
  }

  /** Leitura fresca de uma linha já reivindicada, com o include que a entrega precisa. */
  private async findByIdForDelivery(id: string): Promise<ScheduledMessageForDelivery | null> {
    return prisma.scheduledMessage.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        tenant: {
          select: { name: true, slug: true, timezone: true, phone: true, address: true },
        },
      },
    });
  }

  async markSent(id: string, notificationLogId: string, sentAt: Date) {
    return prisma.scheduledMessage.update({
      where: { id },
      data: { status: "SENT", sentAt, notificationLogId, failureReason: null },
    });
  }

  async markFailed(id: string, failureReason: string, notificationLogId: string | null) {
    return prisma.scheduledMessage.update({
      where: { id },
      data: { status: "FAILED", failureReason, notificationLogId },
    });
  }

  /**
   * Rede de segurança: se o processo morreu entre o `claim` e o desfecho, a linha
   * ficaria em `SENDING` para sempre — invisível para o `findDue`, que só olha
   * `PENDING`. Depois da janela, vira FAILED com motivo legível. Cross-tenant.
   */
  async expireStuck(before: Date): Promise<number> {
    const { count } = await prisma.scheduledMessage.updateMany({
      where: { status: "SENDING", updatedAt: { lt: before } },
      data: {
        status: "FAILED",
        failureReason:
          "O envio foi interrompido antes de terminar. Agende a mensagem de novo.",
      },
    });
    return count;
  }
}

export const scheduledMessageRepository = new ScheduledMessageRepository();
