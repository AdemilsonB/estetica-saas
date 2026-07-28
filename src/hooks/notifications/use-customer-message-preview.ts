import { useQuery } from "@tanstack/react-query";

export type CustomerMessagePreview = {
  defaultEnabled: boolean;
  channels: ("WHATSAPP" | "EMAIL")[];
  primaryChannel: "WHATSAPP" | "EMAIL";
  preview: string;
  blockedReason: string | null;
};

export type CustomerMessagePreviewInput = {
  event: string;
  appointmentId?: string;
  customerId?: string;
  serviceId?: string;
  professionalId?: string;
  startsAt?: string;
};

export function useCustomerMessagePreview(
  input: CustomerMessagePreviewInput,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["customer-message-preview", input],
    queryFn: async (): Promise<CustomerMessagePreview> => {
      const res = await fetch("/api/notifications/customer-messages/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Falha ao carregar a prévia da mensagem");
      return res.json();
    },
    // Sem cliente e sem agendamento a rota devolve 422 — não vale bater.
    enabled: (options?.enabled ?? true) && Boolean(input.customerId || input.appointmentId),
    staleTime: 30_000,
    retry: false,
  });
}
