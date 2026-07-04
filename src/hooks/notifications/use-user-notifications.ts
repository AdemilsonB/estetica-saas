"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { NotificationDTO } from "@/domains/notifications/user-notifications/notification-view";
import type { NotificationPrefs } from "@/domains/notifications/user-notifications/types";

type Period = "7" | "30" | "all";

type FeedResponse = {
  items: NotificationDTO[];
  unreadCount: number;
  isManager: boolean;
  prefs: NotificationPrefs;
};

async function fetchFeed(period: Period): Promise<FeedResponse> {
  const res = await fetch(`/api/notifications/me?period=${period}`);
  if (!res.ok) throw new Error("Falha ao carregar notificações");
  return res.json();
}

export function useUserNotifications() {
  const [period, setPeriod] = useState<Period>("30");
  const qc = useQueryClient();
  const key = ["user-notifications", period];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchFeed(period),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (arg: { id?: string; all?: boolean }) => {
      const res = await fetch("/api/notifications/me/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      });
      if (!res.ok) throw new Error("Falha ao marcar como lida");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  const updatePrefs = useMutation({
    mutationFn: async (prefs: Partial<NotificationPrefs>) => {
      const res = await fetch("/api/notifications/me/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Falha ao salvar preferências");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  return {
    items: query.data?.items ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isManager: query.data?.isManager ?? false,
    prefs: query.data?.prefs ?? {
      notifyEmailAppointments: false,
      notifyOwnAppointments: false,
      notifyTeamAppointments: true,
    },
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    markRead: (id: string) => markRead.mutate({ id }),
    markAllRead: () => markRead.mutate({ all: true }),
    updatePrefs: (prefs: Partial<NotificationPrefs>) => updatePrefs.mutate(prefs),
    period,
    setPeriod,
  };
}
