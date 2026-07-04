import type { UserNotification } from "@prisma/client";

import { getEmailProvider } from "@/domains/notifications/providers/email.provider";
import {
  professionalNewAppointmentHtml,
  professionalCancelledAppointmentHtml,
} from "@/domains/notifications/providers/email-templates";
import { userNotificationRepository, UserNotificationRepository } from "./user-notification.repository";
import type {
  CreateUserNotificationInput,
  ManagerRecipient,
  NotificationPrefs,
  UserNotificationType,
} from "./types";

type AppointmentPayload = {
  tenantId: string;
  appointment: { id: string; createdByUserId: string | null; startsAt: Date };
  customer: { id: string; name: string };
  service: { id: string; name: string };
  professional: { id: string; name: string; email: string };
};

// Destinatário candidato normalizado (profissional do atendimento ou gestor).
type Candidate = {
  id: string;
  name: string;
  email: string;
  isProfessional: boolean; // é o profissional do atendimento
  isManager: boolean; // OWNER/MANAGER
} & NotificationPrefs;

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export class UserNotificationService {
  constructor(private readonly repo: UserNotificationRepository = userNotificationRepository) {}

  async notifyAppointment(payload: AppointmentPayload, kind: "created" | "cancelled"): Promise<void> {
    const { tenantId, appointment, customer, service, professional } = payload;
    const managers = await this.repo.findManagers(tenantId);

    // Monta candidatos: profissional do atendimento + gestores, deduplicado por id.
    const byId = new Map<string, Candidate>();

    const proProfile = managers.find((m) => m.id === professional.id);
    byId.set(professional.id, {
      id: professional.id,
      name: professional.name,
      email: professional.email,
      isProfessional: true,
      isManager: Boolean(proProfile),
      notifyEmailAppointments: proProfile?.notifyEmailAppointments ?? false,
      notifyOwnAppointments: proProfile?.notifyOwnAppointments ?? false,
      notifyTeamAppointments: proProfile?.notifyTeamAppointments ?? true,
    });

    for (const m of managers) {
      if (byId.has(m.id)) continue;
      byId.set(m.id, {
        id: m.id,
        name: m.name,
        email: m.email,
        isProfessional: false,
        isManager: true,
        notifyEmailAppointments: m.notifyEmailAppointments,
        notifyOwnAppointments: m.notifyOwnAppointments,
        notifyTeamAppointments: m.notifyTeamAppointments,
      });
    }

    const dateTime = formatDateTime(appointment.startsAt);
    const type: UserNotificationType =
      kind === "created" ? "appointment_created" : "appointment_cancelled";

    const rows: CreateUserNotificationInput[] = [];
    const emailTargets: Candidate[] = [];

    for (const c of byId.values()) {
      // Auto-skip: só em criação, quando o candidato é o criador e não optou por se avisar.
      if (kind === "created" && appointment.createdByUserId === c.id && !c.notifyOwnAppointments) {
        continue;
      }
      // Gestor puro (não é o profissional do atendimento) que desligou avisos da equipe.
      if (!c.isProfessional && c.isManager && !c.notifyTeamAppointments) {
        continue;
      }

      const isSelfCreator = appointment.createdByUserId === c.id;
      const title =
        kind === "cancelled"
          ? "Agendamento cancelado"
          : isSelfCreator
            ? "Você marcou um horário"
            : appointment.createdByUserId === null
              ? "Novo agendamento pela vitrine"
              : "Novo agendamento na sua agenda";
      const body =
        kind === "cancelled"
          ? `O agendamento de ${customer.name} (${service.name}) para ${dateTime} foi cancelado.`
          : `${customer.name} • ${service.name} • ${dateTime}`;

      rows.push({
        userId: c.id,
        type,
        title,
        body,
        data: {
          appointmentId: appointment.id,
          customerName: customer.name,
          serviceName: service.name,
          startsAt: appointment.startsAt.toISOString(),
        },
      });

      if (c.notifyEmailAppointments) emailTargets.push(c);
    }

    await this.repo.createMany(tenantId, rows);

    // E-mail transacional (opt-in). Falhas não quebram o fluxo.
    for (const c of emailTargets) {
      const html =
        kind === "created"
          ? professionalNewAppointmentHtml({
              professionalName: c.name,
              customerName: customer.name,
              serviceName: service.name,
              dateTime,
              tenantName: "",
            })
          : professionalCancelledAppointmentHtml({
              professionalName: c.name,
              customerName: customer.name,
              serviceName: service.name,
              dateTime,
              tenantName: "",
            });
      const subject = kind === "created" ? "Novo agendamento" : "Agendamento cancelado";
      try {
        await getEmailProvider().send({ to: c.email, subject, html });
      } catch (err) {
        console.error("[user-notifications] falha ao enviar e-mail:", err);
      }
    }
  }

  async notifyCustomerCreated(payload: { tenantId: string; customer: { id: string; name: string } }): Promise<void> {
    const managers = await this.repo.findManagers(payload.tenantId);
    if (managers.length === 0) return;

    const rows: CreateUserNotificationInput[] = managers.map((m: ManagerRecipient) => ({
      userId: m.id,
      type: "customer_created",
      title: "Novo cliente cadastrado",
      body: `${payload.customer.name} acabou de se cadastrar.`,
      data: { customerId: payload.customer.id, customerName: payload.customer.name },
    }));

    await this.repo.createMany(payload.tenantId, rows);
  }

  async listForUser(
    tenantId: string,
    userId: string,
    opts: { period: "7" | "30" | "all"; limit: number },
  ): Promise<{ items: UserNotification[]; unreadCount: number; isManager: boolean; prefs: NotificationPrefs }> {
    const prefsRow = await this.repo.findUserPrefs(tenantId, userId);
    const since =
      opts.period === "all"
        ? undefined
        : new Date(Date.now() - Number(opts.period) * 24 * 60 * 60 * 1000);

    const [items, unreadCount] = await Promise.all([
      this.repo.findManyForUser(tenantId, userId, { since, limit: opts.limit }),
      this.repo.countUnread(tenantId, userId),
    ]);

    return {
      items,
      unreadCount,
      isManager: prefsRow?.role === "OWNER" || prefsRow?.role === "MANAGER",
      prefs: {
        notifyEmailAppointments: prefsRow?.notifyEmailAppointments ?? false,
        notifyOwnAppointments: prefsRow?.notifyOwnAppointments ?? false,
        notifyTeamAppointments: prefsRow?.notifyTeamAppointments ?? true,
      },
    };
  }

  markRead(tenantId: string, userId: string, arg: { id?: string; all?: boolean }): Promise<number> {
    return this.repo.markRead(tenantId, userId, arg);
  }

  updatePreferences(
    tenantId: string,
    userId: string,
    prefs: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    return this.repo.updatePrefs(tenantId, userId, prefs);
  }
}

export const userNotificationService = new UserNotificationService();
