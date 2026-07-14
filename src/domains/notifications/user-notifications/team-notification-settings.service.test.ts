import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamNotificationSettingsService } from "./team-notification-settings.service";

const repo = { findAllByTenant: vi.fn(), upsert: vi.fn() };

describe("TeamNotificationSettingsService.listForTenant", () => {
  let service: TeamNotificationSettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TeamNotificationSettingsService(repo as never);
  });

  it("combina o catálogo com as configurações salvas do tenant", async () => {
    repo.findAllByTenant.mockResolvedValue([
      { eventType: "appointment_created", enabled: false, defaultChannels: ["IN_APP"] },
    ]);

    const result = await service.listForTenant("t1");

    expect(result).toHaveLength(7); // todo o catálogo, mesmo sem linha salva
    const created = result.find((r) => r.eventType === "appointment_created");
    expect(created?.enabled).toBe(false);
    expect(created?.defaultChannels).toEqual(["IN_APP"]);
    expect(created?.label).toBe("Novo agendamento");
  });

  it("usa o default do sistema para evento sem configuração salva", async () => {
    repo.findAllByTenant.mockResolvedValue([]);
    const result = await service.listForTenant("t1");
    const customerCreated = result.find((r) => r.eventType === "customer_created");
    expect(customerCreated?.enabled).toBe(true);
    expect(customerCreated?.defaultChannels).toEqual(["IN_APP"]);
  });
});

describe("TeamNotificationSettingsService.updateEvent", () => {
  it("delega ao repository", async () => {
    repo.upsert.mockResolvedValue({ eventType: "appointment_created" });
    const service = new TeamNotificationSettingsService(repo as never);
    await service.updateEvent("t1", "appointment_created", { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] });
    expect(repo.upsert).toHaveBeenCalledWith("t1", "appointment_created", { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] });
  });
});
