"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserNotifications } from "@/hooks/notifications/use-user-notifications";
import { NotificationPanel } from "./notification-panel";

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const feed = useUserNotifications();
  const unread = feed.unreadCount > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread ? "Notificações (há novas)" : "Notificações"}
        className={cn(
          "relative inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted",
          className,
        )}
      >
        <Bell className="size-5" />
        {unread && (
          <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
        )}
      </button>
      <NotificationPanel open={open} onOpenChange={setOpen} feed={feed} />
    </>
  );
}
