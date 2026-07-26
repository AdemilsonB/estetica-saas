import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CustomerMessageTemplateItem = {
  event: string;
  channel: "WHATSAPP" | "EMAIL";
  label: string;
  description: string;
  nature: "transactional" | "promotional";
  variables: string[];
  subject: string | null;
  body: string;
  mediaUrl: string | null;
  isCustom: boolean;
  defaultBody: string;
  defaultSubject: string | null;
};

const CHAVE = ["customer-message-templates"];

export function useCustomerMessageTemplates() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<CustomerMessageTemplateItem[]> => {
      const res = await fetch("/api/notifications/customer-templates");
      if (!res.ok) throw new Error("Falha ao carregar as mensagens");
      const json = await res.json();
      return json.items;
    },
    staleTime: 60_000,
  });
}

export function useUpdateCustomerMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      event: string;
      channel: "WHATSAPP" | "EMAIL";
      subject: string | null;
      body: string;
      mediaUrl: string | null;
    }) => {
      const res = await fetch("/api/notifications/customer-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Falha ao salvar a mensagem");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}

export function useResetCustomerMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { event: string; channel: "WHATSAPP" | "EMAIL" }) => {
      const res = await fetch(
        `/api/notifications/customer-templates/${input.event}/${input.channel}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Falha ao restaurar o padrão");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}
