import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CustomerMessageSettingItem = {
  event: string;
  label: string;
  description: string;
  nature: "transactional" | "promotional";
  enabled: boolean;
  channels: ("WHATSAPP" | "EMAIL")[];
  isCustom: boolean;
};

const CHAVE = ["customer-message-settings"];

export function useCustomerMessageSettings() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<CustomerMessageSettingItem[]> => {
      const res = await fetch("/api/notifications/customer-messages/settings");
      if (!res.ok) throw new Error("Falha ao carregar os avisos ao cliente");
      const json = await res.json();
      return json.items;
    },
    staleTime: 60_000,
  });
}

export function useUpdateCustomerMessageSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      event: string;
      enabled: boolean;
      channels: ("WHATSAPP" | "EMAIL")[];
    }) => {
      const res = await fetch("/api/notifications/customer-messages/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Falha ao salvar o aviso");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE });
      // A prévia dos modais lê o mesmo padrão — invalidar para não mostrar o estado velho.
      qc.invalidateQueries({ queryKey: ["customer-message-preview"] });
    },
  });
}
