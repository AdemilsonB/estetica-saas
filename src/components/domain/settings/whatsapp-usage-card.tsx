"use client";

import { useWhatsAppUsage } from "@/hooks/settings/use-notification-settings";

function formatResetDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function WhatsAppUsageCard() {
  const { data, isLoading } = useWhatsAppUsage();

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!data) return null;

  const { used, limit, resetDate } = data;
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = percent >= 90;

  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-slate-700">
        Mensagens WhatsApp este mês
      </p>

      <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          <span className={isNearLimit ? "font-semibold text-red-600" : "font-semibold text-slate-700"}>
            {used.toLocaleString("pt-BR")}
          </span>{" "}
          / {limit.toLocaleString("pt-BR")} mensagens
        </span>
        <span>Renova em {formatResetDate(resetDate)}</span>
      </div>
    </div>
  );
}
