import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { customerMessageSettingRepository } from "./customer-message-setting.repository";

const registro = {
  id: "cfg-1",
  tenantId: "tenant-1",
  event: "appointment_created" as const,
  enabled: false,
  channels: ["WHATSAPP" as const],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("customerMessageSettingRepository", () => {
  beforeEach(() => {
    prismaMock.customerMessageSetting.findFirst.mockResolvedValue(registro);
    prismaMock.customerMessageSetting.findMany.mockResolvedValue([registro]);
    prismaMock.customerMessageSetting.upsert.mockResolvedValue(registro);
  });

  it("findByEvent filtra por tenantId e evento", async () => {
    await customerMessageSettingRepository.findByEvent("tenant-1", "appointment_created");

    expect(prismaMock.customerMessageSetting.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", event: "appointment_created" },
    });
  });

  it("listByTenant nunca busca sem tenantId", async () => {
    await customerMessageSettingRepository.listByTenant("tenant-1");

    expect(prismaMock.customerMessageSetting.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
    });
  });

  it("upsert usa a chave composta tenantId+event e não deixa o tenantId vir do input", async () => {
    await customerMessageSettingRepository.upsert("tenant-1", {
      event: "appointment_no_show",
      enabled: false,
      channels: ["WHATSAPP"],
    });

    expect(prismaMock.customerMessageSetting.upsert).toHaveBeenCalledWith({
      where: { tenantId_event: { tenantId: "tenant-1", event: "appointment_no_show" } },
      create: {
        tenantId: "tenant-1",
        event: "appointment_no_show",
        enabled: false,
        channels: ["WHATSAPP"],
      },
      update: { enabled: false, channels: ["WHATSAPP"] },
    });
  });
});
