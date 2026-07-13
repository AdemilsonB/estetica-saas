import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamNotificationDispatcherService } from "./team-notification-dispatcher.service";

const userNotifRepo = {
  createMany: vi.fn(),
  findManagers: vi.fn(),
  findRecipientContext: vi.fn(),
  findTenantTimezone: vi.fn(),
  findAppointmentForNotification: vi.fn(),
};
const settingRepo = { findByTenant: vi.fn() };
const prefRepo = { findEmailOverridesForUsers: vi.fn() };

const bossSend = vi.fn();
vi.mock("@/shared/queue/pg-boss", () => ({
  startPgBoss: () => Promise.resolve({ send: bossSend }),
}));

function makePayload(over: Partial<{ createdByUserId: string | null; profId: string; profEmail: string; origin: "panel" | "public" }> = {}) {
  return {
    tenantId: "t1",
    appointment: { id: "a1", createdByUserId: over.createdByUserId ?? null, startsAt: new Date("2026-07-13T18:00:00Z"), packageId: null },
    customer: { id: "c1", name: "Maria" },
    service: { id: "s1", name: "Corte" },
    professional: { id: over.profId ?? "prof1", name: "Ana", email: over.profEmail ?? "ana@x.com" },
    origin: over.origin ?? "panel",
  } as never;
}

describe("TeamNotificationDispatcherService.dispatchAppointmentEvent", () => {
  let dispatcher: TeamNotificationDispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new TeamNotificationDispatcherService(userNotifRepo as never, settingRepo as never, prefRepo as never);
    userNotifRepo.findManagers.mockResolvedValue([]);
    userNotifRepo.findTenantTimezone.mockResolvedValue("America/Sao_Paulo");
    userNotifRepo.createMany.mockResolvedValue(1);
    userNotifRepo.findRecipientContext.mockResolvedValue({
      role: "PROFESSIONAL",
      notifyOwnAppointments: false,
      notifyTeamAppointments: true,
      notificationDeliveryMode: "realtime",
      quietHoursStart: null,
      quietHoursEnd: null,
    });
    settingRepo.findByTenant.mockResolvedValue(null); // usa default do sistema
    prefRepo.findEmailOverridesForUsers.mockResolvedValue(new Map());
  });

  it("grava in-app e enfileira e-mail para o profissional do atendimento", async () => {
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload());

    expect(userNotifRepo.createMany).toHaveBeenCalledWith("t1", [
      expect.objectContaining({ userId: "prof1", type: "appointment_created" }),
    ]);
    expect(bossSend).toHaveBeenCalledWith(
      "team-notification-email",
      expect.objectContaining({ tenantId: "t1", userId: "prof1", eventType: "appointment_created" }),
      expect.objectContaining({ retryLimit: 2 }),
    );
  });

  it("auto-skip: criador (não-público) sem notifyOwnAppointments não recebe nada", async () => {
    userNotifRepo.findRecipientContext.mockResolvedValue({
      role: "PROFESSIONAL", notifyOwnAppointments: false, notifyTeamAppointments: true,
      notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null,
    });
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload({ createdByUserId: "prof1" }));
    expect(userNotifRepo.createMany).not.toHaveBeenCalled();
    expect(bossSend).not.toHaveBeenCalled();
  });

  it("vitrine pública não aplica auto-skip mesmo com createdByUserId = destinatário", async () => {
    await dispatcher.dispatchAppointmentEvent(
      "appointment_created",
      makePayload({ createdByUserId: "prof1", origin: "public" }),
    );
    expect(userNotifRepo.createMany).toHaveBeenCalled();
  });

  it("gestor com notifyTeamAppointments=false não recebe agendamento de outro profissional", async () => {
    userNotifRepo.findManagers.mockResolvedValue([
      {
        id: "owner1", email: "o@x.com", name: "Dono",
        notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: false,
        notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null,
      },
    ]);
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload());
    const rows = userNotifRepo.createMany.mock.calls[0][1];
    expect(rows.find((r: { userId: string }) => r.userId === "owner1")).toBeUndefined();
  });

  it("evento desabilitado pelo negócio não gera in-app nem e-mail", async () => {
    settingRepo.findByTenant.mockResolvedValue({ enabled: false, defaultChannels: [] });
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload());
    expect(userNotifRepo.createMany).not.toHaveBeenCalled();
    expect(bossSend).not.toHaveBeenCalled();
  });

  it("override de e-mail do usuário desliga o e-mail mas mantém o in-app", async () => {
    prefRepo.findEmailOverridesForUsers.mockResolvedValue(new Map([["prof1", false]]));
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload());
    expect(userNotifRepo.createMany).toHaveBeenCalled();
    expect(bossSend).not.toHaveBeenCalled();
  });
});

