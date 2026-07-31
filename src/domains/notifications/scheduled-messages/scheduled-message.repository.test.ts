import { describe, it, expect, beforeEach, vi } from "vitest";

import { prismaMock } from "@/shared/test/prisma-mock";

import { scheduledMessageRepository } from "./scheduled-message.repository";

describe("scheduledMessageRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create grava com o tenantId do argumento, nunca do input", async () => {
    prismaMock.scheduledMessage.create.mockResolvedValue({ id: "sm-1" } as never);

    await scheduledMessageRepository.create("tenant-1", {
      customerId: "cli-1",
      body: "Oi Maria",
      scheduledAt: new Date("2026-08-01T12:00:00.000Z"),
      createdByUserId: "user-1",
    });

    expect(prismaMock.scheduledMessage.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        customerId: "cli-1",
        body: "Oi Maria",
        scheduledAt: new Date("2026-08-01T12:00:00.000Z"),
        createdByUserId: "user-1",
        channel: "WHATSAPP",
      },
    });
  });

  it("listByCustomer filtra tenant e cliente, e traz quem agendou", async () => {
    prismaMock.scheduledMessage.findMany.mockResolvedValue([] as never);

    await scheduledMessageRepository.listByCustomer("tenant-1", "cli-1");

    expect(prismaMock.scheduledMessage.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", customerId: "cli-1" },
      include: { createdByUser: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "desc" },
    });
  });

  it("findById filtra pelo tenant — id de outro tenant nunca é alcançável", async () => {
    prismaMock.scheduledMessage.findFirst.mockResolvedValue(null);

    await scheduledMessageRepository.findById("tenant-1", "sm-1");

    expect(prismaMock.scheduledMessage.findFirst).toHaveBeenCalledWith({
      where: { id: "sm-1", tenantId: "tenant-1" },
      include: { createdByUser: { select: { id: true, name: true } } },
    });
  });

  it("update aplica corpo e horário novos filtrando o tenant", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 1 });

    await scheduledMessageRepository.update("tenant-1", "sm-1", {
      body: "Texto novo",
      scheduledAt: new Date("2026-08-02T12:00:00.000Z"),
    });

    expect(prismaMock.scheduledMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "sm-1", tenantId: "tenant-1", status: "PENDING" },
      data: { body: "Texto novo", scheduledAt: new Date("2026-08-02T12:00:00.000Z") },
    });
  });

  it("update devolve false quando nada foi alterado (linha já saiu do PENDING)", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 0 });

    const alterou = await scheduledMessageRepository.update("tenant-1", "sm-1", {
      body: "Texto novo",
      scheduledAt: new Date("2026-08-02T12:00:00.000Z"),
    });

    expect(alterou).toBe(false);
  });

  it("cancel só cancela o que ainda está PENDING", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 1 });

    const cancelou = await scheduledMessageRepository.cancel("tenant-1", "sm-1");

    expect(cancelou).toBe(true);
    expect(prismaMock.scheduledMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "sm-1", tenantId: "tenant-1", status: "PENDING" },
      data: { status: "CANCELLED" },
    });
  });

  it("findDue pega o que venceu, em ordem, com cliente e tenant juntos", async () => {
    prismaMock.scheduledMessage.findMany.mockResolvedValue([] as never);
    const agora = new Date("2026-08-01T12:05:00.000Z");

    await scheduledMessageRepository.findDue(agora, 50);

    expect(prismaMock.scheduledMessage.findMany).toHaveBeenCalledWith({
      where: { status: "PENDING", scheduledAt: { lte: agora } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        tenant: {
          select: { name: true, slug: true, timezone: true, phone: true, address: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
    });
  });

  it("claim é atômico: só ganha quem trocou PENDING por SENDING", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 1 });

    const ganhou = await scheduledMessageRepository.claim("sm-1");

    expect(ganhou).toBe(true);
    expect(prismaMock.scheduledMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "sm-1", status: "PENDING" },
      data: { status: "SENDING" },
    });
  });

  it("claim devolve false quando outro tick já levou a linha — idempotência", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 0 });

    expect(await scheduledMessageRepository.claim("sm-1")).toBe(false);
  });

  it("markSent grava horário de envio e o log gerado", async () => {
    prismaMock.scheduledMessage.update.mockResolvedValue({ id: "sm-1" } as never);
    const agora = new Date("2026-08-01T12:05:00.000Z");

    await scheduledMessageRepository.markSent("sm-1", "log-9", agora);

    expect(prismaMock.scheduledMessage.update).toHaveBeenCalledWith({
      where: { id: "sm-1" },
      data: {
        status: "SENT",
        sentAt: agora,
        notificationLogId: "log-9",
        failureReason: null,
      },
    });
  });

  it("markFailed guarda o motivo e não reagenda nada", async () => {
    prismaMock.scheduledMessage.update.mockResolvedValue({ id: "sm-1" } as never);

    await scheduledMessageRepository.markFailed("sm-1", "Cliente sem telefone.", null);

    expect(prismaMock.scheduledMessage.update).toHaveBeenCalledWith({
      where: { id: "sm-1" },
      data: {
        status: "FAILED",
        failureReason: "Cliente sem telefone.",
        notificationLogId: null,
      },
    });
  });

  it("expireStuck derruba SENDING antigo, para não ficar preso para sempre", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 3 });
    const limite = new Date("2026-08-01T11:50:00.000Z");

    const quantas = await scheduledMessageRepository.expireStuck(limite);

    expect(quantas).toBe(3);
    expect(prismaMock.scheduledMessage.updateMany).toHaveBeenCalledWith({
      where: { status: "SENDING", updatedAt: { lt: limite } },
      data: {
        status: "FAILED",
        failureReason:
          "O envio foi interrompido antes de terminar. Agende a mensagem de novo.",
      },
    });
  });
});
