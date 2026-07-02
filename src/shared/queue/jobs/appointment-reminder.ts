import type { Job } from "pg-boss";

import { prisma } from "@/shared/database/prisma";
import { NotificationChannel } from "@prisma/client";

import { getPgBoss } from "@/shared/queue/pg-boss";

export const APPOINTMENT_REMINDER_JOB = "appointment-reminder";

export type AppointmentReminderPayload = {
  appointmentId: string;
  tenantId: string;
};

function adjustToWindow(sendAt: Date, windowStart: number, windowEnd: number, tz: string): Date {
  const hour = parseInt(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(sendAt),
    10,
  );
  if (hour < windowStart) {
    return new Date(sendAt.getTime() + (windowStart - hour) * 3600_000);
  }
  if (hour >= windowEnd) {
    return new Date(sendAt.getTime() + (24 - hour + windowStart) * 3600_000);
  }
  return sendAt;
}

export async function handleAppointmentReminder(
  jobs: Job<AppointmentReminderPayload>[],
): Promise<void> {
  for (const job of jobs) {
    const { appointmentId, tenantId } = job.data;

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { customer: true, service: true },
    });

    if (!appointment || appointment.status === "CANCELLED") continue;
    if (!appointment.customer.phone) continue;

    const { notificationService } = await import("@/domains/notifications/notification.service");

    await notificationService.logAndDispatch({
      tenantId,
      appointmentId,
      customerId: appointment.customerId,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-reminder",
      recipient: appointment.customer.phone,
      payload: {
        appointmentId,
        startsAt: appointment.startsAt.toISOString(),
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name ?? "",
      },
    });
  }
}

export async function scheduleAppointmentReminder(
  tenantId: string,
  appointmentId: string,
  startsAt: Date,
): Promise<void> {
  try {
    const tenantConfig = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { reminderLeadHours: true, reminderWindowStart: true, reminderWindowEnd: true, timezone: true },
    });

    const leadHours = tenantConfig?.reminderLeadHours ?? 24;
    const windowStart = tenantConfig?.reminderWindowStart ?? 7;
    const windowEnd = tenantConfig?.reminderWindowEnd ?? 22;
    const tz = tenantConfig?.timezone ?? "America/Sao_Paulo";

    let sendAt = new Date(startsAt.getTime() - leadHours * 3600_000);
    if (sendAt <= new Date()) return;

    sendAt = adjustToWindow(sendAt, windowStart, windowEnd, tz);
    if (sendAt <= new Date()) return;

    const boss = getPgBoss();
    await boss.send(
      APPOINTMENT_REMINDER_JOB,
      { appointmentId, tenantId },
      {
        startAfter: sendAt,
        singletonKey: appointmentId,
        retryLimit: 2,
        retryDelay: 300,
      },
    );
  } catch (err) {
    // Reminder é best-effort — falha silenciosa para não quebrar o fluxo de agendamento
    console.error('[queue] Falha ao agendar lembrete:', appointmentId, err)
  }
}

export async function cancelAppointmentReminder(appointmentId: string): Promise<void> {
  try {
    const boss = getPgBoss();
    const jobs = await boss.findJobs(APPOINTMENT_REMINDER_JOB, { key: appointmentId });
    const ids = jobs.map((j) => j.id);
    if (ids.length > 0) {
      await boss.cancel(APPOINTMENT_REMINDER_JOB, ids);
    }
  } catch {
    // Silencia erros — o handler já verifica o status do appointment
  }
}
