import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

const createMany = vi.fn();
const findManagers = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification.repository", () => ({
  userNotificationRepository: { createMany: (...a: unknown[]) => createMany(...a), findManagers: (...a: unknown[]) => findManagers(...a) },
}));

import { handleUserBirthdayDigest } from "./user-birthday-digest";

describe("handleUserBirthdayDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMany.mockResolvedValue(1);
  });

  it("cria uma notificação-resumo por gestor quando há aniversariantes", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { tenantId: "t1", id: "c1", name: "Maria", phone: "+55...", birthDate: new Date("1990-07-05") },
      { tenantId: "t1", id: "c2", name: "João", phone: null, birthDate: new Date("1985-07-06") },
    ] as never);
    findManagers.mockResolvedValue([{ id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: true }]);

    await handleUserBirthdayDigest();

    expect(findManagers).toHaveBeenCalledWith("t1");
    const [tenantId, rows] = createMany.mock.calls[0];
    expect(tenantId).toBe("t1");
    expect(rows[0].type).toBe("birthday_digest");
    expect(rows[0].userId).toBe("owner1");
    expect(rows[0].title).toContain("2");
  });

  it("não cria nada quando não há aniversariantes", async () => {
    prismaMock.$queryRaw.mockResolvedValue([] as never);
    await handleUserBirthdayDigest();
    expect(createMany).not.toHaveBeenCalled();
  });
});
