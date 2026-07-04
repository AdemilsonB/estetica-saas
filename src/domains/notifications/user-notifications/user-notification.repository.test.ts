import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { UserNotificationRepository } from "./user-notification.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("UserNotificationRepository", () => {
  let repo: UserNotificationRepository;

  beforeEach(() => {
    repo = new UserNotificationRepository();
    vi.clearAllMocks();
  });

  it("createMany insere linhas com tenantId injetado", async () => {
    prismaMock.userNotification.createMany.mockResolvedValue({ count: 2 } as never);

    const count = await repo.createMany("t1", [
      { userId: "u1", type: "appointment_created", title: "a", body: "b", data: {} },
      { userId: "u2", type: "appointment_created", title: "a", body: "b", data: {} },
    ]);

    expect(count).toBe(2);
    expect(prismaMock.userNotification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ tenantId: "t1", userId: "u1" }),
        expect.objectContaining({ tenantId: "t1", userId: "u2" }),
      ],
    });
  });

  it("findManyForUser filtra por tenant e user e aplica since/limit", async () => {
    prismaMock.userNotification.findMany.mockResolvedValue([] as never);
    const since = new Date("2026-07-01");

    await repo.findManyForUser("t1", "u1", { since, limit: 50 });

    expect(prismaMock.userNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", userId: "u1", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });

  it("countUnread conta readAt null do usuário", async () => {
    prismaMock.userNotification.count.mockResolvedValue(3);
    const n = await repo.countUnread("t1", "u1");
    expect(n).toBe(3);
    expect(prismaMock.userNotification.count).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "u1", readAt: null },
    });
  });

  it("markRead com all=true marca todas as não-lidas do usuário", async () => {
    prismaMock.userNotification.updateMany.mockResolvedValue({ count: 4 } as never);
    const n = await repo.markRead("t1", "u1", { all: true });
    expect(n).toBe(4);
    expect(prismaMock.userNotification.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "u1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it("markRead com id marca apenas aquela notificação do usuário", async () => {
    prismaMock.userNotification.updateMany.mockResolvedValue({ count: 1 } as never);
    const n = await repo.markRead("t1", "u1", { id: "n9" });
    expect(n).toBe(1);
    expect(prismaMock.userNotification.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "u1", id: "n9", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it("findManagers busca OWNER e MANAGER do tenant", async () => {
    prismaMock.user.findMany.mockResolvedValue([] as never);
    await repo.findManagers("t1");
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", role: { in: ["OWNER", "MANAGER"] } },
      }),
    );
  });

  it("findTenantName retorna o nome do tenant", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ name: "Estúdio X" } as never);

    const name = await repo.findTenantName("t1");

    expect(name).toBe("Estúdio X");
    expect(prismaMock.tenant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" } }),
    );
  });

  it("findTenantName retorna null quando tenant não existe", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null as never);
    const name = await repo.findTenantName("t1");
    expect(name).toBeNull();
  });

  it("findUserPrefs busca por id e tenant", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "u1",
      email: "u1@e.com",
      name: "U1",
      role: "OWNER",
      notifyEmailAppointments: true,
      notifyOwnAppointments: false,
      notifyTeamAppointments: true,
    } as never);

    const prefs = await repo.findUserPrefs("t1", "u1");

    expect(prefs).not.toBeNull();
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1", tenantId: "t1" } }),
    );
  });

  it("updatePrefs filtra tenantId no where e retorna as prefs", async () => {
    prismaMock.user.update.mockResolvedValue({
      notifyEmailAppointments: true,
      notifyOwnAppointments: false,
      notifyTeamAppointments: true,
    } as never);

    const prefs = await repo.updatePrefs("t1", "u1", { notifyEmailAppointments: true });

    expect(prefs).toEqual({
      notifyEmailAppointments: true,
      notifyOwnAppointments: false,
      notifyTeamAppointments: true,
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1", tenantId: "t1" } }),
    );
  });
});
