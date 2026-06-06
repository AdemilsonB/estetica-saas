import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { SchedulingService } from "../scheduling.service";
import { CustomerBlockedError, CustomerNotFoundError } from "@/shared/errors";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));
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
  appointmentRepository: {
    findById: vi.fn(),
    update: vi.fn(),
    countThisMonth: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
}));
vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertWithinLimit: vi.fn() },
}));
vi.mock("@/shared/queue/jobs/appointment-reminder", () => ({
  scheduleAppointmentReminder: vi.fn(),
  cancelAppointmentReminder: vi.fn(),
}));
vi.mock("../service.repository", () => ({
  catalogServiceRepository: {
    findById: vi.fn(),
  },
}));

import { catalogServiceRepository } from "../service.repository";

const mockService = {
  id: "svc-1",
  name: "Corte",
  duration: 60,
  price: 50,
  active: true,
  tenantId: "tenant-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCustomerActive = {
  id: "cust-1",
  tenantId: "tenant-1",
  name: "Ana Lima",
  phone: "+5511999999999",
  email: null,
  isBlocked: false,
  blockedReason: null,
  blockedAt: null,
  isVip: false,
  birthDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCustomerBlocked = {
  ...mockCustomerActive,
  isBlocked: true,
  blockedReason: "Não compareceu 3 vezes",
  blockedAt: new Date(),
};

const mockProfessional = {
  id: "prof-1",
  tenantId: "tenant-1",
  name: "Paula",
  email: "paula@test.com",
};

describe("SchedulingService.createAppointment — verificação de bloqueio", () => {
  let service: SchedulingService;

  beforeEach(() => {
    service = new SchedulingService();
    vi.clearAllMocks();
    vi.mocked(catalogServiceRepository.findById).mockResolvedValue(mockService as never);
    prismaMock.user.findFirst.mockResolvedValue(mockProfessional as never);
  });

  it("lança CustomerBlockedError quando cliente está bloqueado", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(mockCustomerBlocked as never);

    await expect(
      service.createAppointment("tenant-1", "user-1", {
        customerId: "cust-1",
        professionalId: "prof-1",
        serviceId: "svc-1",
        startsAt: "2026-06-10T10:00:00Z",
        notificationMessage: "",
        allowOverlap: false,
      }),
    ).rejects.toThrow(CustomerBlockedError);
  });

  it("lança CustomerBlockedError com a mensagem contendo o nome do cliente", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(mockCustomerBlocked as never);

    await expect(
      service.createAppointment("tenant-1", "user-1", {
        customerId: "cust-1",
        professionalId: "prof-1",
        serviceId: "svc-1",
        startsAt: "2026-06-10T10:00:00Z",
        notificationMessage: "",
        allowOverlap: false,
      }),
    ).rejects.toThrow(`Cliente "${mockCustomerBlocked.name}" está bloqueado`);
  });

  it("lança CustomerNotFoundError quando cliente não existe", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);

    await expect(
      service.createAppointment("tenant-1", "user-1", {
        customerId: "cust-999",
        professionalId: "prof-1",
        serviceId: "svc-1",
        startsAt: "2026-06-10T10:00:00Z",
        notificationMessage: "",
        allowOverlap: false,
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });
});
