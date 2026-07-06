import { describe, it, expect, vi, beforeEach } from "vitest";
import { SchedulingService } from "../scheduling.service";
import { PriceType } from "@prisma/client";

vi.mock("@/shared/database/prisma", () => ({
  prisma: { $transaction: vi.fn() },
}));
vi.mock("@/shared/events/event-bus", () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("../availability.service", () => ({
  availabilityService: {
    ensureSlotAvailable: vi.fn(),
    ensureSlotAvailableExcluding: vi.fn(),
  },
}));
vi.mock("../appointment.repository", () => ({
  appointmentRepository: { countThisMonth: vi.fn() },
}));
vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertWithinLimit: vi.fn() },
}));
vi.mock("@/shared/queue/jobs/appointment-reminder", () => ({
  scheduleAppointmentReminder: vi.fn(),
  cancelAppointmentReminder: vi.fn(),
}));
vi.mock("../service.repository", () => ({
  catalogServiceRepository: { count: vi.fn(), create: vi.fn() },
}));

import { catalogServiceRepository } from "../service.repository";
import { featureGuard } from "@/domains/billing/feature-guard";

const baseInput = {
  name: "Corte",
  duration: 60,
  price: 50,
  priceType: PriceType.FIXED,
  active: true,
};

describe("SchedulingService.createService — enforcement de limite de plano", () => {
  let service: SchedulingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SchedulingService();
  });

  it("conta os serviços do tenant e assevera o limite antes de criar", async () => {
    vi.mocked(catalogServiceRepository.count).mockResolvedValue(3);
    vi.mocked(featureGuard.assertWithinLimit).mockResolvedValue(undefined);
    vi.mocked(catalogServiceRepository.create).mockResolvedValue({ id: "svc-1" } as never);

    await service.createService("tenant-1", baseInput as never);

    expect(catalogServiceRepository.count).toHaveBeenCalledWith("tenant-1");
    expect(featureGuard.assertWithinLimit).toHaveBeenCalledWith("tenant-1", "services", 3);
    expect(catalogServiceRepository.create).toHaveBeenCalled();
  });

  it("propaga o erro do featureGuard e não cria o serviço quando o limite é excedido", async () => {
    vi.mocked(catalogServiceRepository.count).mockResolvedValue(10);
    vi.mocked(featureGuard.assertWithinLimit).mockRejectedValue(new Error("Limite atingido"));

    await expect(
      service.createService("tenant-1", baseInput as never),
    ).rejects.toThrow("Limite atingido");

    expect(catalogServiceRepository.create).not.toHaveBeenCalled();
  });
});
