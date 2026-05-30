import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type NotificationSettings = {
  whatsappEnabled: boolean;
  timezone: string;
  plan: string;
};

type UpdateNotificationSettings = {
  whatsappEnabled?: boolean;
  timezone?: string;
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
