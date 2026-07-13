import type { Job } from "pg-boss";
import type { NotificationEventType } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { getEmailProvider } from "@/domains/notifications/providers/email.provider";
import { notificationTemplateRepository } from "@/domains/notifications/user-notifications/notification-template.repository";
import { getSystemTemplate } from "@/domains/notifications/user-notifications/system-default-templates";
import { renderNotification } from "@/domains/notifications/user-notifications/notification-template-engine";

export const TEAM_NOTIFICATION_EMAIL_JOB = "team-notification-email";

export type TeamNotificationEmailPayload = {
  tenantId: string;
  userId: string;
  eventType: NotificationEventType;
  variables: Record<string, string>;
};

export async function handleTeamNotificationEmail(jobs: Job<TeamNotificationEmailPayload>[]): Promise<void> {
  for (const job of jobs) {
    const { tenantId, userId, eventType, variables } = job.data;

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { email: true, name: true } });
    if (!user) continue;

    const [customTemplate, tenant] = await Promise.all([
      notificationTemplateRepository.findByTenant(tenantId, eventType, "EMAIL"),
      prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } }),
    ]);
    const template = customTemplate ?? getSystemTemplate(eventType, "EMAIL");
    if (!template) continue; // evento sem template de e-mail (ex.: eventos in-app-only)

    const rendered = renderNotification(template, { ...variables, negocio: tenant?.name ?? "" }, "EMAIL");

    try {
      await getEmailProvider().send({
        to: user.email,
        subject: rendered.subject || "Nova notificação",
        html: `<p>${rendered.body}</p>`,
      });
    } catch (err) {
      console.error(`[team-notification-email] falha ao enviar para ${user.email}:`, err);
    }
  }
}
