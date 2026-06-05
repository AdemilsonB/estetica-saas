import { Prisma, TransactionType } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";

import { transactionRepository } from "./transaction.repository";

let financialSubscriptionsRegistered = false;

export function registerFinancialSubscriptions() {
  if (financialSubscriptionsRegistered) {
    return;
  }

  financialSubscriptionsRegistered = true;

  eventBus.subscribe("scheduling.appointment.paid", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.INCOME,
      category: "service",
      description: "Receita de serviço",
      amount: new Prisma.Decimal(payload.netAmount),
      paidAt: new Date(),
      paymentMethod: payload.paymentMethod,
      grossAmount: new Prisma.Decimal(payload.grossAmount),
      discountAmount: new Prisma.Decimal(payload.discountAmount),
      tipAmount: new Prisma.Decimal(payload.tipAmount),
      cardFeeAmount: new Prisma.Decimal(payload.cardFeeAmount),
      netAmount: new Prisma.Decimal(payload.netAmount),
      commissionAmount: payload.commissionAmount > 0
        ? new Prisma.Decimal(payload.commissionAmount)
        : undefined,
      professionalId: payload.commissionAmount > 0 ? payload.professionalId : undefined,
    });
  });

  eventBus.subscribe("scheduling.appointment.courtesy", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.EXPENSE,
      category: "cortesia",
      description: "Cortesia — serviço sem cobrança",
      amount: new Prisma.Decimal(payload.grossAmount),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("product.sold", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      type: TransactionType.INCOME,
      category: "Venda de Produto",
      description: `Venda de produto (qtd: ${payload.quantity})`,
      amount: new Prisma.Decimal(payload.totalAmount),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("stock.purchased", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      type: TransactionType.EXPENSE,
      category: "Compra de Estoque",
      description: `Compra de estoque (qtd: ${payload.quantity})`,
      amount: new Prisma.Decimal(payload.totalAmount),
      paidAt: new Date(),
    });
  });
}
