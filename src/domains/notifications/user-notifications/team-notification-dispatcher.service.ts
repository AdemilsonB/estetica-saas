import type { Appointment } from "@prisma/client";

import { startPgBoss } from "@/shared/queue/pg-boss";
import { TEAM_NOTIFICATION_EMAIL_JOB, type TeamNotificationEmailPayload } from "@/shared/queue/jobs/team-notification-email";
import { userNotificationRepository, UserNotificationRepository } from "./user-notification.repository";
import {
  tenantNotificationSettingRepository,
  TenantNotificationSettingRepository,
} from "./tenant-notification-setting.repository";
import {
  userNotificationPreferenceRepository,
  UserNotificationPreferenceRepository,
} from "./user-notification-preference.repository";
import { resolveDelivery } from "./notification-channel-resolver";
import type { CreateUserNotificationInput } from "./types";

type AppointmentEventKind =
  | "appointment_created"
  | "appointment_cancelled"
  | "appointment_no_show"
  | "appointment_rescheduled";

type AppointmentPayload = {
  tenantId: string;
  appointment: Pick<Appointment, "id" | "createdByUserId" | "startsAt" | "packageId">;
  customer: { id: string; name: string };
  service: { id: string; name: string };
  professional: { id: string; name: string; email: string };
  origin?: "panel" | "public";
};

type RescheduledPayload = {
  tenantId: string;
  appointmentId: string;
  customerId: string;
  customerName: string;
  newStartsAt: Date;
};

type RecipientCandidate = {
  id: string;
  name: string;
  email: string;
  isProfessional: boolean;
  isManager: boolean;
  notifyOwnAppointments: boolean;
  notifyTeamAppointments: boolean;
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

const EVENT_TITLES: Record<AppointmentEventKind, string> = {
  appointment_created: "Novo agendamento",
  appointment_cancelled: "Agendamento cancelado",
  appointment_no_show: "Falta registrada",
  appointment_rescheduled: "Agendamento remarcado",
};

function formatDateTime(date: Date, tz: string): { data: string; hora: string } {
  return {
    data: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz }).format(date),
    hora: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(date),
  };
}

export class TeamNotificationDispatcherService {
  constructor(
    private readonly userNotifRepo: UserNotificationRepository = userNotificationRepository,
    private readonly settingRepo: TenantNotificationSettingRepository = tenantNotificationSettingRepository,
    private readonly prefRepo: UserNotificationPreferenceRepository = userNotificationPreferenceRepository,
  ) {}

  async dispatchAppointmentEvent(kind: AppointmentEventKind, payload: AppointmentPayload): Promise<void> {
    const { tenantId, appointment, customer, service, professional } = payload;
    const isPublic = payload.origin === "public";

    const [managers, proContext, tenantSetting, tenantTz] = await Promise.all([
      this.userNotifRepo.findManagers(tenantId),
      this.userNotifRepo.findRecipientContext(tenantId, professional.id),
      this.settingRepo.findByTenant(tenantId, kind),
      this.userNotifRepo.findTenantTimezone(tenantId),
    ]);

    const byId = new Map<string, RecipientCandidate>();
    byId.set(professional.id, {
      id: professional.id,
      name: professional.name,
      email: professional.email,
      isProfessional: true,
      isManager: proContext?.role === "OWNER" || proContext?.role === "MANAGER",
      notifyOwnAppointments: proContext?.notifyOwnAppointments ?? false,
      notifyTeamAppointments: proContext?.notifyTeamAppointments ?? true,
      notificationDeliveryMode: proContext?.notificationDeliveryMode ?? "realtime",
      quietHoursStart: proContext?.quietHoursStart ?? null,
      quietHoursEnd: proContext?.quietHoursEnd ?? null,
    });
    for (const m of managers) {
      if (byId.has(m.id)) continue;
      byId.set(m.id, {
        id: m.id,
        name: m.name,
        email: m.email,
        isProfessional: false,
        isManager: true,
        notifyOwnAppointments: m.notifyOwnAppointments,
        notifyTeamAppointments: m.notifyTeamAppointments,
        notificationDeliveryMode: m.notificationDeliveryMode,
        quietHoursStart: m.quietHoursStart,
        quietHoursEnd: m.quietHoursEnd,
      });
    }

    const recipients: RecipientCandidate[] = [];
    for (const c of byId.values()) {
      if (kind === "appointment_created" && !isPublic && appointment.createdByUserId === c.id && !c.notifyOwnAppointments) {
        continue;
      }
      if (!c.isProfessional && c.isManager && !c.notifyTeamAppointments) continue;
      recipients.push(c);
    }
    if (recipients.length === 0) return;

    const overrides = await this.prefRepo.findEmailOverridesForUsers(tenantId, recipients.map((r) => r.id), kind);
    const dt = formatDateTime(appointment.startsAt, tenantTz);
    const serviceLabel = service.name || (appointment.packageId ? "Pacote" : "Atendimento");
    const now = new Date();

    // Duas listas resolvidas ANTES de qualquer I/O de fila: garante que uma falha ao
    // enfileirar e-mail (Task 13/pg-boss fora do ar) nunca impede a gravação in-app dos
    // demais destinatários já resolvidos — isolamento de falhas exigido pelo spec.
    const rows: CreateUserNotificationInput[] = [];
    const emailJobs: { payload: TeamNotificationEmailPayload; startAfter: Date | undefined }[] = [];

    for (const r of recipients) {
      const delivery = resolveDelivery({
        eventType: kind,
        tenantSetting: tenantSetting ? { enabled: tenantSetting.enabled, defaultChannels: tenantSetting.defaultChannels } : null,
        emailOverrideEnabled: overrides.get(r.id) ?? null,
        prefs: { deliveryMode: r.notificationDeliveryMode, quietHoursStart: r.quietHoursStart, quietHoursEnd: r.quietHoursEnd },
        now,
        tz: tenantTz,
      });
      if (!delivery.eventEnabled) continue;

      if (delivery.inApp) {
        rows.push({
          userId: r.id,
          type: kind,
          title: EVENT_TITLES[kind],
          body: `${customer.name} • ${serviceLabel} • ${dt.data} às ${dt.hora}`,
          data: {
            appointmentId: appointment.id,
            customerName: customer.name,
            serviceName: serviceLabel,
            startsAt: appointment.startsAt.toISOString(),
            origin: isPublic ? "public" : "panel",
          },
        });
      }

      if (delivery.email) {
        emailJobs.push({
          payload: {
            tenantId,
            userId: r.id,
            eventType: kind,
            variables: { cliente: customer.name, servico: serviceLabel, data: dt.data, hora: dt.hora },
          },
          startAfter: delivery.emailStartAfter ?? undefined,
        });
      }
    }

    if (rows.length > 0) await this.userNotifRepo.createMany(tenantId, rows);

    if (emailJobs.length > 0) {
      const boss = await startPgBoss();
      for (const job of emailJobs) {
        try {
          await boss.send(TEAM_NOTIFICATION_EMAIL_JOB, job.payload, {
            startAfter: job.startAfter,
            retryLimit: 2,
            retryDelay: 300,
          });
        } catch (err) {
          console.error(`[team-notifications] falha ao enfileirar email para ${job.payload.userId}:`, err);
        }
      }
    }
  }

