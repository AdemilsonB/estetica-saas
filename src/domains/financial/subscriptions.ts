import { Prisma, TransactionType } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { eventBus } from "@/shared/events/event-bus";
import { FINANCIAL_CATEGORIES } from "./categories";

import { transactionRepository } from "./transaction.repository";

let financialSubscriptionsRegistered = false;

export function registerFinancialSubscriptions() {
  if (financialSubscriptionsRegistered) {
    return;
  }

  financialSubscriptionsRegistered = true;

  eventBus.subscribe("scheduling.appointment.paid", async (payload) => {
    const appt = await prisma.appointment.findUnique({
      where: { id: payload.appointmentId },
      select: {
        service: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    const serviceName = appt?.service?.name ?? "Serviço";
    const customerName = appt?.customer?.name ?? "";
    const description = customerName
      ? `Receita: ${serviceName} — ${customerName}`
      : `Receita: ${serviceName}`;

    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.INCOME,
      category: FINANCIAL_CATEGORIES.SERVICE,
      description,
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
      category: FINANCIAL_CATEGORIES.COURTESY,
      description: "Cortesia — serviço sem cobrança",
      amount: new Prisma.Decimal(payload.grossAmount),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("scheduling.appointment.payment_refunded", async (payload) => {
    const originalTransactions = await transactionRepository.findByAppointmentId(
      payload.tenantId,
      payload.appointmentId,
      { type: TransactionType.INCOME, category: FINANCIAL_CATEGORIES.SERVICE },
    );
    if (originalTransactions.length === 0) return;

    const totalAmount = originalTransactions.reduce((s, t) => s + Number(t.amount), 0);
    const totalNetAmount = originalTransactions.reduce(
      (s, t) => s + Number(t.netAmount ?? t.amount),
      0,
    );
    const totalCommission = originalTransactions.reduce(
      (s, t) => s + Number(t.commissionAmount ?? 0),
      0,
    );
    const professionalId = originalTransactions.find((t) => t.professionalId)?.professionalId;

    const appt = await prisma.appointment.findUnique({
      where: { id: payload.appointmentId },
      select: {
        service: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    const serviceName = appt?.service?.name ?? "Serviço";
    const customerName = appt?.customer?.name ?? "";
    const description = customerName
      ? `Estorno: ${serviceName} — ${customerName}`
      : `Estorno: ${serviceName}`;

    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.INCOME,
      category: FINANCIAL_CATEGORIES.SERVICE_REVERSAL,
      description,
      amount: new Prisma.Decimal(-totalAmount),
      netAmount: new Prisma.Decimal(-totalNetAmount),
      paidAt: new Date(),
      commissionAmount: totalCommission > 0 ? new Prisma.Decimal(-totalCommission) : undefined,
      professionalId: totalCommission > 0 ? professionalId : undefined,
    });
  });

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
