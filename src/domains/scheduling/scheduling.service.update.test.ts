import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppointmentStatus } from "@prisma/client";
import { prismaMock } from "@/shared/test/prisma-mock";
import { eventBus } from "@/shared/events/event-bus";
import { SchedulingService } from "./scheduling.service";
import { AppointmentNotFoundError, AppointmentAlreadyCancelledError, SlotUnavailableError } from "@/shared/errors";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/shared/events/event-bus", () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("./availability.service", () => ({
  availabilityService: {
    ensureSlotAvailable: vi.fn(),
    ensureSlotAvailableExcluding: vi.fn(),
  },
}));
vi.mock("./appointment.repository", () => ({
  appointmentRepository: {
    findById: vi.fn(),
    update: vi.fn(),
    countThisMonth: vi.fn(),
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

import { appointmentRepository } from "./appointment.repository";
import { availabilityService } from "./availability.service";

const mockAppointment = {
  id: "appt-1",
  tenantId: "tenant-1",
  customerId: "cust-1",
  professionalId: "prof-1",
  serviceId: "svc-1",
  startsAt: new Date("2026-06-10T10:00:00Z"),
  endsAt: new Date("2026-06-10T11:00:00Z"),
  status: AppointmentStatus.SCHEDULED,
  notes: null,
  allowOverlap: false,
  price: 100,
  createdByUserId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: "cust-1", name: "Ana Lima", phone: "+5511999999999", email: null },
  professional: { id: "prof-1", name: "Paula", email: "paula@test.com" },
  service: { id: "svc-1", name: "Corte", duration: 60 },
};

describe("SchedulingService.updateAppointment", () => {
  let service: SchedulingService;

  beforeEach(() => {
    service = new SchedulingService();
    vi.clearAllMocks();
  });

  it("lança AppointmentNotFoundError quando agendamento não existe", async () => {
    vi.mocked(appointmentRepository.findById).mockResolvedValue(null);

    await expect(
      service.updateAppointment("tenant-1", "appt-999", {
        startsAt: "2026-06-11T10:00:00Z",
        endsAt: "2026-06-11T11:00:00Z",
        notificationMessage: "Olá, remarcamos!",
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it("lança AppointmentAlreadyCancelledError quando status é CANCELLED", async () => {
    vi.mocked(appointmentRepository.findById).mockResolvedValue({
      ...mockAppointment,
      status: AppointmentStatus.CANCELLED,
    } as never);

    await expect(
      service.updateAppointment("tenant-1", "appt-1", {
        startsAt: "2026-06-11T10:00:00Z",
        endsAt: "2026-06-11T11:00:00Z",
        notificationMessage: "Olá!",
      }),
    ).rejects.toThrow(AppointmentAlreadyCancelledError);
  });

  it("lança AppointmentAlreadyCancelledError quando status é COMPLETED", async () => {
    vi.mocked(appointmentRepository.findById).mockResolvedValue({
      ...mockAppointment,
      status: AppointmentStatus.COMPLETED,
    } as never);

    await expect(
      service.updateAppointment("tenant-1", "appt-1", {
        startsAt: "2026-06-11T10:00:00Z",
        endsAt: "2026-06-11T11:00:00Z",
        notificationMessage: "Olá!",
      }),
    ).rejects.toThrow(AppointmentAlreadyCancelledError);
  });

  it("lança AppointmentAlreadyCancelledError quando status é NO_SHOW", async () => {
    vi.mocked(appointmentRepository.findById).mockResolvedValue({
      ...mockAppointment,
      status: AppointmentStatus.NO_SHOW,
    } as never);

    await expect(
      service.updateAppointment("tenant-1", "appt-1", {
        startsAt: "2026-06-11T10:00:00Z",
        endsAt: "2026-06-11T11:00:00Z",
        notificationMessage: "Olá!",
      }),
    ).rejects.toThrow(AppointmentAlreadyCancelledError);
  });

  it("lança SlotUnavailableError quando novo horário está ocupado", async () => {
    vi.mocked(appointmentRepository.findById).mockResolvedValue(mockAppointment as never);
    vi.mocked(availabilityService.ensureSlotAvailableExcluding).mockRejectedValue(
      new SlotUnavailableError(),
    );

    await expect(
      service.updateAppointment("tenant-1", "appt-1", {
        startsAt: "2026-06-11T10:00:00Z",
        endsAt: "2026-06-11T11:00:00Z",
        notificationMessage: "Olá!",
      }),
    ).rejects.toThrow(SlotUnavailableError);
  });

  it("atualiza agendamento e publica evento scheduling.appointment.rescheduled", async () => {
    const updated = { ...mockAppointment, startsAt: new Date("2026-06-11T10:00:00Z") };
    vi.mocked(appointmentRepository.findById).mockResolvedValue(mockAppointment as never);
    vi.mocked(availabilityService.ensureSlotAvailableExcluding).mockResolvedValue();
    vi.mocked(appointmentRepository.update).mockResolvedValue(updated as never);

    await service.updateAppointment("tenant-1", "appt-1", {
      startsAt: "2026-06-11T10:00:00Z",
      endsAt: "2026-06-11T11:00:00Z",
      notificationMessage: "Olá, Ana! Seu agendamento foi remarcado.",
    });

    expect(appointmentRepository.update).toHaveBeenCalledWith(
      "tenant-1",
      "appt-1",
      expect.objectContaining({ startsAt: new Date("2026-06-11T10:00:00Z") }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "scheduling.appointment.rescheduled" }),
    );
  });
});

describe("SchedulingService.updateAppointmentStatus com confirmedPrice", () => {
  let service: SchedulingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SchedulingService();
    vi.mocked(appointmentRepository.findById)
      .mockResolvedValueOnce(mockAppointment as any) // current
      .mockResolvedValueOnce({ ...mockAppointment, status: AppointmentStatus.CONFIRMED, confirmedPrice: 95 } as any); // after update
    vi.mocked(appointmentRepository.updateStatus).mockResolvedValue({
      ...mockAppointment,
      status: AppointmentStatus.CONFIRMED,
    } as any);
  });

  it("chama updateStatus com confirmedPrice quando fornecido", async () => {
    await service.updateAppointmentStatus("tenant-1", "appt-1", {
      status: AppointmentStatus.CONFIRMED,
      confirmedPrice: 95,
    });

    expect(appointmentRepository.updateStatus).toHaveBeenCalledWith(
      "tenant-1",
      "appt-1",
      AppointmentStatus.CONFIRMED,
      95,
    );
  });

  it("publica evento com notificationMessage ao confirmar", async () => {
    await service.updateAppointmentStatus("tenant-1", "appt-1", {
      status: AppointmentStatus.CONFIRMED,
      notificationMessage: "Olá! Confirmado.",
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ notificationMessage: "Olá! Confirmado." }),
      }),
    );
  });
});
