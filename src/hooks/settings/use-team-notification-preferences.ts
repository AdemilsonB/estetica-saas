import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationEventType } from "@prisma/client";

export type MyTeamNotificationPreferences = {
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  emailOverrides: { eventType: NotificationEventType; enabled: boolean }[];
};

export type UpdateMyTeamNotificationPreferencesInput = Partial<{
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  emailOverrides: { eventType: NotificationEventType; enabled: boolean }[];
}>;

async function fetchMyTeamNotificationPreferences(): Promise<MyTeamNotificationPreferences> {
  const res = await fetch("/api/notifications/me/team-preferences");
  if (!res.ok) throw new Error("Falha ao carregar minhas preferências");
  return res.json();
}

async function updateMyTeamNotificationPreferences(
  input: UpdateMyTeamNotificationPreferencesInput,
): Promise<void> {
  const res = await fetch("/api/notifications/me/team-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao salvar minhas preferências");
}

export function useMyTeamNotificationPreferences() {
  return useQuery({
    queryKey: ["my-team-notification-preferences"],
    queryFn: fetchMyTeamNotificationPreferences,
    staleTime: 60_000,
  });
}

export function useUpdateMyTeamNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateMyTeamNotificationPreferences,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-team-notification-preferences"] }),
  });
}
