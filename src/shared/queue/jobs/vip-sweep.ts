import type { PgBoss, Job } from "pg-boss";

import { prisma } from "@/shared/database/prisma";

export const VIP_SWEEP_JOB = "vip-sweep";

type SpendRow = { customerId: string; total: number };

export function percentile80Threshold(rows: SpendRow[]): number {
  if (rows.length < 5) return Infinity;
  const sorted = [...rows].sort((a, b) => a.total - b.total);
  return sorted[Math.floor(sorted.length * 0.8)].total;
}

async function processTenant(tenantId: string): Promise<void> {
  const rows = await prisma.$queryRaw<SpendRow[]>`
    SELECT a."customerId", SUM(t.amount)::float AS total
    FROM "Transaction" t
    JOIN "Appointment" a ON a.id = t."appointmentId"
    WHERE t."tenantId" = ${tenantId}
    AND a."tenantId" = ${tenantId}
    AND t.type = 'INCOME'::"TransactionType"
    AND t."paidAt" >= NOW() - INTERVAL '365 days'
    AND a."customerId" IS NOT NULL
    GROUP BY a."customerId"
  `;

  const threshold = percentile80Threshold(rows);

  if (threshold === Infinity) {
    await prisma.customer.updateMany({
      where: { tenantId },
      data: { isVip: false, vipUpdatedAt: new Date() },
    });
    return;
  }

  const vipIds = rows.filter((r) => r.total >= threshold).map((r) => r.customerId);

  await prisma.customer.updateMany({
    where: { tenantId, id: { in: vipIds } },
    data: { isVip: true, vipUpdatedAt: new Date() },
  });

  await prisma.customer.updateMany({
    where: { tenantId, id: { notIn: vipIds } },
    data: { isVip: false, vipUpdatedAt: new Date() },
  });
}

export async function handleVipSweep(
  _jobs: Job<Record<string, never>>[],
): Promise<void> {
  const tenants = await prisma.$queryRaw<{ tenantId: string }[]>`
    SELECT DISTINCT "tenantId" FROM "Customer"
  `;

  for (const { tenantId } of tenants) {
    await processTenant(tenantId);
  }
}

export async function registerVipSweepJob(boss: PgBoss): Promise<void> {
  await boss.schedule(VIP_SWEEP_JOB, "0 2 * * *", {});
  boss.work(VIP_SWEEP_JOB, handleVipSweep);
}