describe("TeamNotificationDispatcherService.dispatchAppointmentRescheduled", () => {
  let dispatcher: TeamNotificationDispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new TeamNotificationDispatcherService(userNotifRepo as never, settingRepo as never, prefRepo as never);
    userNotifRepo.findManagers.mockResolvedValue([]);
    userNotifRepo.findTenantTimezone.mockResolvedValue("America/Sao_Paulo");
    userNotifRepo.createMany.mockResolvedValue(1);
    userNotifRepo.findRecipientContext.mockResolvedValue({
      role: "PROFESSIONAL", notifyOwnAppointments: false, notifyTeamAppointments: true,
      notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null,
    });
    settingRepo.findByTenant.mockResolvedValue(null);
    prefRepo.findEmailOverridesForUsers.mockResolvedValue(new Map());
  });

  it("busca o agendamento no banco para enriquecer o payload (evento não traz professional.id/email)", async () => {
    userNotifRepo.findAppointmentForNotification.mockResolvedValue({
      createdByUserId: "owner1",
      packageId: null,
      serviceId: "s1",
      serviceName: "Corte",
      professional: { id: "prof1", name: "Ana", email: "ana@x.com" },
    });

    await dispatcher.dispatchAppointmentRescheduled({
      tenantId: "t1",
      appointmentId: "a1",
      customerId: "c1",
      customerName: "Maria",
      customerPhone: null,
      serviceName: "Corte",
      professionalName: "Ana",
      oldStartsAt: new Date("2026-07-13T14:00:00Z"),
      newStartsAt: new Date("2026-07-14T14:00:00Z"),
      newEndsAt: new Date("2026-07-14T14:30:00Z"),
      notificationMessage: "",
    } as never);

    expect(userNotifRepo.createMany).toHaveBeenCalledWith("t1", [
      expect.objectContaining({ userId: "prof1", type: "appointment_rescheduled" }),
    ]);
  });

  it("agendamento não encontrado não quebra (skip silencioso)", async () => {
    userNotifRepo.findAppointmentForNotification.mockResolvedValue(null);
    await expect(
      dispatcher.dispatchAppointmentRescheduled({ tenantId: "t1", appointmentId: "a1" } as never),
    ).resolves.toBeUndefined();
    expect(userNotifRepo.createMany).not.toHaveBeenCalled();
  });
});

describe("TeamNotificationDispatcherService.dispatchCustomerCreated", () => {
  let dispatcher: TeamNotificationDispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new TeamNotificationDispatcherService(userNotifRepo as never, settingRepo as never, prefRepo as never);
    userNotifRepo.createMany.mockResolvedValue(1);
    settingRepo.findByTenant.mockResolvedValue(null);
    prefRepo.findEmailOverridesForUsers.mockResolvedValue(new Map());
  });

  it("notifica gestores sem e-mail (default do sistema para customer_created é só IN_APP)", async () => {
    userNotifRepo.findManagers.mockResolvedValue([
      {
        id: "owner1", email: "o@x.com", name: "Dono",
        notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: true,
        notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null,
      },
    ]);
    await dispatcher.dispatchCustomerCreated({ tenantId: "t1", customer: { id: "c1", name: "João" } });
    expect(userNotifRepo.createMany).toHaveBeenCalledWith("t1", [
      expect.objectContaining({ userId: "owner1", type: "customer_created" }),
    ]);
    expect(bossSend).not.toHaveBeenCalled();
  });

  it("sem gestores, não faz nada", async () => {
    userNotifRepo.findManagers.mockResolvedValue([]);
    await dispatcher.dispatchCustomerCreated({ tenantId: "t1", customer: { id: "c1", name: "João" } });
    expect(userNotifRepo.createMany).not.toHaveBeenCalled();
  });
});
