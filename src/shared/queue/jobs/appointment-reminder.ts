import type { Job } from "pg-boss";

import { prisma } from "@/shared/database/prisma";
import { NotificationChannel } from "@prisma/client";

import { getPgBoss } from "@/shared/queue/pg-boss";

export const APPOINTMENT_REMINDER_JOB = "appointment-reminder";

export type AppointmentReminderPayload = {
  appointmentId: string;
  tenantId: string;
};

export async function handleAppointmentReminder(
  jobs: Job<AppointmentReminderPayload>[],
): Promise<void> {
  for (const job of jobs) {
    const { appointmentId, tenantId } = job.data;

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        customer: true,
        service: true,
      },
    });

    if (!appointment || appointment.status === "CANCELLED") continue;
    if (!appointment.customer.phone) continue;

    // Import dinâmico para evitar circular dependency
    const { notificationService } = await import("@/domains/notifications/notification.service");

    await notificationService.logAndDispatch({
      tenantId,
      appointmentId,
      customerId: appointment.customerId,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-reminder",
      recipient: appointment.customer.phone,
      provider: "z-api",
      payload: {
        appointmentId,
        startsAt: appointment.startsAt.toISOString(),
        customerName: appointment.customer.name,
        serviceName: appointment.service.name,
      },
    });
  }
}

export async function scheduleAppointmentReminder(
  tenantId: string,
  appointmentId: string,
  startsAt: Date,
): Promise<void> {
  const sendAt = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
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
}

export async function cancelAppointmentReminder(
  appointmentId: string,
): Promise<void> {
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
