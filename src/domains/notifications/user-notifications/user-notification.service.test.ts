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

const prefRepo = { upsertEmailOverride: vi.fn() };

describe("UserNotificationService.listForUser", () => {
  let service: UserNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never, prefRepo as never);
  });

  it("retorna items, unreadCount, isManager e prefs", async () => {
    repo.findUserPrefs.mockResolvedValue({
      id: "u1", email: "u1@x.com", name: "U1", role: "OWNER",
      notifyEmailAppointments: true, notifyOwnAppointments: false, notifyTeamAppointments: true,
    });
    repo.findManyForUser.mockResolvedValue([{ id: "n1" }]);
    repo.countUnread.mockResolvedValue(2);

    const result = await service.listForUser("t1", "u1", { period: "7", limit: 20 });

    expect(result.isManager).toBe(true);
    expect(result.unreadCount).toBe(2);
    expect(result.items).toHaveLength(1);
  });
});

describe("UserNotificationService.markRead", () => {
  it("delega ao repository", async () => {
    const service = new UserNotificationService(repo as never, prefRepo as never);
    repo.markRead.mockResolvedValue(3);
    const count = await service.markRead("t1", "u1", { all: true });
    expect(count).toBe(3);
    expect(repo.markRead).toHaveBeenCalledWith("t1", "u1", { all: true });
  });
});

describe("UserNotificationService.updatePreferences", () => {
  let service: UserNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never, prefRepo as never);
    repo.updatePrefs.mockResolvedValue({
      notifyEmailAppointments: true, notifyOwnAppointments: false, notifyTeamAppointments: true,
    });
  });

  it("atualiza o boolean legado no repository", async () => {
    await service.updatePreferences("t1", "u1", { notifyEmailAppointments: true });
    expect(repo.updatePrefs).toHaveBeenCalledWith("t1", "u1", { notifyEmailAppointments: true });
  });

  it("dual-write: ao mudar notifyEmailAppointments, grava override EMAIL nos 4 eventos de agendamento", async () => {
    await service.updatePreferences("t1", "u1", { notifyEmailAppointments: false });
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledTimes(4);
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "appointment_created", false);
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "appointment_cancelled", false);
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "appointment_rescheduled", false);
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "appointment_no_show", false);
  });

  it("não escreve na tabela nova quando notifyEmailAppointments não é enviado (ex.: só notifyOwnAppointments)", async () => {
    await service.updatePreferences("t1", "u1", { notifyOwnAppointments: true });
    expect(prefRepo.upsertEmailOverride).not.toHaveBeenCalled();
  });

  it("falha no dual-write não impede o retorno do método (boolean legado já foi salvo)", async () => {
    prefRepo.upsertEmailOverride.mockRejectedValue(new Error("erro transitório"));
    const result = await service.updatePreferences("t1", "u1", { notifyEmailAppointments: true });
    expect(result).toEqual({
      notifyEmailAppointments: true, notifyOwnAppointments: false, notifyTeamAppointments: true,
    });
  });
});
