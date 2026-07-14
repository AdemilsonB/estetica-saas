import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { UserNotificationPreferenceRepository } from "./user-notification-preference.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("UserNotificationPreferenceRepository", () => {
  let repo: UserNotificationPreferenceRepository;

  beforeEach(() => {
    repo = new UserNotificationPreferenceRepository();
    vi.clearAllMocks();
  });

  it("findEmailOverridesForUsers busca em lote (uma query para N usuários)", async () => {
    prismaMock.userNotificationPreference.findMany.mockResolvedValue([
      { userId: "u1", enabled: false },
      { userId: "u2", enabled: true },
    ] as never);

    const result = await repo.findEmailOverridesForUsers("t1", ["u1", "u2", "u3"], "appointment_created");

    expect(result.get("u1")).toBe(false);
    expect(result.get("u2")).toBe(true);
    expect(result.has("u3")).toBe(false);
    expect(prismaMock.userNotificationPreference.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: { in: ["u1", "u2", "u3"] }, eventType: "appointment_created", channel: "EMAIL" },
      select: { userId: true, enabled: true },
    });
  });

  it("findEmailOverridesForUsers com lista vazia não consulta o banco", async () => {
    const result = await repo.findEmailOverridesForUsers("t1", [], "appointment_created");
    expect(result.size).toBe(0);
    expect(prismaMock.userNotificationPreference.findMany).not.toHaveBeenCalled();
  });

  it("upsertEmailOverride grava enabled para o par usuário/evento", async () => {
    prismaMock.userNotificationPreference.upsert.mockResolvedValue({} as never);

    await repo.upsertEmailOverride("t1", "u1", "appointment_created", false);

    expect(prismaMock.userNotificationPreference.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_userId_eventType_channel: {
          tenantId: "t1", userId: "u1", eventType: "appointment_created", channel: "EMAIL",
        },
      },
      update: { enabled: false },
      create: { tenantId: "t1", userId: "u1", eventType: "appointment_created", channel: "EMAIL", enabled: false },
    });
  });

  it("findAllForUser retorna todos os overrides do usuário no tenant", async () => {
    prismaMock.userNotificationPreference.findMany.mockResolvedValue([
      { eventType: "appointment_created", channel: "EMAIL", enabled: false },
    ] as never);
    const result = await repo.findAllForUser("t1", "u1");
    expect(result).toEqual([{ eventType: "appointment_created", channel: "EMAIL", enabled: false }]);
    expect(prismaMock.userNotificationPreference.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "u1" },
      select: { eventType: true, channel: true, enabled: true },
    });
  });
});
