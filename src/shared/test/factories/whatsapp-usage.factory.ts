import type { WhatsAppMonthlyUsage } from "@prisma/client";

export function makeWhatsAppUsage(
  overrides: Partial<WhatsAppMonthlyUsage> = {},
): WhatsAppMonthlyUsage {
  const now = new Date();
  return {
    id: "usage-1",
    tenantId: "tenant-1",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    count: 0,
    updatedAt: now,
    ...overrides,
  };
}
