"use client";

import { useState } from "react";
import { Settings, Check, ArrowLeft, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  filterByType,
  groupByDate,
  type TypeFilter,
} from "@/domains/notifications/user-notifications/notification-view";
import type { useUserNotifications } from "@/hooks/notifications/use-user-notifications";
import { NotificationItem } from "./notification-item";
import { NotificationPreferences } from "./notification-preferences";

const CHIPS: { key: TypeFilter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "agenda", label: "Agenda" },
  { key: "clientes", label: "Clientes" },
  { key: "aniversarios", label: "Aniversários" },
];

export function NotificationPanel({
  open,
  onOpenChange,
  feed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feed: ReturnType<typeof useUserNotifications>;
}) {
  const [filter, setFilter] = useState<TypeFilter>("todas");
  const [showPrefs, setShowPrefs] = useState(false);

  const filtered = filterByType(feed.items, filter);
  const groups = groupByDate(filtered, new Date());

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setShowPrefs(false);
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
          <div className="flex items-center gap-1">
            {showPrefs && (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 size-10"
                onClick={() => setShowPrefs(false)}
                aria-label="Voltar para notificações"
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <SheetTitle>{showPrefs ? "Preferências" : "Notificações"}</SheetTitle>
          </div>
          <div className="flex items-center gap-1">
            {!showPrefs && (
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={() => setShowPrefs(true)}
                aria-label="Preferências de notificação"
              >
                <Settings className="size-4" />
              </Button>
            )}
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="size-10" aria-label="Fechar">
                <X className="size-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {showPrefs ? (
          <NotificationPreferences prefs={feed.prefs} isManager={feed.isManager} onChange={feed.updatePrefs} />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
              {CHIPS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  className={cn(
                    "min-h-8 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filter === c.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
              <select
                value={feed.period}
                onChange={(e) => feed.setPeriod(e.target.value as "7" | "30" | "all")}
                className="rounded-md border bg-background px-2 py-1.5 text-xs"
                aria-label="Período"
              >
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="all">Tudo</option>
              </select>
              <button
                type="button"
                onClick={feed.markAllRead}
                className="flex min-h-8 items-center gap-1 text-xs font-medium text-primary"
              >
                <Check className="size-3" /> Marcar todas como lidas
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
              {feed.isLoading ? (
                <div className="space-y-2 px-3 py-2" aria-label="Carregando notificações">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-muted/60" />
                  ))}
                </div>
              ) : feed.isError ? (
                <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                  <p className="text-sm text-destructive">Não foi possível carregar suas notificações.</p>
                  <Button variant="outline" size="sm" onClick={() => feed.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : groups.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação por aqui ainda.
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.label} className="mb-3">
                    <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </p>
                    {g.items.map((n) => (
                      <NotificationItem key={n.id} notification={n} onRead={feed.markRead} />
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
