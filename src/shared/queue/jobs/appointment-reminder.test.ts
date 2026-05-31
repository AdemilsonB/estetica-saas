import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";

// Mock singleton do boss — mesma instância retornada sempre
const bossMock = {
  send: vi.fn(),
  findJobs: vi.fn().mockResolvedValue([]),
  cancel: vi.fn(),
};

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/shared/queue/pg-boss", () => ({
  getPgBoss: () => bossMock,
}));

import { scheduleAppointmentReminder } from "./appointment-reminder";

describe("scheduleAppointmentReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bossMock.send.mockReset();
    bossMock.findJobs.mockResolvedValue([]);
  });

  it("usa reminderLeadHours do tenant para calcular sendAt", async () => {
    const startsAt = new Date(Date.now() + 50 * 3600 * 1000); // 50h no futuro
    prismaMock.tenant.findFirst.mockResolvedValue({
      reminderLeadHours: 12,
      reminderWindowStart: 7,
      reminderWindowEnd: 22,
      timezone: "America/Sao_Paulo",
    } as never);

    await scheduleAppointmentReminder("tenant1", "appt1", startsAt);

    expect(bossMock.send).toHaveBeenCalledOnce();

    const callArg = bossMock.send.mock.calls[0];
    const sentOptions = callArg[2] as { startAfter: Date };

    // sendAt base = startsAt - 12h; pode ser ajustado para dentro da janela (até +24h)
    const baseExpected = new Date(startsAt.getTime() - 12 * 3600 * 1000);
    const diff = sentOptions.startAfter.getTime() - baseExpected.getTime();

    // Deve ser >= 0 (nunca antes do base) e no máximo +24h de ajuste de janela
    expect(diff).toBeGreaterThanOrEqual(0);
    expect(diff).toBeLessThan(24 * 3600_000);

    // Confirma que usou 12h e não 24h (o padrão hardcoded anterior)
    // sendAt com 24h seria 26h antes do startsAt; com 12h é 38h antes — muito diferente
    const sendAtWith24h = new Date(startsAt.getTime() - 24 * 3600 * 1000);
    expect(Math.abs(sentOptions.startAfter.getTime() - sendAtWith24h.getTime())).toBeGreaterThan(3600_000);
  });

  it("não agenda lembrete se o sendAt já passou", async () => {
    const startsAt = new Date(Date.now() + 2 * 3600 * 1000); // 2h no futuro
    prismaMock.tenant.findFirst.mockResolvedValue({
      reminderLeadHours: 24,
      reminderWindowStart: 7,
      reminderWindowEnd: 22,
      timezone: "America/Sao_Paulo",
    } as never);

    await scheduleAppointmentReminder("tenant1", "appt1", startsAt);

    expect(bossMock.send).not.toHaveBeenCalled();
  });
});
