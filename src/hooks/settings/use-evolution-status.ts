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
  profilePicUrl: string | null;
  inCrm: boolean;
};

// Payload rico do import: os campos que a etapa de revisão pode preencher
export type ImportCustomerPayload = {
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  tags: string[];
  isVip?: boolean;
};

export function useEvolutionStatus(options?: {
  refetchInterval?: number | false | ((query: { state: { data?: EvolutionStatus } }) => number | false);
  enabled?: boolean;
}) {
  return useQuery<EvolutionStatus>({
    queryKey: ["evolution", "status"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/evolution/status");
      if (!res.ok) throw new Error("Erro ao buscar status Evolution");
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: options?.refetchInterval ?? false,
    enabled: options?.enabled ?? true,
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
    onSuccess: (data) => {
      // Mostra o QR imediatamente sem esperar o próximo fetch da query de QR
      queryClient.setQueryData(["evolution", "qrcode"], { qrCode: data.qrCode });
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
      queryClient.removeQueries({ queryKey: ["evolution", "qrcode"] });
      queryClient.invalidateQueries({ queryKey: ["evolution", "status"] });
    },
  });
}

export function useEvolutionQrCode(options?: {
  enabled?: boolean;
  refetchInterval?: number | false;
}) {
  return useQuery<{ qrCode: string }>({
    queryKey: ["evolution", "qrcode"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/evolution/qrcode");
      if (!res.ok) throw new Error("Erro ao carregar QR Code");
      return res.json();
    },
    // O QR do WhatsApp expira em ~20-40s; não pode ficar em cache "fresco".
    staleTime: 0,
    gcTime: 0,
    retry: false,
    enabled: options?.enabled ?? false,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

/**
 * Lista de contatos do WhatsApp conectado.
 *
 * A chave de cache é compartilhada entre o seletor de origem e o modal de import:
 * o seletor pré-carrega assim que abre, então ao escolher "Do WhatsApp conectado"
 * a lista já está em cache e aparece na hora, sem precisar clicar em "Atualizar".
 *
 * `staleTime: 0` mantém a revalidação em segundo plano a cada reabertura — o cache
 * aparece imediatamente e é substituído pelo dado fresco quando chega.
 */
export function useEvolutionContacts(options?: { enabled?: boolean }) {
  return useQuery<{ contacts: EvolutionContact[]; total: number }>({
    queryKey: ["evolution", "contacts"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/evolution/contacts");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: { message?: string } })?.error?.message ??
            "Erro ao buscar contatos WhatsApp",
        );
      }
      return res.json();
    },
    staleTime: 0,
    retry: false,
    enabled: options?.enabled ?? false,
  });
}

export function useImportContacts() {
  const queryClient = useQueryClient();
  return useMutation<
    { created: number; skipped: number; errors: string[] },
    Error,
    ImportCustomerPayload[]
  >({
    mutationFn: async (customers) => {
      const res = await fetch("/api/crm/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers }),
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
