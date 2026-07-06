import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationRepository } from "./notification.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("NotificationRepository.findMany", () => {
  let repo: NotificationRepository;

  beforeEach(() => {
    repo = new NotificationRepository();
    vi.clearAllMocks();
  });

  it("retorna logs paginados filtrados por tenantId", async () => {
    const fakeLog = {
      id: "log1",
      tenantId: "tenant1",
      appointmentId: null,
      customerId: null,
      channel: "WHATSAPP",
      template: "appointment-created",
      recipient: "+5511999999999",
      status: "SENT",
      provider: "twilio",
      payload: {},
      errorMessage: null,
      externalId: "SM123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.notificationLog.findMany.mockResolvedValue([fakeLog] as never);
    prismaMock.notificationLog.count.mockResolvedValue(1);

    const result = await repo.findMany("tenant1", { page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(prismaMock.notificationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant1" }),
      }),
    );
  });

  it("aplica filtro de template quando fornecido", async () => {
    prismaMock.notificationLog.findMany.mockResolvedValue([]);
    prismaMock.notificationLog.count.mockResolvedValue(0);

    await repo.findMany("tenant1", { template: "birthday", page: 1, limit: 20 });

    expect(prismaMock.notificationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant1", template: "birthday" }),
      }),
    );
  });
});

describe("NotificationRepository.countEmailsThisMonth", () => {
  let repo: NotificationRepository;

  beforeEach(() => {
    repo = new NotificationRepository();
    vi.clearAllMocks();
  });

  it("conta apenas logs de canal EMAIL do tenant no mês corrente", async () => {
    prismaMock.notificationLog.count.mockResolvedValue(7);

    const result = await repo.countEmailsThisMonth("tenant1");

    expect(result).toBe(7);
    expect(prismaMock.notificationLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant1", channel: "EMAIL" }),
      }),
    );
  });
});
