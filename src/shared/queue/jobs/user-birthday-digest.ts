import type { PgBoss } from "pg-boss";

import { prisma } from "@/shared/database/prisma";
import { userNotificationRepository } from "@/domains/notifications/user-notifications/user-notification.repository";
import type { CreateUserNotificationInput } from "@/domains/notifications/user-notifications/types";

export const USER_BIRTHDAY_DIGEST_JOB = "user-birthday-digest";

type BirthdayRow = {
  tenantId: string;
  id: string;
  name: string;
  phone: string | null;
  birthDate: Date;
};

// Constrói o conjunto de "MM-DD" dos próximos 7 dias (inclui hoje), cobrindo virada de mês.
function nextSevenDaysMMDD(now: Date): string[] {
  const set: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    set.push(`${mm}-${dd}`);
  }
  return set;
}

export async function handleUserBirthdayDigest(): Promise<void> {
  const days = nextSevenDaysMMDD(new Date());

  const rows = await prisma.$queryRaw<BirthdayRow[]>`
    SELECT c."tenantId", c.id, c.name, c.phone, c."birthDate"
    FROM "Customer" c
    WHERE c."birthDate" IS NOT NULL
      AND to_char(c."birthDate", 'MM-DD') = ANY(${days})
    ORDER BY to_char(c."birthDate", 'MM-DD') ASC
  `;

  if (rows.length === 0) return;

  // Agrupa por tenant.
  const byTenant = new Map<string, BirthdayRow[]>();
  for (const r of rows) {
    const list = byTenant.get(r.tenantId) ?? [];
    list.push(r);
    byTenant.set(r.tenantId, list);
  }

  for (const [tenantId, birthdays] of byTenant) {
    const managers = await userNotificationRepository.findManagers(tenantId);
    if (managers.length === 0) continue;

    const birthdayData = birthdays.map((b) => ({
      customerId: b.id,
      name: b.name,
      phone: b.phone,
      day: `${String(b.birthDate.getMonth() + 1).padStart(2, "0")}-${String(b.birthDate.getDate()).padStart(2, "0")}`,
    }));

    const notifRows: CreateUserNotificationInput[] = managers.map((m) => ({
      userId: m.id,
      type: "birthday_digest",
      title: `${birthdays.length} aniversariantes esta semana`,
      body: `${birthdays.length} cliente(s) fazem aniversário nos próximos 7 dias.`,
      data: { birthdays: birthdayData },
    }));

    await userNotificationRepository.createMany(tenantId, notifRows);
  }
}

export async function registerUserBirthdayDigest(boss: PgBoss): Promise<void> {
  await boss.schedule(USER_BIRTHDAY_DIGEST_JOB, "0 8 * * 1", {});
  boss.work(USER_BIRTHDAY_DIGEST_JOB, handleUserBirthdayDigest);
}
