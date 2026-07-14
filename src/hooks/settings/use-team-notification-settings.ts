import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";

export type BusinessEventSetting = {
  eventType: NotificationEventType;
  label: string;
  description: string;
  supportsEmail: boolean;
  enabled: boolean;
  defaultChannels: TeamNotificationChannel[];
};

export type UpdateBusinessEventInput = {
  eventType: NotificationEventType;
  enabled: boolean;
  defaultChannels: TeamNotificationChannel[];
};

export type NotificationTemplateDTO = { subject: string | null; body: string; isSystemDefault: boolean } | null;

export type UpdateNotificationTemplateInput = {
  eventType: NotificationEventType;
  channel: TeamNotificationChannel;
  subject: string | null;
  body: string;
};

async function fetchTeamNotificationSettings(): Promise<BusinessEventSetting[]> {
  const res = await fetch("/api/notifications/team-settings");
  if (!res.ok) throw new Error("Falha ao carregar avisos do negócio");
  const json = await res.json();
  return json.settings;
}

async function updateTeamNotificationSetting(input: UpdateBusinessEventInput): Promise<BusinessEventSetting> {
  const res = await fetch("/api/notifications/team-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao salvar aviso do negócio");
  return res.json();
}

async function fetchNotificationTemplate(
  eventType: NotificationEventType,
  channel: TeamNotificationChannel,
): Promise<NotificationTemplateDTO> {
  const res = await fetch(`/api/notifications/team-settings/templates?eventType=${eventType}&channel=${channel}`);
  if (!res.ok) throw new Error("Falha ao carregar template");
  return res.json();
}

async function updateNotificationTemplate(input: UpdateNotificationTemplateInput): Promise<NotificationTemplateDTO> {
  const res = await fetch("/api/notifications/team-settings/templates", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao salvar template");
  return res.json();
}

export function useTeamNotificationSettings() {
  return useQuery({ queryKey: ["team-notification-settings"], queryFn: fetchTeamNotificationSettings, staleTime: 60_000 });
}

export function useUpdateTeamNotificationSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTeamNotificationSetting,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-notification-settings"] }),
  });
}

export function useNotificationTemplate(eventType: NotificationEventType, channel: TeamNotificationChannel, enabled: boolean) {
  return useQuery({
    queryKey: ["notification-template", eventType, channel],
    queryFn: () => fetchNotificationTemplate(eventType, channel),
    enabled,
  });
}

export function useUpdateNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationTemplate,
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ["notification-template", variables.eventType, variables.channel] }),
  });
}