  async dispatchAppointmentRescheduled(payload: RescheduledPayload): Promise<void> {
    const { tenantId, appointmentId, customerId, customerName, newStartsAt } = payload;
    const enriched = await this.userNotifRepo.findAppointmentForNotification(tenantId, appointmentId);
    if (!enriched) return;

    await this.dispatchAppointmentEvent("appointment_rescheduled", {
      tenantId,
      appointment: {
        id: appointmentId,
        createdByUserId: enriched.createdByUserId,
        startsAt: newStartsAt,
        packageId: enriched.packageId,
      },
      customer: { id: customerId, name: customerName },
      service: { id: enriched.serviceId ?? "", name: enriched.serviceName },
      professional: enriched.professional,
    });
  }

  async dispatchCustomerCreated(payload: { tenantId: string; customer: { id: string; name: string } }): Promise<void> {
    const { tenantId, customer } = payload;
    const managers = await this.userNotifRepo.findManagers(tenantId);
    if (managers.length === 0) return;

    const [tenantSetting, overrides, tenantTz] = await Promise.all([
      this.settingRepo.findByTenant(tenantId, "customer_created"),
      this.prefRepo.findEmailOverridesForUsers(tenantId, managers.map((m) => m.id), "customer_created"),
      this.userNotifRepo.findTenantTimezone(tenantId),
    ]);
    const now = new Date();

    const rows: CreateUserNotificationInput[] = [];
    const emailJobs: { payload: TeamNotificationEmailPayload; startAfter: Date | undefined }[] = [];

    for (const m of managers) {
      const delivery = resolveDelivery({
        eventType: "customer_created",
        tenantSetting: tenantSetting ? { enabled: tenantSetting.enabled, defaultChannels: tenantSetting.defaultChannels } : null,
        emailOverrideEnabled: overrides.get(m.id) ?? null,
        prefs: { deliveryMode: m.notificationDeliveryMode, quietHoursStart: m.quietHoursStart, quietHoursEnd: m.quietHoursEnd },
        now,
        tz: tenantTz,
      });
      if (!delivery.eventEnabled) continue;

      if (delivery.inApp) {
        rows.push({
          userId: m.id,
          type: "customer_created",
          title: "Novo cliente cadastrado",
          body: `${customer.name} acabou de se cadastrar.`,
          data: { customerId: customer.id, customerName: customer.name },
        });
      }
      if (delivery.email) {
        emailJobs.push({
          payload: { tenantId, userId: m.id, eventType: "customer_created", variables: { cliente: customer.name } },
          startAfter: delivery.emailStartAfter ?? undefined,
        });
      }
    }

    if (rows.length > 0) await this.userNotifRepo.createMany(tenantId, rows);

    if (emailJobs.length > 0) {
      const boss = await startPgBoss();
      for (const job of emailJobs) {
        try {
          await boss.send(TEAM_NOTIFICATION_EMAIL_JOB, job.payload, {
            startAfter: job.startAfter,
            retryLimit: 2,
            retryDelay: 300,
          });
        } catch (err) {
          console.error(`[team-notifications] falha ao enfileirar email para ${job.payload.userId}:`, err);
        }
      }
    }
  }
}

export const teamNotificationDispatcher = new TeamNotificationDispatcherService();
