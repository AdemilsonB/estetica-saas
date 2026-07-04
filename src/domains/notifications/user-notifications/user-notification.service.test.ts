import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserNotificationService } from "./user-notification.service";

const repo = {
  createMany: vi.fn(),
  findManagers: vi.fn(),
  findManyForUser: vi.fn(),
  countUnread: vi.fn(),
  findUserPrefs: vi.fn(),
  findTenantName: vi.fn(),
  markRead: vi.fn(),
  updatePrefs: vi.fn(),
};

const emailSend = vi.fn();
vi.mock("@/domains/notifications/providers/email.provider", () => ({
  getEmailProvider: () => ({ send: emailSend }),
}));

function makePayload(
  over: Partial<{
    createdByUserId: string | null;
    profId: string;
    profEmail: string;
    origin: "panel" | "public";
    serviceName: string;
    packageId: string | null;
  }> = {},
) {
  return {
    tenantId: "t1",
    appointment: {
      id: "a1",
      createdByUserId: over.createdByUserId ?? null,
      startsAt: new Date("2026-07-04T14:00:00Z"),
      packageId: over.packageId ?? null,
    },
    customer: { id: "c1", name: "Maria", phone: null, email: null },
    service: { id: "s1", name: over.serviceName ?? "Corte", duration: 30 },
    professional: { id: over.profId ?? "prof1", name: "Ana", email: over.profEmail ?? "ana@x.com" },
    origin: over.origin ?? "panel",
  } as never;
}

describe("UserNotificationService.notifyAppointment", () => {
  let service: UserNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never);
    repo.findManagers.mockResolvedValue([]);
    repo.createMany.mockResolvedValue(1);
    repo.findTenantName.mockResolvedValue("Estúdio X");
    // Profissional comum por padrão (não gestor), toggles no default.
    repo.findUserPrefs.mockResolvedValue({
      id: "prof1",
      email: "ana@x.com",
      name: "Ana",
      role: "PROFESSIONAL",
      notifyEmailAppointments: false,
      notifyOwnAppointments: false,
      notifyTeamAppointments: true,
    });
  });

  it("agendamento pela vitrine notifica o dono mesmo sendo o createdByUserId (sem auto-skip)", async () => {
    // Vitrine passa owner.id como createdByUserId só pra satisfazer a FK.
    repo.findManagers.mockResolvedValue([
      { id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: true },
    ]);
    await service.notifyAppointment(
      makePayload({ origin: "public", createdByUserId: "owner1" }),
      "created",
    );
    const rows = repo.createMany.mock.calls[0][1];
    // Dono NÃO é pulado por auto-skip em fluxo público.
    const ownerRow = rows.find((r: { userId: string }) => r.userId === "owner1");
    expect(ownerRow).toBeDefined();
    expect(ownerRow.title).toBe("Novo agendamento pela vitrine");
    expect(rows.find((r: { userId: string }) => r.userId === "prof1")).toBeDefined();
    expect(rows[0].type).toBe("appointment_created");
  });

  it("painel: profissional é o criador sem opt-in NÃO recebe (auto-skip continua valendo)", async () => {
    // profissional é o próprio criador e não optou por se notificar
    repo.findManagers.mockResolvedValue([]);
    await service.notifyAppointment(
      makePayload({ createdByUserId: "prof1", profId: "prof1" }),
      "created",
    );
    // prof1 é o único candidato e deve ser pulado -> createMany não chamado ou sem prof1
    const called = repo.createMany.mock.calls.length > 0;
    const rows = called ? repo.createMany.mock.calls[0][1] : [];
    expect(rows.find((r: { userId: string }) => r.userId === "prof1")).toBeUndefined();
  });

  it("gestor com notifyTeamAppointments=false não recebe agendamento de outro profissional", async () => {
    repo.findManagers.mockResolvedValue([
      { id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: false },
    ]);
    await service.notifyAppointment(makePayload(), "created");
    const rows = repo.createMany.mock.calls[0]?.[1] ?? [];
    expect(rows.find((r: { userId: string }) => r.userId === "owner1")).toBeUndefined();
    expect(rows.find((r: { userId: string }) => r.userId === "prof1")).toBeDefined();
  });

  it("dedup: profissional que também é gestor recebe uma única notificação", async () => {
    repo.findManagers.mockResolvedValue([
      { id: "prof1", email: "ana@x.com", name: "Ana", notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: true },
    ]);
    await service.notifyAppointment(makePayload(), "created");
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows.filter((r: { userId: string }) => r.userId === "prof1")).toHaveLength(1);
  });

  it("envia e-mail apenas para quem tem notifyEmailAppointments=true", async () => {
    repo.findManagers.mockResolvedValue([
      { id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: true, notifyOwnAppointments: false, notifyTeamAppointments: true },
    ]);
    await service.notifyAppointment(makePayload(), "created");
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: "o@x.com" }));
  });

  it("cancelamento ignora a regra de auto-skip (sempre notifica o profissional)", async () => {
    await service.notifyAppointment(
      makePayload({ createdByUserId: "prof1", profId: "prof1" }),
      "cancelled",
    );
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows.find((r: { userId: string }) => r.userId === "prof1")).toBeDefined();
    expect(rows[0].type).toBe("appointment_cancelled");
  });

  it("pacote (service.name vazio) usa 'Pacote' como rótulo no body e no data", async () => {
    await service.notifyAppointment(
      makePayload({ serviceName: "", packageId: "pkg1" }),
      "created",
    );
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows[0].data.serviceName).toBe("Pacote");
    expect(rows[0].body).toContain("Pacote");
  });

  it("profissional comum (não gestor) com notifyOwnAppointments=true recebe o próprio agendamento", async () => {
    repo.findManagers.mockResolvedValue([]);
    repo.findUserPrefs.mockResolvedValue({
      id: "prof1",
      email: "ana@x.com",
      name: "Ana",
      role: "PROFESSIONAL",
      notifyEmailAppointments: false,
      notifyOwnAppointments: true,
      notifyTeamAppointments: true,
    });
    await service.notifyAppointment(
      makePayload({ createdByUserId: "prof1", profId: "prof1" }),
      "created",
    );
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows.find((r: { userId: string }) => r.userId === "prof1")).toBeDefined();
  });

  it("cancelamento: gestor puro com notifyTeamAppointments=false é pulado; profissional ainda recebe", async () => {
    repo.findManagers.mockResolvedValue([
      { id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: false },
    ]);
    await service.notifyAppointment(makePayload(), "cancelled");
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows.find((r: { userId: string }) => r.userId === "owner1")).toBeUndefined();
    expect(rows.find((r: { userId: string }) => r.userId === "prof1")).toBeDefined();
  });
});

describe("UserNotificationService.notifyCustomerCreated", () => {
  let service: UserNotificationService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never);
    repo.createMany.mockResolvedValue(1);
  });

  it("notifica apenas gestores, sem e-mail", async () => {
    repo.findManagers.mockResolvedValue([
      { id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: true, notifyOwnAppointments: false, notifyTeamAppointments: true },
    ]);
    await service.notifyCustomerCreated({ tenantId: "t1", customer: { id: "c1", name: "João" } });
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows[0].userId).toBe("owner1");
    expect(rows[0].type).toBe("customer_created");
    expect(emailSend).not.toHaveBeenCalled();
  });
});
