import type { PgBoss, Job } from "pg-boss";

import { prisma } from "@/shared/database/prisma";
import { NotificationChannel } from "@prisma/client";

export const BIRTHDAY_REMINDER_JOB = "birthday-reminder";

export async function handleBirthdayReminder(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate(); // 1-31

  // Busca clientes aniversariantes hoje em tenants com WhatsApp ativo
  const customers = await prisma.$queryRaw<
    { id: string; tenantId: string; name: string; phone: string }[]
  >`
    SELECT c.id, c."tenantId", c.name, c.phone
    FROM "Customer" c
    INNER JOIN "Tenant" t ON t.id = c."tenantId"
    WHERE c."birthDate" IS NOT NULL
      AND EXTRACT(MONTH FROM c."birthDate") = ${month}
      AND EXTRACT(DAY FROM c."birthDate") = ${day}
      AND c."consentGiven" = true
      AND c.phone IS NOT NULL
      AND t."whatsappEnabled" = true
  `;

  if (customers.length === 0) return;

  const { notificationService } = await import("@/domains/notifications/notification.service");

  for (const customer of customers) {
    await notificationService.logAndDispatch({
      tenantId: customer.tenantId,
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      template: "birthday",
      recipient: customer.phone,
      provider: "twilio",
      payload: { customerName: customer.name },
    });
  }
}

export async function registerBirthdayReminder(boss: PgBoss): Promise<void> {
  // Roda todo dia às 9h (America/Sao_Paulo = UTC-3, então 12h UTC)
  await boss.schedule(BIRTHDAY_REMINDER_JOB, "0 12 * * *", {});
  boss.work(BIRTHDAY_REMINDER_JOB, handleBirthdayReminder);
}
