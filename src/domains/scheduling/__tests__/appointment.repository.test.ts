import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AppointmentStatus } from "@prisma/client";
import { prismaMock } from "@/shared/test/prisma-mock";
import { makeAppointment } from "@/shared/test/factories/appointment.factory";
import { AppointmentRepository } from "../appointment.repository";

const repo = new AppointmentRepository();

describe("AppointmentRepository.update", () => {
  it("inclui tenantId no where e repassa notes", async () => {
    prismaMock.appointment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.appointment.findFirstOrThrow.mockResolvedValue(makeAppointment());

    await repo.update("tenant-1", "appt-1", { notes: "Aguardando pagamento" });

    expect(prismaMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: "appt-1", tenantId: "tenant-1" },
      data: { notes: "Aguardando pagamento" },
    });
  });

  it("aceita notes null para limpar a observação", async () => {
    prismaMock.appointment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.appointment.findFirstOrThrow.mockResolvedValue(makeAppointment());

    await repo.update("tenant-1", "appt-1", { notes: null });

    expect(prismaMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: "appt-1", tenantId: "tenant-1" },
      data: { notes: null },
    });
  });
});

describe("AppointmentRepository.findPendingCompletion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("filtra por tenantId, status pendente e endsAt antes do corte de graceHours", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);

    await repo.findPendingCompletion("tenant-1", 24);

    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          endsAt: { lt: new Date("2026-06-14T12:00:00Z") },
          OR: [
            { completionSnoozedUntil: null },
            { completionSnoozedUntil: { lt: new Date("2026-06-15T12:00:00Z") } },
          ],
        }),
      }),
    );
  });

  it("filtra também por professionalId quando informado", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);

    await repo.findPendingCompletion("tenant-1", 24, { professionalId: "prof-1" });

    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1", professionalId: "prof-1" }),
      }),
    );
  });
});

describe("AppointmentRepository.snoozeCompletion", () => {
  it("atualiza completionSnoozedUntil com tenantId no where", async () => {
    prismaMock.appointment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.appointment.findFirstOrThrow.mockResolvedValue(makeAppointment());
    const until = new Date("2026-06-18T12:00:00Z");

    await repo.snoozeCompletion("tenant-1", "appt-1", until);

    expect(prismaMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: "appt-1", tenantId: "tenant-1" },
      data: { completionSnoozedUntil: until },
    });
  });
});
