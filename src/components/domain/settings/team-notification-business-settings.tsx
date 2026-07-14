"use client";

import { toast } from "sonner";
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  useTeamNotificationSettings,
  useUpdateTeamNotificationSetting,
  type BusinessEventSetting,
} from "@/hooks/settings/use-team-notification-settings";

export function TeamNotificationBusinessSettings({
  onEditTemplate,
}: {
  onEditTemplate: (eventType: NotificationEventType, channel: TeamNotificationChannel) => void;
}) {
  const { data: settings, isLoading } = useTeamNotificationSettings();
  const update = useUpdateTeamNotificationSetting();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!settings || settings.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum aviso configurável no momento.</p>;
  }

  function toggleEnabled(item: BusinessEventSetting, enabled: boolean) {
    update.mutate(
      { eventType: item.eventType, enabled, defaultChannels: item.defaultChannels },
      { onSuccess: () => toast.success("Aviso atualizado"), onError: () => toast.error("Erro ao salvar") },
    );
  }

  function toggleChannel(item: BusinessEventSetting, channel: TeamNotificationChannel, checked: boolean) {
    const next = checked
      ? [...item.defaultChannels, channel]
      : item.defaultChannels.filter((c) => c !== channel);
    update.mutate(
      { eventType: item.eventType, enabled: item.enabled, defaultChannels: next },
      { onSuccess: () => toast.success("Canais atualizados"), onError: () => toast.error("Erro ao salvar") },
    );
  }

  return (
    <div className="space-y-3">
      {settings.map((item) => (
        <div
          key={item.eventType}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Switch
              className="shrink-0"
              checked={item.enabled}
              onCheckedChange={(v) => toggleEnabled(item, v)}
              aria-label={`Ativar ${item.label}`}
            />
          </div>

          {item.enabled && (
            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
              <span className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                🔔 In-app <span className="text-xs">(sempre)</span>
              </span>
              {item.supportsEmail && (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.defaultChannels.includes("EMAIL")}
                    onCheckedChange={(v) => toggleChannel(item, "EMAIL", v === true)}
                  />
                  ✉️ E-mail
                </label>
              )}
              <Button
                variant="outline"
                size="sm"
                className="ml-auto min-h-11"
                onClick={() => onEditTemplate(item.eventType, item.defaultChannels.includes("EMAIL") ? "EMAIL" : "IN_APP")}
              >
                Editar mensagem
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
