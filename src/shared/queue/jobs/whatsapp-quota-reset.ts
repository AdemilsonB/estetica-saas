import type { PgBoss } from "pg-boss";

import { prisma } from "@/shared/database/prisma";

export const WHATSAPP_QUOTA_CLEANUP_JOB = "whatsapp-quota-cleanup";

export async function handleWhatsAppQuotaCleanup(): Promise<void> {
  const now = new Date();
  const currentYearMonth = now.getFullYear() * 12 + (now.getMonth() + 1);
  const cutoff = currentYearMonth - 12;

  await prisma.$executeRaw`
    DELETE FROM "WhatsAppMonthlyUsage"
    WHERE (year * 12 + month) < ${cutoff}
  `;
}

export async function registerWhatsAppQuotaCleanup(boss: PgBoss): Promise<void> {
  await boss.schedule(
    WHATSAPP_QUOTA_CLEANUP_JOB,
    "0 2 1 * *", // dia 1 de cada mês, 02:00 UTC
    {},
  );

  await boss.work(WHATSAPP_QUOTA_CLEANUP_JOB, () => handleWhatsAppQuotaCleanup());
}
