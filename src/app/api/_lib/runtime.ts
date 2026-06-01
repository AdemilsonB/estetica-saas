import { registerFinancialSubscriptions } from "@/domains/financial/subscriptions";
import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";
import { registerBillingJobs } from "@/domains/billing/subscriptions";
import { startPgBoss } from "@/shared/queue/pg-boss";
import {
  APPOINTMENT_REMINDER_JOB,
  handleAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";
import { registerWhatsAppQuotaCleanup } from "@/shared/queue/jobs/whatsapp-quota-reset";
import { registerBirthdayReminder } from "@/shared/queue/jobs/birthday-reminder";
import { registerRecurringExpenseJob } from "@/shared/queue/jobs/recurring-expense";
import { registerVipSweepJob } from "@/shared/queue/jobs/vip-sweep";

let initialized = false;

export function initializeDomainRuntime() {
  if (initialized) {
    return;
  }

  try {
    registerFinancialSubscriptions();
    registerNotificationSubscriptions();
  } catch (err) {
    console.error("[runtime] Falha ao registrar subscriptions:", err);
  }

  startPgBoss()
    .then(async (boss) => {
      boss.work(APPOINTMENT_REMINDER_JOB, handleAppointmentReminder);
      registerBillingJobs(boss);
      await registerWhatsAppQuotaCleanup(boss);
      await registerBirthdayReminder(boss);
      await registerRecurringExpenseJob(boss);
      await registerVipSweepJob(boss);
    })
    .catch(console.error);

  initialized = true;
}
