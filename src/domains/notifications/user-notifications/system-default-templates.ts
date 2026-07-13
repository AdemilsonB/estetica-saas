import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";

export type SystemTemplate = { subject: string | null; body: string };

function key(eventType: NotificationEventType, channel: TeamNotificationChannel): string {
  return `${eventType}:${channel}`;
}

const SYSTEM_TEMPLATES: Record<string, SystemTemplate> = {
  [key("appointment_created", "IN_APP")]: {
    subject: null,
    body: "{{cliente}} • {{servico}} • {{data}} às {{hora}}",
  },
  [key("appointment_created", "EMAIL")]: {
    subject: "Novo agendamento",
    body: "Novo agendamento de {{cliente}} para {{servico}} em {{data}} às {{hora}}.",
  },
  [key("appointment_cancelled", "IN_APP")]: {
    subject: null,
    body: "Agendamento de {{cliente}} ({{servico}}) para {{data}} às {{hora}} foi cancelado.",
  },
  [key("appointment_cancelled", "EMAIL")]: {
    subject: "Agendamento cancelado",
    body: "O agendamento de {{cliente}} ({{servico}}) para {{data}} às {{hora}} foi cancelado.",
  },
  [key("appointment_rescheduled", "IN_APP")]: {
    subject: null,
    body: "Agendamento de {{cliente}} remarcado para {{data}} às {{hora}}.",
  },
  [key("appointment_rescheduled", "EMAIL")]: {
    subject: "Agendamento remarcado",
    body: "O agendamento de {{cliente}} ({{servico}}) foi remarcado para {{data}} às {{hora}}.",
  },
  [key("appointment_no_show", "IN_APP")]: {
    subject: null,
    body: "{{cliente}} não compareceu ao atendimento de {{servico}} em {{data}} às {{hora}}.",
  },
  [key("appointment_no_show", "EMAIL")]: {
    subject: "Falta registrada",
    body: "{{cliente}} não compareceu ao atendimento de {{servico}} em {{data}} às {{hora}}.",
  },
  [key("customer_created", "IN_APP")]: {
    subject: null,
    body: "{{cliente}} acabou de se cadastrar.",
  },
};

export function getSystemTemplate(
  eventType: NotificationEventType,
  channel: TeamNotificationChannel,
): SystemTemplate | null {
  return SYSTEM_TEMPLATES[key(eventType, channel)] ?? null;
}
