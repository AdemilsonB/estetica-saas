"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type EvolutionStatus = {
  instanceId: string | null;
  connected: boolean;
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "BANNED" | "ERROR";
  connectedAt: string | null;
  phone: string | null;
};

export type EvolutionContact = {
  phone: string;
  name: string;
  inCrm: boolean;
};

export function useEvolutionStatus(options?: { refetchInterval?: number | false | ((query: { state: { data?: EvolutionStatus } }) => number | false) }) {
  return useQuery<EvolutionStatus>({
    queryKey: ["evolution", "status"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/evolution/status");
      if (!res.ok) throw new Error("Erro ao buscar status Evolution");
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useEvolutionConnect() {
  const queryClient = useQueryClient();
  return useMutation<{ qrCode: string }, Error>({
    mutationFn: async () => {
      const res = await fetch("/api/whatsapp/evolution/connect", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "Erro ao conectar WhatsApp");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evolution", "status"] });
    },
  });
}

export function useEvolutionDisconnect() {
  const queryClient = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: async () => {
      const res = await fetch("/api/whatsapp/evolution/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao desconectar WhatsApp");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evolution", "status"] });
    },
  });
}

export function useEvolutionQrCode() {
  return useQuery<{ qrCode: string }>({
    queryKey: ["evolution", "qrcode"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/evolution/qrcode");
      if (!res.ok) throw new Error("Erro ao carregar QR Code");
      return res.json();
    },
    enabled: false,
  });
}

export function useEvolutionContacts() {
  return useQuery<{ contacts: EvolutionContact[]; total: number }>({
    queryKey: ["evolution", "contacts"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/evolution/contacts");
      if (!res.ok) throw new Error("Erro ao buscar contatos WhatsApp");
      return res.json();
    },
    enabled: false,
  });
}

export function useImportContacts() {
  const queryClient = useQueryClient();
  return useMutation<
    { created: number; skipped: number; errors: string[] },
    Error,
    Array<{ name: string; phone: string }>
  >({
    mutationFn: async (contacts) => {
      const res = await fetch("/api/crm/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });
      if (!res.ok) throw new Error("Erro ao importar contatos");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["evolution", "contacts"] });
    },
  });
}
