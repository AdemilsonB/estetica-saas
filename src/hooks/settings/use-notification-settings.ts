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
