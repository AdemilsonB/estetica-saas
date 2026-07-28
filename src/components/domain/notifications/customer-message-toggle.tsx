"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCustomerMessagePreview } from "@/hooks/notifications/use-customer-message-preview";

type Props = {
  event: string;
  customerId?: string;
  appointmentId?: string;
  serviceId?: string;
  professionalId?: string;
  startsAt?: string;
  /** Só busca a prévia quando o formulário já tem dados suficientes. */
  enabled?: boolean;
  /** `undefined` = ainda no padrão do negócio; boolean = override explícito da ação. */
  value: boolean | undefined;
  onChange: (valor: boolean) => void;
  /** Mensagem pontual; string vazia = usa o template. */
  message: string;
  onMessageChange: (texto: string) => void;
};

export function CustomerMessageToggle({
  event,
  customerId,
  appointmentId,
  serviceId,
  professionalId,
  startsAt,
  enabled = true,
  value,
  onChange,
  message,
  onMessageChange,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [escrevendo, setEscrevendo] = useState(false);

  const { data, isLoading } = useCustomerMessagePreview(
    { event, customerId, appointmentId, serviceId, professionalId, startsAt },
    { enabled },
  );

  const bloqueado = Boolean(data?.blockedReason);
  const padrao = data?.defaultEnabled ?? true;
  // Nunca um switch ligado que não envia (spec §6.2).
  const ligado = bloqueado ? false : (value ?? padrao);

  const canalLabel = data?.primaryChannel === "EMAIL" ? "e-mail" : "WhatsApp";

  if (isLoading) {
    return <div className="h-20 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label
            htmlFor={`avisar-cliente-${event}`}
            className="flex cursor-pointer items-center gap-2 text-sm font-medium"
          >
            <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
            Avisar o cliente por {canalLabel}
          </Label>
          {bloqueado ? (
            <p className="mt-0.5 text-xs text-amber-700">{data?.blockedReason}</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Padrão do seu negócio: {padrao ? "ligado" : "desligado"}
            </p>
          )}
        </div>
        <Switch
          id={`avisar-cliente-${event}`}
          className="shrink-0"
          checked={ligado}
          disabled={bloqueado}
          onCheckedChange={onChange}
          aria-label={`Avisar o cliente por ${canalLabel}`}
        />
      </div>

      {ligado && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-auto min-h-11 px-2 text-xs text-muted-foreground"
            onClick={() => setExpandido((v) => !v)}
          >
            {expandido ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Ver a mensagem
          </Button>

          {expandido && (
            <div className="space-y-2">
              {escrevendo ? (
                <Textarea
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  placeholder="Escreva a mensagem que este cliente vai receber..."
                  className="min-h-[90px] resize-none text-sm"
                />
              ) : (
                <div className="whitespace-pre-wrap rounded-xl rounded-tl-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                  {data?.preview}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-xs"
                onClick={() => {
                  const proximo = !escrevendo;
                  setEscrevendo(proximo);
                  // Voltar ao texto padrão é limpar a mensagem pontual: o gateway
                  // só usa `message` quando ela não está vazia.
                  if (!proximo) onMessageChange("");
                }}
              >
                {escrevendo ? "Usar a mensagem padrão" : "Escrever outra mensagem"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
