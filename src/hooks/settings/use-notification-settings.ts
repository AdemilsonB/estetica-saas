import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NotificationStatus } from "@prisma/client";

export type NotificationSettings = {
  whatsappEnabled: boolean;
  timezone: string;
  plan: string;
  reminderLeadHours: number;
  reminderWindowStart: number;
  reminderWindowEnd: number;
};

type UpdateNotificationSettings = {
  whatsappEnabled?: boolean;
  timezone?: string;
  reminderLeadHours?: number;
  reminderWindowStart?: number;
  reminderWindowEnd?: number;
};

async function fetchNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch("/api/notifications/settings");
  if (!res.ok) throw new Error("Erro ao buscar configurações");
  return res.json() as Promise<NotificationSettings>;
}

async function updateNotificationSettings(
  input: UpdateNotificationSettings,
): Promise<NotificationSettings> {
  const res = await fetch("/api/notifications/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao salvar configurações");
  return res.json() as Promise<NotificationSettings>;
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification-settings"],
    queryFn: fetchNotificationSettings,
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    },
  });
}

export type WhatsAppUsage = {
  used: number;
  limit: number;
  resetDate: string;
  plan: string;
};

async function fetchWhatsAppUsage(): Promise<WhatsAppUsage> {
  const res = await fetch("/api/whatsapp/usage");
  if (!res.ok) throw new Error("Erro ao buscar uso WhatsApp");
  return res.json() as Promise<WhatsAppUsage>;
}

export function useWhatsAppUsage() {
  return useQuery({
    queryKey: ["whatsapp-usage"],
    queryFn: fetchWhatsAppUsage,
  });
}

export type TemplateConfig = {
  mensagemPrincipal: string;
  mensagemFinal: string;
};

export type WhatsAppTemplates = Record<string, TemplateConfig>;

async function fetchWhatsAppTemplates(): Promise<WhatsAppTemplates> {
  const res = await fetch("/api/whatsapp/templates");
  if (!res.ok) throw new Error("Erro ao buscar templates");
  return res.json() as Promise<WhatsAppTemplates>;
}

async function updateWhatsAppTemplate(input: {
  template: string;
  mensagemPrincipal: string;
  mensagemFinal: string;
}): Promise<void> {
  const res = await fetch("/api/whatsapp/templates", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao salvar template");
}

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: fetchWhatsAppTemplates,
  });
}

export function useUpdateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateWhatsAppTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
}

// --- Bulk reminder ---

async function sendBulkReminder(): Promise<{ sent: number }> {
  const res = await fetch("/api/notifications/bulk-reminder", { method: "POST" });
  if (!res.ok) throw new Error("Erro ao enviar lembretes em massa");
  return res.json() as Promise<{ sent: number }>;
}

export function useBulkReminder() {
  return useMutation({ mutationFn: sendBulkReminder });
}

// --- Notification history ---

export type NotificationLogEntry = {
  id: string;
  template: string;
  recipient: string;
  status: NotificationStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type NotificationLogPage = {
  data: NotificationLogEntry[];
  total: number;
  page: number;
  limit: number;
};

type NotificationLogFilter = {
  page?: number;
  template?: string;
  status?: string;
};

async function fetchNotificationLog(filter: NotificationLogFilter): Promise<NotificationLogPage> {
  const params = new URLSearchParams();
  if (filter.page) params.set("page", String(filter.page));
  if (filter.template) params.set("template", filter.template);
  if (filter.status) params.set("status", filter.status);
  const res = await fetch(`/api/notifications/log?${params.toString()}`);
  if (!res.ok) throw new Error("Erro ao buscar histórico de notificações");
  return res.json() as Promise<NotificationLogPage>;
}

export function useNotificationLog(filter: NotificationLogFilter = {}) {
  return useQuery({
    queryKey: ["notification-log", filter],
    queryFn: () => fetchNotificationLog(filter),
  });
}
