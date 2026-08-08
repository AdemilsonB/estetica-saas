"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  useCustomerMessageSettings,
  useUpdateCustomerMessageSetting,
  type CustomerMessageSettingItem,
} from "@/hooks/settings/use-customer-message-settings";

type Canal = "WHATSAPP" | "EMAIL";

type Props = {
  onEditTemplate: (event: string, channel: Canal) => void;
};

export function CustomerMessageSettingsMatrix({ onEditTemplate }: Props) {
  const { data: itens, isLoading, isError } = useCustomerMessageSettings();
  const update = useUpdateCustomerMessageSetting();

  function salvar(item: CustomerMessageSettingItem, enabled: boolean, channels: Canal[]) {
    update.mutate(
      { event: item.event, enabled, channels },
      {
        onSuccess: () => toast.success("Aviso ao cliente atualizado"),
        onError: () => toast.error("Não foi possível salvar. Tente de novo."),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Não foi possível carregar os avisos ao cliente.
      </p>
    );
  }

  if (!itens || itens.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum aviso configurável no momento.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Estes são os padrões do seu negócio. Em cada agendamento você ainda pode decidir
        avisar ou não aquele cliente, sem mudar o padrão.
      </p>

      {itens.map((item) => {
        const canais = item.channels;
        const alternarCanal = (canal: Canal, marcado: boolean) => {
          // Preserva a ordem WHATSAPP → EMAIL, para o estado salvo ser estável.
          const proximos = (["WHATSAPP", "EMAIL"] as Canal[]).filter((c) =>
            c === canal ? marcado : canais.includes(c),
          );
          salvar(item, item.enabled, proximos);
        };

        return (
          <div
            key={item.event}
            data-testid={`mensagem-cliente-${item.event}`}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {item.nature === "promotional" && <Badge variant="outline">Promocional</Badge>}
                  {item.status === "soon" && (
                    <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
                      Em breve
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                {item.status === "soon" && (
                  <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Ainda não é enviada automaticamente. Vamos avisar quando estiver pronta.
                  </p>
                )}
              </div>
              {/* Wrapper com min-h-11: o primitivo `Switch` (h-[18.4px] + hit-slop de 8px por lado
                  via `after:-inset-y-2`) fica com ~34.4px de alvo efetivo, abaixo dos 44px exigidos.
                  Corrigido só aqui — mexer no primitivo afetaria todo o design system (mesmo gap
                  já existe em `team-notification-business-settings.tsx`, fora do escopo desta task). */}
              <div className="flex min-h-11 shrink-0 items-center">
                <Switch
                  checked={item.status === "soon" ? false : item.enabled}
                  disabled={update.isPending || item.status === "soon"}
                  onCheckedChange={(v) => salvar(item, v, canais)}
                  aria-label={`Avisar o cliente: ${item.label}`}
                />
              </div>
            </div>

            {item.enabled && (
              <div className="flex flex-col gap-3 border-t border-border pt-3 md:flex-row md:items-center md:gap-4">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={canais.includes("WHATSAPP")}
                    disabled={update.isPending}
                    onCheckedChange={(v) => alternarCanal("WHATSAPP", v === true)}
                    aria-label="Canal WhatsApp"
                  />
                  WhatsApp
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={canais.includes("EMAIL")}
                    disabled={update.isPending}
                    onCheckedChange={(v) => alternarCanal("EMAIL", v === true)}
                    aria-label="Canal e-mail"
                  />
                  E-mail
                </label>

                <div className="flex flex-wrap gap-2 md:ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => onEditTemplate(item.event, "WHATSAPP")}
                  >
                    Editar WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => onEditTemplate(item.event, "EMAIL")}
                  >
                    Editar e-mail
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
