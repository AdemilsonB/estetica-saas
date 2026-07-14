import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { TenantNotificationSettingRepository } from "./tenant-notification-setting.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("TenantNotificationSettingRepository", () => {
  let repo: TenantNotificationSettingRepository;

  beforeEach(() => {
    repo = new TenantNotificationSettingRepository();
    vi.clearAllMocks();
  });

  it("findByTenant filtra por tenantId e eventType", async () => {
    prismaMock.tenantNotificationSetting.findFirst.mockResolvedValue({
      id: "s1",
      tenantId: "t1",
      eventType: "appointment_created",
      enabled: true,
      defaultChannels: ["IN_APP", "EMAIL"],
      templateId: null,
    } as never);

    const result = await repo.findByTenant("t1", "appointment_created");

    expect(result?.enabled).toBe(true);
    expect(prismaMock.tenantNotificationSetting.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t1", eventType: "appointment_created" },
    });
  });

  it("retorna null quando o tenant não configurou o evento", async () => {
    prismaMock.tenantNotificationSetting.findFirst.mockResolvedValue(null as never);
    const result = await repo.findByTenant("t1", "customer_created");
    expect(result).toBeNull();
  });

  it("findAllByTenant retorna todas as configurações do tenant", async () => {
    prismaMock.tenantNotificationSetting.findMany.mockResolvedValue([
      { id: "s1", tenantId: "t1", eventType: "appointment_created", enabled: true, defaultChannels: ["IN_APP", "EMAIL"], templateId: null },
    ] as never);
    const result = await repo.findAllByTenant("t1");
    expect(result).toHaveLength(1);
    expect(prismaMock.tenantNotificationSetting.findMany).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
  });

  it("upsert cria/atualiza a configuração pela chave composta tenantId+eventType", async () => {
    prismaMock.tenantNotificationSetting.upsert.mockResolvedValue({} as never);
    await repo.upsert("t1", "appointment_created", { enabled: false, defaultChannels: ["IN_APP"] });
    expect(prismaMock.tenantNotificationSetting.upsert).toHaveBeenCalledWith({
      where: { tenantId_eventType: { tenantId: "t1", eventType: "appointment_created" } },
      update: { enabled: false, defaultChannels: ["IN_APP"] },
      create: { tenantId: "t1", eventType: "appointment_created", enabled: false, defaultChannels: ["IN_APP"] },
    });
  });
});
