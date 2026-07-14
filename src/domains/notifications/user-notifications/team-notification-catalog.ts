import type { NotificationEventType } from "@prisma/client";

export type EventCatalogEntry = {
  eventType: NotificationEventType;
  label: string;
  description: string;
  supportsEmail: boolean; // se faz sentido mostrar o toggle de e-mail pra este evento
  variables: string[]; // variáveis disponíveis no editor de template deste evento
};

// Só os eventos que o dispatcher já emite de verdade (ver Global Constraints do
// plano) — appointment_pending_confirmation/payment_pending (worklist lazy) e
// customer_inactive/agenda_idle/monthly_goal (Fase 1-b/2) ficam de fora.
export const TEAM_NOTIFICATION_CATALOG: EventCatalogEntry[] = [
  {
    eventType: "appointment_created",
    label: "Novo agendamento",
    description: "Quando um agendamento é criado (painel ou vitrine pública).",
    supportsEmail: true,
    variables: ["cliente", "servico", "profissional", "data", "hora", "negocio", "link_acao"],
  },
  {
    eventType: "appointment_cancelled",
    label: "Cancelamento",
    description: "Quando um agendamento é cancelado.",
    supportsEmail: true,
    variables: ["cliente", "servico", "profissional", "data", "hora", "negocio", "link_acao"],
  },
  {
    eventType: "appointment_rescheduled",
    label: "Reagendamento",
    description: "Quando a data ou hora de um agendamento muda.",
    supportsEmail: true,
    variables: ["cliente", "servico", "profissional", "data", "hora", "negocio", "link_acao"],
  },
  {
    eventType: "appointment_no_show",
    label: "Falta (no-show)",
    description: "Quando um cliente não comparece ao atendimento.",
    supportsEmail: true,
    variables: ["cliente", "servico", "profissional", "data", "hora", "negocio", "link_acao"],
  },
  {
    eventType: "customer_created",
    label: "Novo cliente",
    description: "Quando um cliente novo se cadastra.",
    supportsEmail: true,
    variables: ["cliente", "negocio", "link_acao"],
  },
  {
    eventType: "daily_digest",
    label: "Resumo do dia",
    description: "Resumo por e-mail dos agendamentos de hoje, enviado às 08:00 no horário do seu negócio.",
    supportsEmail: true,
    variables: ["negocio", "valor"],
  },
  {
    eventType: "birthday_digest",
    label: "Aniversariantes da semana",
    description: "Lista semanal de clientes aniversariantes, toda segunda-feira.",
    supportsEmail: false,
    variables: ["negocio"],
  },
];

export const TEAM_NOTIFICATION_CATALOG_MAP: Record<string, EventCatalogEntry> = Object.fromEntries(
  TEAM_NOTIFICATION_CATALOG.map((e) => [e.eventType, e]),
);
