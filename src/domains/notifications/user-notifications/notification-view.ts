import type { UserNotificationType } from "./types";

export type NotificationDTO = {
  id: string;
  type: UserNotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type TypeFilter = "todas" | "agenda" | "clientes" | "aniversarios";

const TYPE_MAP: Record<Exclude<TypeFilter, "todas">, UserNotificationType[]> = {
  agenda: ["appointment_created", "appointment_cancelled", "appointment_rescheduled", "appointment_no_show"],
  clientes: ["customer_created"],
  aniversarios: ["birthday_digest"],
};

export function filterByType(items: NotificationDTO[], filter: TypeFilter): NotificationDTO[] {
  if (filter === "todas") return items;
  const allowed = TYPE_MAP[filter];
  return items.filter((i) => allowed.includes(i.type));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function groupByDate(
  items: NotificationDTO[],
  now: Date,
): { label: string; items: NotificationDTO[] }[] {
  const today = startOfDay(now).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const buckets: Record<string, NotificationDTO[]> = {
    Hoje: [],
    Ontem: [],
    "Esta semana": [],
    "Mais antigas": [],
  };

  for (const it of items) {
    const created = startOfDay(new Date(it.createdAt)).getTime();
    const diffDays = Math.round((today - created) / oneDay);
    if (diffDays <= 0) buckets["Hoje"].push(it);
    else if (diffDays === 1) buckets["Ontem"].push(it);
    else if (diffDays <= 7) buckets["Esta semana"].push(it);
    else buckets["Mais antigas"].push(it);
  }

  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}

export function hasUnread(items: NotificationDTO[]): boolean {
  return items.some((i) => i.readAt === null);
}
