import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ScheduledMessageStatus =
  | "PENDING"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "CANCELLED";

export type ScheduledMessageItem = {
  id: string;
  body: string;
  /** Instante em UTC. Serve para ordenar; NUNCA para exibir nem para preencher o form. */
  scheduledAt: string;
  /** `YYYY-MM-DD` no fuso do tenant, calculado no servidor. É o que a tela mostra. */
  scheduledDate: string;
  /** `HH:mm` no fuso do tenant, calculado no servidor. */
  scheduledTime: string;
  status: ScheduledMessageStatus;
  sentAt: string | null;
  failureReason: string | null;
  createdByUser: { id: string; name: string };
};

export type ScheduledMessageOptions = {
  templates: { event: string; label: string; body: string }[];
  variables: string[];
};

export type ScheduledMessageFormInput = {
  body: string;
  date: string;
  time: string;
};

const BASE = "/api/notifications/scheduled-messages";

/** Extrai a mensagem do erro tipado da API; sem ela, o usuário só veria "erro". */
async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(corpo?.error?.message ?? "Nao foi possivel completar a operacao.");
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function chaveDaLista(customerId: string) {
  return ["scheduled-messages", customerId] as const;
}

export function useScheduledMessages(customerId: string) {
  return useQuery({
    queryKey: chaveDaLista(customerId),
    queryFn: async () => {
      const { items } = await pedir<{ items: ScheduledMessageItem[] }>(
        `${BASE}?customerId=${encodeURIComponent(customerId)}`,
      );
      return items;
    },
    enabled: Boolean(customerId),
  });
}

/** Templates e variáveis mudam pouco: vale segurar por bastante tempo. */
export function useScheduledMessageOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["scheduled-message-options"],
    queryFn: () => pedir<ScheduledMessageOptions>(`${BASE}/options`),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useScheduledMessagePreview(
  input: { customerId: string; body: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["scheduled-message-preview", input.customerId, input.body],
    queryFn: () =>
      pedir<{ preview: string; blockedReason: string | null }>(`${BASE}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    enabled: enabled && Boolean(input.customerId),
    // A prévia acompanha a digitação; sem isso, cada tecla dispararia uma requisição nova.
    staleTime: 10_000,
    retry: false,
  });
}

export function useCreateScheduledMessage(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ScheduledMessageFormInput) =>
      pedir<ScheduledMessageItem>(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, ...input }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveDaLista(customerId) });
    },
  });
}

export function useUpdateScheduledMessage(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: ScheduledMessageFormInput & { id: string }) =>
      pedir<void>(`${BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveDaLista(customerId) });
    },
  });
}

export function useCancelScheduledMessage(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pedir<void>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveDaLista(customerId) });
    },
  });
}
