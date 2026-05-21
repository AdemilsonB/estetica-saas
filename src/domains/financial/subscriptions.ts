import { TransactionType } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";

import { financialService } from "./financial.service";

let financialSubscriptionsRegistered = false;

export function registerFinancialSubscriptions() {
  if (financialSubscriptionsRegistered) {
    return;
  }

  financialSubscriptionsRegistered = true;

  // Gera receita automaticamente quando agendamento é concluído
  eventBus.subscribe("scheduling.appointment.completed", async ({ tenantId, appointment }) => {
    await financialService.create(tenantId, {
      appointmentId: appointment.id,
      type: TransactionType.INCOME,
      category: "service",
      description: "Receita gerada automaticamente a partir de agendamento concluido.",
      amount: Number(appointment.price),
      paidAt: new Date().toISOString(),
    });
  });
}
