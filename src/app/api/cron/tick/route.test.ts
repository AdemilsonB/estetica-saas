import { describe, it, expect, beforeEach, vi } from "vitest";

const boss = {
  createQueue: vi.fn().mockResolvedValue(undefined),
  schedule: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn().mockResolvedValue([]),
  complete: vi.fn().mockResolvedValue(undefined),
  fail: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/shared/queue/pg-boss", () => ({ startPgBoss: vi.fn(async () => boss) }));
vi.mock("@/domains/notifications/scheduled-messages/scheduled-message.service", () => ({
  scheduledMessageService: { deliverDue: vi.fn() },
}));

import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";

import { GET } from "./route";

const service = vi.mocked(scheduledMessageService);

function requisicao() {
  return new Request("http://localhost/api/cron/tick") as never;
}

describe("/api/cron/tick — mensagens agendadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boss.fetch.mockResolvedValue([]);
    delete process.env.CRON_SECRET;
  });

  it("roda a varredura de mensagens agendadas e reporta o resumo", async () => {
    service.deliverDue.mockResolvedValue({ enviadas: 2, falhas: 1, expiradas: 0 });

    const res = await GET(requisicao());
    const body = await res.json();

    expect(service.deliverDue).toHaveBeenCalledTimes(1);
    expect(body.processed.scheduledMessages).toEqual({
      enviadas: 2,
      falhas: 1,
      expiradas: 0,
    });
  });

  it("falha da varredura não derruba o tick inteiro — os outros jobs seguem", async () => {
    service.deliverDue.mockRejectedValue(new Error("banco fora do ar"));

    const res = await GET(requisicao());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.processed.scheduledMessages).toEqual({
      enviadas: 0,
      falhas: 0,
      expiradas: 0,
    });
  });

  it("a varredura de mensagens agendadas roda mesmo se o pg-boss falhar ao iniciar", async () => {
    const { startPgBoss } = await import("@/shared/queue/pg-boss");
    vi.mocked(startPgBoss).mockRejectedValueOnce(new Error("pg-boss fora do ar"));
    service.deliverDue.mockResolvedValue({ enviadas: 1, falhas: 0, expiradas: 0 });

    const res = await GET(requisicao());

    expect(service.deliverDue).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(500);
  });
});
