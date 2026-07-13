"use client";

import { useState } from "react";
import { Calendar, CalendarX, CalendarClock, UserPlus, UserX, Cake } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/domains/notifications/user-notifications/notification-view";

const ICON = {
  appointment_created: Calendar,
  appointment_cancelled: CalendarX,
  appointment_rescheduled: CalendarClock,
  appointment_no_show: UserX,
  customer_created: UserPlus,
  birthday_digest: Cake,
} as const;

const ICON_COLOR = {
  appointment_created: "text-violet-600",
  appointment_cancelled: "text-red-600",
  appointment_rescheduled: "text-blue-600",
  appointment_no_show: "text-orange-600",
  customer_created: "text-emerald-600",
  birthday_digest: "text-pink-600",
} as const;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationItem({
  notification,
  onRead,
}: {
  notification: NotificationDTO;
  onRead: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON[notification.type];
  const unread = notification.readAt === null;
  const appointmentId =
    typeof notification.data.appointmentId === "string" ? notification.data.appointmentId : null;
  const customerId =
    typeof notification.data.customerId === "string" ? notification.data.customerId : null;

  function toggle() {
    setExpanded((v) => !v);
    if (unread) onRead(notification.id);
  }

  return (
    <div
      className={cn(
        "flex min-h-11 flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors",
        unread ? "bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <button type="button" onClick={toggle} className="flex w-full flex-col gap-1 text-left">
        <div className="flex items-center gap-2.5">
          {unread && <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="Não lida" />}
          <Icon className={cn("size-4 shrink-0", ICON_COLOR[notification.type])} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {notification.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(notification.createdAt)}</span>
        </div>
        <p className={cn("pl-9 text-xs text-muted-foreground", expanded ? "" : "line-clamp-1")}>
          {notification.body}
        </p>
      </button>
      {expanded && appointmentId && (
        <Link href="/agenda" className="pl-9 text-xs font-medium text-primary hover:underline">
          Ver na agenda →
        </Link>
      )}
      {expanded && customerId && (
        <Link href={`/clientes/${customerId}`} className="pl-9 text-xs font-medium text-primary hover:underline">
          Ver cliente →
        </Link>
      )}
    </div>
  );
}
