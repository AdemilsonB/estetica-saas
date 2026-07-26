import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { customerMessageTemplateRepository } from "./customer-message-template.repository";

describe("customerMessageTemplateRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByEvent filtra por tenantId, evento e canal", async () => {
    prismaMock.customerMessageTemplate.findFirst.mockResolvedValue(null);

    await customerMessageTemplateRepository.findByEvent("tenant-1", "appointment_created", "WHATSAPP");

    expect(prismaMock.customerMessageTemplate.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", event: "appointment_created", channel: "WHATSAPP" },
    });
  });

  it("listByTenant filtra por tenantId", async () => {
    prismaMock.customerMessageTemplate.findMany.mockResolvedValue([]);

    await customerMessageTemplateRepository.listByTenant("tenant-1");

    expect(prismaMock.customerMessageTemplate.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
    });
  });

  it("upsert usa a chave composta e grava o tenantId no create", async () => {
    prismaMock.customerMessageTemplate.upsert.mockResolvedValue({} as never);

    await customerMessageTemplateRepository.upsert("tenant-1", {
      event: "appointment_cancelled",
      channel: "WHATSAPP",
      subject: null,
      body: "Oi {{cliente}}",
      mediaUrl: null,
    });

    expect(prismaMock.customerMessageTemplate.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_event_channel: {
          tenantId: "tenant-1",
          event: "appointment_cancelled",
          channel: "WHATSAPP",
        },
      },
      create: {
        tenantId: "tenant-1",
        event: "appointment_cancelled",
        channel: "WHATSAPP",
        subject: null,
        body: "Oi {{cliente}}",
        mediaUrl: null,
      },
      update: { subject: null, body: "Oi {{cliente}}", mediaUrl: null },
    });
  });

  it("remove apaga apenas do tenant informado", async () => {
    prismaMock.customerMessageTemplate.deleteMany.mockResolvedValue({ count: 1 });

    await customerMessageTemplateRepository.remove("tenant-1", "birthday", "EMAIL");

    expect(prismaMock.customerMessageTemplate.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", event: "birthday", channel: "EMAIL" },
    });
  });
});
