"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { NotificationEventType } from "@prisma/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useMyTeamNotificationPreferences,
  useUpdateMyTeamNotificationPreferences,
} from "@/hooks/settings/use-team-notification-preferences";
import { useTeamNotificationSettings } from "@/hooks/settings/use-team-notification-settings";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

export function TeamNotificationMyPreferences() {
  const { data: prefs, isLoading: prefsLoading } = useMyTeamNotificationPreferences();
  const { data: businessSettings, isLoading: settingsLoading } = useTeamNotificationSettings();
  const update = useUpdateMyTeamNotificationPreferences();

  const [deliveryMode, setDeliveryMode] = useState("realtime");
  const [quietStart, setQuietStart] = useState<string>("");
  const [quietEnd, setQuietEnd] = useState<string>("");
  const [notifyOwn, setNotifyOwn] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (prefs) {
      setDeliveryMode(prefs.notificationDeliveryMode);
      setQuietStart(prefs.quietHoursStart !== null ? String(prefs.quietHoursStart).padStart(2, "0") : "");
      setQuietEnd(prefs.quietHoursEnd !== null ? String(prefs.quietHoursEnd).padStart(2, "0") : "");
      setNotifyOwn(prefs.notifyOwnAppointments);
      setOverrides(Object.fromEntries((prefs.emailOverrides ?? []).map((o) => [o.eventType, o.enabled])));
    }
  }, [prefs]);

  if (prefsLoading || settingsLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
      </div>
    );
  }

  const enabledEvents = (businessSettings ?? []).filter((s) => s.enabled && s.supportsEmail && s.defaultChannels.includes("EMAIL"));

  function saveDeliveryMode(mode: string) {
    const previousMode = deliveryMode;
    setDeliveryMode(mode);
    update.mutate(
      { notificationDeliveryMode: mode },
      {
        onSuccess: () => toast.success("Modo atualizado"),
        onError: () => {
          setDeliveryMode(previousMode);
          toast.error("Erro ao salvar");
        },
      },
    );
  }

  function saveQuietHours(startStr: string, endStr: string) {
    setQuietStart(startStr);
    setQuietEnd(endStr);
    const start = startStr === "" ? null : parseInt(startStr, 10);
    const end = endStr === "" ? null : parseInt(endStr, 10);
    update.mutate(
      { quietHoursStart: start, quietHoursEnd: end },
      { onSuccess: () => toast.success("Silêncio atualizado"), onError: () => toast.error("Erro ao salvar") },
    );
  }

  function saveNotifyOwn(enabled: boolean) {
    const previous = notifyOwn;
    setNotifyOwn(enabled);
    update.mutate(
      { notifyOwnAppointments: enabled },
      {
        onSuccess: () => toast.success("Preferência atualizada"),
        onError: () => {
          setNotifyOwn(previous);
          toast.error("Erro ao salvar");
        },
      },
    );
  }

  function toggleEventEmail(eventType: NotificationEventType, enabled: boolean) {
    setOverrides((prev) => ({ ...prev, [eventType]: enabled }));
    update.mutate(
      { emailOverrides: [{ eventType, enabled }] },
      { onSuccess: () => toast.success("Preferência atualizada"), onError: () => toast.error("Erro ao salvar") },
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Modo de entrega por e-mail</p>
        <div className="flex gap-2">
          {(["realtime", "digest"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => saveDeliveryMode(mode)}
              className={cn(
                "min-h-11 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors",
                deliveryMode === mode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {mode === "realtime" ? "Tempo real" : "Resumo diário"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Silêncio (sem e-mail neste horário)</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">De</Label>
            <select
              id="quiet-start"
              value={quietStart}
              onChange={(e) => saveQuietHours(e.target.value, quietEnd)}
              className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {HOURS.map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">até</Label>
            <select
              id="quiet-end"
              value={quietEnd}
              onChange={(e) => saveQuietHours(quietStart, e.target.value)}
              className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {HOURS.map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O sino continua funcionando normalmente — o silêncio afeta só o e-mail.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Meus próprios agendamentos</p>
          <p className="text-xs text-muted-foreground">
            Me avisar (sino e e-mail) também quando eu mesmo crio um agendamento
          </p>
        </div>
        <Switch
          checked={notifyOwn}
          onCheckedChange={saveNotifyOwn}
          aria-label="Notificar quando eu mesmo crio o agendamento"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Meus avisos</p>
        {enabledEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum aviso com e-mail habilitado pelo negócio no momento.</p>
        ) : (
          enabledEvents.map((event) => (
            <div key={event.eventType} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <p className="text-xs text-muted-foreground">🔔 in-app sempre ativo · ✉️ e-mail abaixo</p>
              </div>
              <Switch
                checked={overrides[event.eventType] ?? true}
                onCheckedChange={(v) => toggleEventEmail(event.eventType, v)}
                aria-label={`E-mail de ${event.label}`}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
