import type { NextRequest } from "next/server";
import type { Job } from "pg-boss";

import { startPgBoss } from "@/shared/queue/pg-boss";
import {
  APPOINTMENT_REMINDER_JOB,
  handleAppointmentReminder,
  type AppointmentReminderPayload,
} from "@/shared/queue/jobs/appointment-reminder";
import { BILLING_EXPIRE_SWEEP_JOB, handleBillingExpireSweep } from "@/domains/billing/subscriptions";
import { BIRTHDAY_REMINDER_JOB, handleBirthdayReminder } from "@/shared/queue/jobs/birthday-reminder";
import { DAILY_STATUS_JOB, handleDailyStatus } from "@/shared/queue/jobs/daily-status";
import { RECURRING_EXPENSE_JOB, handleRecurringExpense } from "@/shared/queue/jobs/recurring-expense";
import { VIP_SWEEP_JOB, handleVipSweep } from "@/shared/queue/jobs/vip-sweep";
import {
  SUBSCRIPTION_EXPIRY_WARNINGS_JOB,
  handleSubscriptionExpiryWarnings,
} from "@/shared/queue/jobs/subscription-expiry-warnings";
import { USAGE_SNAPSHOT_JOB, handleUsageSnapshot } from "@/shared/queue/jobs/usage-snapshot";
import {
  WHATSAPP_QUOTA_CLEANUP_JOB,
  handleWhatsAppQuotaCleanup,
} from "@/shared/queue/jobs/whatsapp-quota-reset";
import {
  USER_BIRTHDAY_DIGEST_JOB,
  handleUserBirthdayDigest,
} from "@/shared/queue/jobs/user-birthday-digest";
import {
  TEAM_NOTIFICATION_EMAIL_JOB,
  handleTeamNotificationEmail,
  type TeamNotificationEmailPayload,
} from "@/shared/queue/jobs/team-notification-email";
import { TEAM_DAILY_DIGEST_JOB, handleTeamDailyDigest } from "@/shared/queue/jobs/team-daily-digest";

type EmptyPayload = Record<string, never>;
type PgBossInstance = Awaited<ReturnType<typeof startPgBoss>>;

// Busca um lote de jobs, executa o handler e marca como completo ou falho.
// Usado para jobs cujo handler recebe o array de jobs (ex: lembretes por agendamento).
async function runBatch<T>(
  boss: PgBossInstance,
  name: string,
  handler: (jobs: Job<T>[]) => Promise<void>,
): Promise<number> {
  const jobs = await boss.fetch<T>(name, { batchSize: 10 });
  if (!jobs?.length) return 0;
  try {
    await handler(jobs);
    await boss.complete(name, jobs.map((j) => j.id));
    return jobs.length;
  } catch (err) {
    console.error(`[cron:tick] ${name} falhou:`, err);
    await boss.fail(name, jobs.map((j) => j.id));
    return 0;
  }
}

// Busca um único job agendado e executa o handler sem passar os jobs
// (handlers de manutenção que operam globalmente, não por job individual).
async function runScheduled(
  boss: PgBossInstance,
  name: string,
  handler: () => Promise<void>,
): Promise<number> {
  const jobs = await boss.fetch<EmptyPayload>(name, { batchSize: 1 });
  if (!jobs?.length) return 0;
  try {
    await handler();
    await boss.complete(name, jobs.map((j) => j.id));
    return jobs.length;
  } catch (err) {
    console.error(`[cron:tick] ${name} falhou:`, err);
    await boss.fail(name, jobs.map((j) => j.id));
    return 0;
  }
}

// CRON_SECRET é configurado manualmente na Vercel + secret do GitHub Actions
// (ver docs/infra-setup.md). trim() evita falso-negativo por espaço/quebra de
// linha colada sem querer no campo (textarea) de env var da Vercel.
// Em dev local, sem a variável, o endpoint fica aberto (facilitando testes manuais).
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const boss = await startPgBoss();

    // Registra/atualiza os crons no banco (idempotente).
    // Necessário em deploys frescos onde pgboss.schedule está vazio.
    await Promise.all([
      boss.schedule(BILLING_EXPIRE_SWEEP_JOB, "0 5 * * *", {}),
      boss.schedule(BIRTHDAY_REMINDER_JOB, "0 12 * * *", {}),
      boss.schedule(DAILY_STATUS_JOB, "0 * * * *", {}),
      boss.schedule(RECURRING_EXPENSE_JOB, "0 6 * * *", {}),
      boss.schedule(SUBSCRIPTION_EXPIRY_WARNINGS_JOB, "0 12 * * *", {}),
      boss.schedule(USAGE_SNAPSHOT_JOB, "0 1 1 * *", {}),
      boss.schedule(VIP_SWEEP_JOB, "0 2 * * *", {}),
      boss.schedule(WHATSAPP_QUOTA_CLEANUP_JOB, "0 2 1 * *", {}),
      boss.schedule(USER_BIRTHDAY_DIGEST_JOB, "0 8 * * 1", {}),
      boss.schedule(TEAM_DAILY_DIGEST_JOB, "0 * * * *", {}),
    ]);

    const [reminders, billing, birthday, dailyStatus, recurring, vip, expiry, snapshot, quota, userBirthday, teamEmail, teamDigest] =
      await Promise.all([
        runBatch<AppointmentReminderPayload>(boss, APPOINTMENT_REMINDER_JOB, handleAppointmentReminder),
        runScheduled(boss, BILLING_EXPIRE_SWEEP_JOB, handleBillingExpireSweep),
        runBatch(boss, BIRTHDAY_REMINDER_JOB, handleBirthdayReminder),
        runBatch(boss, DAILY_STATUS_JOB, handleDailyStatus),
        runBatch(boss, RECURRING_EXPENSE_JOB, handleRecurringExpense),
        runBatch(boss, VIP_SWEEP_JOB, handleVipSweep),
        runBatch(boss, SUBSCRIPTION_EXPIRY_WARNINGS_JOB, handleSubscriptionExpiryWarnings),
        runBatch(boss, USAGE_SNAPSHOT_JOB, handleUsageSnapshot),
        runScheduled(boss, WHATSAPP_QUOTA_CLEANUP_JOB, handleWhatsAppQuotaCleanup),
        runScheduled(boss, USER_BIRTHDAY_DIGEST_JOB, handleUserBirthdayDigest),
        runBatch<TeamNotificationEmailPayload>(boss, TEAM_NOTIFICATION_EMAIL_JOB, handleTeamNotificationEmail),
        runScheduled(boss, TEAM_DAILY_DIGEST_JOB, handleTeamDailyDigest),
      ]);

    return Response.json({
      ok: true,
      processed: {
        reminders,
        billing,
        birthday,
        dailyStatus,
        recurring,
        vip,
        expiry,
        snapshot,
        quota,
        userBirthday,
        teamEmail,
        teamDigest,
      },
    });
  } catch (err) {
    console.error("[cron:tick] erro fatal:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
