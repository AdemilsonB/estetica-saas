import { Prisma, TransactionType } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";
import { FINANCIAL_CATEGORIES } from "./categories";

import { transactionRepository } from "./transaction.repository";

let financialSubscriptionsRegistered = false;

export function registerFinancialSubscriptions() {
  if (financialSubscriptionsRegistered) {
    return;
  }

  financialSubscriptionsRegistered = true;

  // Os fluxos de pagamento/cortesia/estorno de atendimento NÃO são tratados aqui:
  // foram movidos para dentro da mesma transação que altera o paymentStatus do
  // agendamento (ver scheduling.service + financial/appointment-revenue), garantindo
  // atomicidade entre marcar como pago e registrar a receita.

  eventBus.subscribe("product.sold", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      type: TransactionType.INCOME,
      category: FINANCIAL_CATEGORIES.PRODUCT_SALE,
      description: `Venda: ${payload.productName} × ${payload.quantity} un.`,
      amount: new Prisma.Decimal(payload.totalAmount),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("stock.purchased", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      type: TransactionType.EXPENSE,
      category: FINANCIAL_CATEGORIES.STOCK_PURCHASE,
      description: `Compra: ${payload.productName} × ${payload.quantity} un.`,
      amount: new Prisma.Decimal(payload.totalAmount),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("stock.appointment_use", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.EXPENSE,
      category: FINANCIAL_CATEGORIES.SUPPLY_USE,
      description: `Insumo: ${payload.productName} × ${payload.quantity} un. — ${payload.serviceName}`,
      amount: new Prisma.Decimal(payload.totalCost),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("stock.appointment_restore", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.EXPENSE,
      category: FINANCIAL_CATEGORIES.SUPPLY_REVERSAL,
      description: `Estorno de insumo: ${payload.productName} × ${payload.quantity} un. — ${payload.serviceName}`,
      amount: new Prisma.Decimal(payload.totalCost),
      paidAt: new Date(),
    });
  });
}
