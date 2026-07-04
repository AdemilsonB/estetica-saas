"use client";

import { Switch } from "@/components/ui/switch";
import type { NotificationPrefs } from "@/domains/notifications/user-notifications/types";

export function NotificationPreferences({
  prefs,
  isManager,
  onChange,
}: {
  prefs: NotificationPrefs;
  isManager: boolean;
  onChange: (p: Partial<NotificationPrefs>) => void;
}) {
  return (
    <div className="space-y-4 px-4 py-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Receber e-mail sobre meus agendamentos (novos e cancelados)</span>
        <Switch
          checked={prefs.notifyEmailAppointments}
          onCheckedChange={(v) => onChange({ notifyEmailAppointments: v })}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Me avisar também quando eu mesmo marco um horário</span>
        <Switch
          checked={prefs.notifyOwnAppointments}
          onCheckedChange={(v) => onChange({ notifyOwnAppointments: v })}
        />
      </label>
      {isManager && (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Receber avisos de agendamentos da equipe</span>
          <Switch
            checked={prefs.notifyTeamAppointments}
            onCheckedChange={(v) => onChange({ notifyTeamAppointments: v })}
          />
        </label>
      )}
    </div>
  );
}
