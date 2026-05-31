"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotificationLog } from "@/hooks/settings/use-notification-settings";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TEMPLATE_LABELS: Record<string, string> = {
  "appointment-created":   "Confirmação",
  "appointment-confirmed": "Confirmado",
  "appointment-reminder":  "Lembrete",
  "appointment-cancelled": "Cancelamento",
  "appointment-no-show":   "Não compareceu",
  "birthday":              "Aniversário",
};

const STATUS_BADGE: Record<string, string> = {
  SENT:    "bg-emerald-100 text-emerald-700",
  FAILED:  "bg-red-100 text-red-700",
  PENDING: "bg-slate-100 text-slate-500",
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export function NotificationHistory() {
  const [page, setPage] = useState(1);
  const [template, setTemplate] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();

  const { data, isLoading } = useNotificationLog({ page, template, status });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">Histórico de notificações</p>

      <div className="flex gap-2">
        <Select
          value={template ?? "all"}
          onValueChange={(v) => { setTemplate(v === "all" ? undefined : v); setPage(1); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status ?? "all"}
          onValueChange={(v) => { setStatus(v === "all" ? undefined : v); setPage(1); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="SENT">Enviado</SelectItem>
            <SelectItem value="FAILED">Falhou</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : !data?.data.length ? (
        <p className="py-8 text-center text-sm text-slate-400">Nenhuma notificação encontrada.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {data.data.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-800">
                  {TEMPLATE_LABELS[entry.template] ?? entry.template}
                </p>
                <p className="text-xs text-slate-400">{entry.recipient} · {fmt(entry.createdAt)}</p>
                {entry.errorMessage && (
                  <p className="text-xs text-red-500">{entry.errorMessage}</p>
                )}
              </div>
              <Badge className={STATUS_BADGE[entry.status] ?? "bg-slate-100 text-slate-500"}>
                {entry.status === "SENT" ? "Enviado" : entry.status === "FAILED" ? "Falhou" : "Pendente"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            {data?.total} resultado{(data?.total ?? 0) !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="flex items-center px-3 text-xs text-slate-600">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
