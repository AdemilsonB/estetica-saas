"use client";

import { MessageCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from "@/hooks/settings/use-notification-settings";

const TIMEZONES = [
  { value: "America/Sao_Paulo",   label: "Brasília (UTC-3)" },
  { value: "America/Manaus",      label: "Manaus (UTC-4)" },
  { value: "America/Belem",       label: "Belém (UTC-3)" },
  { value: "America/Fortaleza",   label: "Fortaleza (UTC-3)" },
  { value: "America/Recife",      label: "Recife (UTC-3)" },
  { value: "America/Maceio",      label: "Maceió (UTC-3)" },
  { value: "America/Bahia",       label: "Salvador (UTC-3)" },
  { value: "America/Porto_Velho", label: "Porto Velho (UTC-4)" },
  { value: "America/Boa_Vista",   label: "Boa Vista (UTC-4)" },
  { value: "America/Rio_Branco",  label: "Rio Branco (UTC-5)" },
  { value: "America/Noronha",     label: "Fernando de Noronha (UTC-2)" },
];

export function WhatsAppSettingsForm() {
  const { data, isLoading } = useNotificationSettings();
  const { mutate, isPending } = useUpdateNotificationSettings();

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />;
  }

  const isFree = data?.plan === "FREE";
  const isEnabled = data?.whatsappEnabled ?? false;

  if (isFree) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <Lock className="mt-0.5 size-5 shrink-0 text-slate-400" />
        <div>
          <p className="font-medium text-slate-700">WhatsApp não disponível no plano Free</p>
          <p className="mt-1 text-sm text-slate-500">
            Faça upgrade para o plano Starter ou superior para ativar notificações automáticas via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  function handleToggle() {
    mutate({ whatsappEnabled: !isEnabled });
  }

  function handleTimezoneChange(value: string) {
    mutate({ timezone: value });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/85 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <p className="font-medium text-slate-950">Notificações WhatsApp</p>
            <p className="text-xs text-slate-500">
              Confirmações e lembretes automáticos via Twilio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            className={
              isEnabled
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }
          >
            {isEnabled ? "Ativo" : "Inativo"}
          </Badge>
          <Button
            variant={isEnabled ? "destructive" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={isPending}
          >
            {isEnabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Fuso horário do negócio</Label>
        <Select
          value={data?.timezone ?? "America/Sao_Paulo"}
          onValueChange={handleTimezoneChange}
          disabled={isPending}
        >
          <SelectTrigger id="timezone" className="w-full sm:w-72">
            <SelectValue placeholder="Selecione o fuso horário" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-400">
          Usado para formatar datas e horários nas mensagens enviadas ao cliente.
        </p>
      </div>
    </div>
  );
}
