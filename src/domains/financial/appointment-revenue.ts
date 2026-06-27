import { Prisma, TransactionType, type PaymentMethod } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

import { FINANCIAL_CATEGORIES } from "./categories";
import { transactionRepository } from "./transaction.repository";

/**
 * Registro financeiro do fluxo de pagamento de atendimento.
 *
 * Estas funções são chamadas DENTRO da mesma `prisma.$transaction` que altera o
 * `paymentStatus` do agendamento (ver scheduling.service), garantindo atomicidade:
 * ou o agendamento é marcado como pago E a receita é registrada, ou nada acontece.
 * Antes eram subscribers fire-and-forget do eventBus — se a criação da Transaction
 * falhasse, o agendamento ficava PAID sem receita correspondente (perda silenciosa).
 */

type TxClient = Prisma.TransactionClient | typeof prisma;

export type RecordAppointmentPaymentInput = {
  appointmentId: string;
  serviceName: string | null;
  customerName: string | null;
  paymentMethod: PaymentMethod;
  grossAmount: number;
  discountAmount: number;
  tipAmount: number;
  cardFeeAmount: number;
  netAmount: number;
  commissionAmount: number;
  professionalId: string;
};

export async function recordAppointmentPayment(
  client: TxClient,
  tenantId: string,
  input: RecordAppointmentPaymentInput,
) {
  const serviceName = input.serviceName ?? "Serviço";
  const description = input.customerName
    ? `Receita: ${serviceName} — ${input.customerName}`
    : `Receita: ${serviceName}`;

  return transactionRepository.create(
    tenantId,
    {
      appointmentId: input.appointmentId,
      type: TransactionType.INCOME,
      category: FINANCIAL_CATEGORIES.SERVICE,
      description,
      amount: new Prisma.Decimal(input.netAmount),
      paidAt: new Date(),
      paymentMethod: input.paymentMethod,
      grossAmount: new Prisma.Decimal(input.grossAmount),
      discountAmount: new Prisma.Decimal(input.discountAmount),
      tipAmount: new Prisma.Decimal(input.tipAmount),
      cardFeeAmount: new Prisma.Decimal(input.cardFeeAmount),
      netAmount: new Prisma.Decimal(input.netAmount),
      commissionAmount: input.commissionAmount > 0
        ? new Prisma.Decimal(input.commissionAmount)
        : undefined,
      professionalId: input.commissionAmount > 0 ? input.professionalId : undefined,
    },
    client,
  );
}

export async function recordAppointmentCourtesy(
  client: TxClient,
  tenantId: string,
  input: { appointmentId: string; grossAmount: number },
) {
  return transactionRepository.create(
    tenantId,
    {
      appointmentId: input.appointmentId,
      type: TransactionType.EXPENSE,
      category: FINANCIAL_CATEGORIES.COURTESY,
      description: "Cortesia — serviço sem cobrança",
      amount: new Prisma.Decimal(input.grossAmount),
      paidAt: new Date(),
    },
    client,
  );
}

/**
 * Cria a transação de estorno espelhando (com sinal negativo) a receita original
 * do atendimento. Retorna `null` se não houver receita registrada para estornar.
 */
export async function recordAppointmentRefund(
  client: TxClient,
  tenantId: string,
  input: { appointmentId: string; serviceName: string | null; customerName: string | null },
) {
  const originalTransactions = await transactionRepository.findByAppointmentId(
    tenantId,
    input.appointmentId,
    { type: TransactionType.INCOME, category: FINANCIAL_CATEGORIES.SERVICE },
    client,
  );
  if (originalTransactions.length === 0) return null;

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

  const serviceName = input.serviceName ?? "Serviço";
  const description = input.customerName
    ? `Estorno: ${serviceName} — ${input.customerName}`
    : `Estorno: ${serviceName}`;

  return transactionRepository.create(
    tenantId,
    {
      appointmentId: input.appointmentId,
      type: TransactionType.INCOME,
      category: FINANCIAL_CATEGORIES.SERVICE_REVERSAL,
      description,
      amount: new Prisma.Decimal(-totalAmount),
      netAmount: new Prisma.Decimal(-totalNetAmount),
      paidAt: new Date(),
      commissionAmount: totalCommission > 0 ? new Prisma.Decimal(-totalCommission) : undefined,
      professionalId: totalCommission > 0 ? professionalId : undefined,
    },
    client,
  );
}
