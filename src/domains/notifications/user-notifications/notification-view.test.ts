import { describe, it, expect } from "vitest";
import { filterByType, groupByDate, hasUnread, type NotificationDTO } from "./notification-view";

function item(over: Partial<NotificationDTO>): NotificationDTO {
  return { id: "x", type: "appointment_created", title: "t", body: "b", data: {}, readAt: null, createdAt: new Date().toISOString(), ...over };
}

describe("filterByType", () => {
  it("'agenda' inclui created e cancelled", () => {
    const items = [item({ type: "appointment_created" }), item({ type: "appointment_cancelled" }), item({ type: "customer_created" })];
    expect(filterByType(items, "agenda")).toHaveLength(2);
  });
  it("'clientes' inclui só customer_created", () => {
    const items = [item({ type: "customer_created" }), item({ type: "birthday_digest" })];
    expect(filterByType(items, "clientes")).toHaveLength(1);
  });
  it("'todas' retorna tudo", () => {
    const items = [item({}), item({ type: "birthday_digest" })];
    expect(filterByType(items, "todas")).toHaveLength(2);
  });
});

describe("groupByDate", () => {
  it("separa Hoje e Ontem", () => {
    const now = new Date("2026-07-04T12:00:00Z");
    const hoje = item({ createdAt: "2026-07-04T09:00:00Z" });
    const ontem = item({ createdAt: "2026-07-03T09:00:00Z" });
    const groups = groupByDate([hoje, ontem], now);
    expect(groups[0].label).toBe("Hoje");
    expect(groups[1].label).toBe("Ontem");
  });

  it("boundary: 7 dias cai em 'Esta semana', 8 dias em 'Mais antigas'", () => {
    const now = new Date("2026-07-15T12:00:00");
    const seteDias = item({ id: "7d", createdAt: "2026-07-08T09:00:00" });
    const oitoDias = item({ id: "8d", createdAt: "2026-07-07T09:00:00" });
    const groups = groupByDate([seteDias, oitoDias], now);
    const semana = groups.find((g) => g.label === "Esta semana");
    const antigas = groups.find((g) => g.label === "Mais antigas");
    expect(semana?.items.map((i) => i.id)).toEqual(["7d"]);
    expect(antigas?.items.map((i) => i.id)).toEqual(["8d"]);
  });

  it("omite grupos vazios: só 'Hoje' quando todos são de hoje", () => {
    const now = new Date("2026-07-15T12:00:00");
    const groups = groupByDate(
      [item({ createdAt: "2026-07-15T08:00:00" }), item({ createdAt: "2026-07-15T10:00:00" })],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Hoje");
  });
});

describe("hasUnread", () => {
  it("true quando há readAt null", () => {
    expect(hasUnread([item({ readAt: null })])).toBe(true);
  });
  it("false quando todas lidas", () => {
    expect(hasUnread([item({ readAt: "2026-07-04T00:00:00Z" })])).toBe(false);
  });
});
