import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prismaMock } from "@/shared/test/prisma-mock";
import { SchedulingService } from "../scheduling.service";
import { SlotUnavailableError, ValidationError } from "@/shared/errors";

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
    create: vi.fn(),
    countThisMonth: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
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
  catalogServiceRepository: { findById: vi.fn() },
}));

import { appointmentRepository } from "../appointment.repository";
import { availabilityService } from "../availability.service";
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

const mockCustomer = {
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

const mockProfessional = {
  id: "prof-1",
  tenantId: "tenant-1",
  name: "Paula",
  email: "paula@test.com",
};

const mockAppointment = {
  id: "appt-1",
  tenantId: "tenant-1",
  customerId: "cust-1",
  professionalId: "prof-1",
  serviceId: "svc-1",
  startsAt: new Date("2026-06-10T10:00:00Z"),
  endsAt: new Date("2026-06-10T11:00:00Z"),
  status: "SCHEDULED",
  notes: null,
  allowOverlap: false,
  price: 50,
  createdByUserId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: "cust-1", name: "Ana Lima", phone: "+5511999999999", email: null },
  professional: { id: "prof-1", name: "Paula", email: "paula@test.com" },
  service: { id: "svc-1", name: "Corte", duration: 60 },
};

const baseInput = {
  customerId: "cust-1",
  professionalId: "prof-1",
  serviceId: "svc-1",
  startsAt: "2026-06-10T10:00:00Z",
  notificationMessage: "",
  // Estes testes cobrem mecânica de transação/overlap, não a regra de data
  // passada (#138) — allowPastDate evita que a fixture fique frágil conforme
  // o "hoje" do calendário avança além da data fixa do mock.
  allowPastDate: true,
};

describe("SchedulingService.createAppointment — transação de disponibilidade (#138)", () => {
  let service: SchedulingService;

  beforeEach(() => {
    service = new SchedulingService();
    vi.clearAllMocks();
    vi.mocked(catalogServiceRepository.findById).mockResolvedValue(mockService as never);
    prismaMock.customer.findFirst.mockResolvedValue(mockCustomer as never);
    prismaMock.user.findFirst.mockResolvedValue(mockProfessional as never);
    prismaMock.tenant.findFirst.mockResolvedValue({ whatsappEnabled: false } as never);
    vi.mocked(appointmentRepository.findById).mockResolvedValue(mockAppointment as never);
  });

  it("executa o check de disponibilidade e o create dentro da mesma transação Serializable", async () => {
    prismaMock.$transaction.mockImplementation((fn: never) =>
      (fn as (tx: typeof prismaMock) => unknown)(prismaMock),
    );
    vi.mocked(availabilityService.ensureSlotAvailable).mockResolvedValue(undefined);
    vi.mocked(appointmentRepository.create).mockResolvedValue(mockAppointment as never);

    await service.createAppointment("tenant-1", "user-1", {
      ...baseInput,
      allowOverlap: false,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(availabilityService.ensureSlotAvailable).toHaveBeenCalledWith(
      "tenant-1",
      "prof-1",
      expect.any(Date),
      expect.any(Date),
      prismaMock,
    );
    expect(appointmentRepository.create).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ customerId: "cust-1", professionalId: "prof-1" }),
      prismaMock,
    );
  });

  it("propaga SlotUnavailableError quando o check de disponibilidade encontra conflito dentro da transação", async () => {
    prismaMock.$transaction.mockImplementation((fn: never) =>
      (fn as (tx: typeof prismaMock) => unknown)(prismaMock),
    );
    vi.mocked(availabilityService.ensureSlotAvailable).mockRejectedValue(new SlotUnavailableError());

    await expect(
      service.createAppointment("tenant-1", "user-1", { ...baseInput, allowOverlap: false }),
    ).rejects.toThrow(SlotUnavailableError);

    expect(appointmentRepository.create).not.toHaveBeenCalled();
  });

  it("converte conflito de escrita do Postgres (P2034) em SlotUnavailableError", async () => {
    const writeConflict = new Prisma.PrismaClientKnownRequestError(
      "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
      { code: "P2034", clientVersion: "test" },
    );
    prismaMock.$transaction.mockRejectedValue(writeConflict);

    await expect(
      service.createAppointment("tenant-1", "user-1", { ...baseInput, allowOverlap: false }),
    ).rejects.toThrow(SlotUnavailableError);
  });

  it("propaga erros de transação que não são conflito de disponibilidade (ex: P2002) sem mascarar", async () => {
    const otherError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    prismaMock.$transaction.mockRejectedValue(otherError);

    await expect(
      service.createAppointment("tenant-1", "user-1", { ...baseInput, allowOverlap: false }),
    ).rejects.toThrow(otherError);
  });

  it("pula o check de disponibilidade quando allowOverlap=true, mas ainda cria dentro da transação", async () => {
    prismaMock.$transaction.mockImplementation((fn: never) =>
      (fn as (tx: typeof prismaMock) => unknown)(prismaMock),
    );
    vi.mocked(appointmentRepository.create).mockResolvedValue(mockAppointment as never);

    await service.createAppointment("tenant-1", "user-1", { ...baseInput, allowOverlap: true });

    expect(availabilityService.ensureSlotAvailable).not.toHaveBeenCalled();
    expect(appointmentRepository.create).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ allowOverlap: true }),
      prismaMock,
    );
  });

  it("rejeita startsAt no passado quando allowPastDate não é informado", async () => {
    await expect(
      service.createAppointment("tenant-1", "user-1", {
        ...baseInput,
        startsAt: "2020-01-01T10:00:00Z",
        allowOverlap: false,
        allowPastDate: false,
      }),
    ).rejects.toThrow(ValidationError);

    expect(appointmentRepository.create).not.toHaveBeenCalled();
  });

  it("permite startsAt no passado quando allowPastDate=true (atendimento esquecido)", async () => {
    prismaMock.$transaction.mockImplementation((fn: never) =>
      (fn as (tx: typeof prismaMock) => unknown)(prismaMock),
    );
    vi.mocked(availabilityService.ensureSlotAvailable).mockResolvedValue(undefined);
    vi.mocked(appointmentRepository.create).mockResolvedValue(mockAppointment as never);

    await service.createAppointment("tenant-1", "user-1", {
      ...baseInput,
      startsAt: "2020-01-01T10:00:00Z",
      allowOverlap: false,
      allowPastDate: true,
    });

    expect(appointmentRepository.create).toHaveBeenCalled();
  });
});
