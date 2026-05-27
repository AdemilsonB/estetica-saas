import { registerFinancialSubscriptions } from "@/domains/financial/subscriptions";
import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";
import { registerBillingJobs } from "@/domains/billing/subscriptions";
import { startPgBoss } from "@/shared/queue/pg-boss";
import {
  APPOINTMENT_REMINDER_JOB,
  handleAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";

let initialized = false;

export function initializeDomainRuntime() {
  if (initialized) {
    return;
  }

  registerFinancialSubscriptions();
  registerNotificationSubscriptions();

  startPgBoss().then((boss) => {
    boss.work(APPOINTMENT_REMINDER_JOB, handleAppointmentReminder);
    registerBillingJobs(boss);
  }).catch(console.error);

  initialized = true;
}
