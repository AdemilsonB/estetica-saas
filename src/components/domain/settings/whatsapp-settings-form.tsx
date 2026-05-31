"use client";

import { useState } from "react";
import { MessageCircle, Lock, Send, CheckCircle2 } from "lucide-react";
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
  useBulkReminder,
} from "@/hooks/settings/use-notification-settings";
import { WhatsAppUsageCard } from "./whatsapp-usage-card";
import { WhatsAppTemplateEditor } from "./whatsapp-template-editor";

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

const LEAD_HOURS_OPTIONS = [
  { value: "2",  label: "2 horas antes" },
  { value: "4",  label: "4 horas antes" },
  { value: "8",  label: "8 horas antes" },
  { value: "12", label: "12 horas antes" },
  { value: "24", label: "24 horas antes (padrão)" },
  { value: "48", label: "48 horas antes" },
];

const WINDOW_HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, "0")}:00`,
}));

export function WhatsAppSettingsForm() {
  const { data, isLoading } = useNotificationSettings();
  const { mutate, isPending } = useUpdateNotificationSettings();
  const { mutate: sendBulk, isPending: isSending, data: bulkResult } = useBulkReminder();
  const [bulkSent, setBulkSent] = useState(false);

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

  function handleBulkSend() {
    sendBulk(undefined, {
      onSuccess: () => setBulkSent(true),
    });
  }

  return (
    <div className="space-y-6">
      {/* Toggle WhatsApp */}
      <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/85 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <p className="font-medium text-slate-950">Notificações WhatsApp</p>
            <p className="text-xs text-slate-500">Confirmações e lembretes automáticos via Twilio</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
            {isEnabled ? "Ativo" : "Inativo"}
          </Badge>
          <Button
            variant={isEnabled ? "destructive" : "default"}
            size="sm"
            onClick={() => mutate({ whatsappEnabled: !isEnabled })}
            disabled={isPending}
          >
            {isEnabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>

      {isEnabled && (
        <>
          <WhatsAppUsageCard />

          {/* Lembrete bulk */}
          <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/85 px-5 py-4 shadow-sm">
            <div>
              <p className="font-medium text-slate-950">Lembretes de hoje</p>
              <p className="text-xs text-slate-500">
                Envia lembrete agora para todos os agendamentos de hoje que ainda não foram cancelados.
              </p>
              {bulkSent && bulkResult && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="size-3" />
                  {bulkResult.sent} lembrete{bulkResult.sent !== 1 ? "s" : ""} enviado{bulkResult.sent !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkSend}
              disabled={isSending}
              className="gap-2"
            >
              <Send className="size-4" />
              {isSending ? "Enviando..." : "Enviar agora"}
            </Button>
          </div>

          {/* Config de lembrete */}
          <div className="space-y-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Configuração do lembrete automático</p>

            <div className="space-y-2">
              <Label>Quando enviar o lembrete</Label>
              <Select
                value={String(data?.reminderLeadHours ?? 24)}
                onValueChange={(v) => mutate({ reminderLeadHours: parseInt(v) })}
                disabled={isPending}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_HOURS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Não enviar antes de</Label>
                <Select
                  value={String(data?.reminderWindowStart ?? 7)}
                  onValueChange={(v) => mutate({ reminderWindowStart: parseInt(v) })}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_HOURS.slice(0, 12).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Não enviar depois de</Label>
                <Select
                  value={String(data?.reminderWindowEnd ?? 22)}
                  onValueChange={(v) => mutate({ reminderWindowEnd: parseInt(v) })}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_HOURS.slice(12).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              O lembrete será ajustado para ficar dentro da janela configurada.
            </p>
          </div>

          <WhatsAppTemplateEditor />
        </>
      )}

      {/* Fuso horário */}
      <div className="space-y-2">
        <Label htmlFor="timezone">Fuso horário do negócio</Label>
        <Select
          value={data?.timezone ?? "America/Sao_Paulo"}
          onValueChange={(v) => mutate({ timezone: v })}
          disabled={isPending}
        >
          <SelectTrigger id="timezone" className="w-full sm:w-72">
            <SelectValue placeholder="Selecione o fuso horário" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
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
