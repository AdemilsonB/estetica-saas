import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...args: unknown[]) => getSessionContext(...args) }));

const getMyNotificationSettings = vi.fn();
const updateMyNotificationSettings = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification.service", () => ({
  userNotificationService: {
    getMyNotificationSettings: (...args: unknown[]) => getMyNotificationSettings(...args),
    updateMyNotificationSettings: (...args: unknown[]) => updateMyNotificationSettings(...args),
  },
}));

function makeSession() {
  return { tenantId: "t1", userId: "u1", isOwner: false, permissions: {} };
}

describe("GET /api/notifications/me/team-preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna as preferências do próprio usuário, sem checagem de permissão de cargo", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    getMyNotificationSettings.mockResolvedValue({
      notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null, emailOverrides: [],
    });

    const res = await GET(new Request("http://x/api/notifications/me/team-preferences"));

    expect(res.status).toBe(200);
    expect(getMyNotificationSettings).toHaveBeenCalledWith("t1", "u1");
  });
});

describe("PATCH /api/notifications/me/team-preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atualiza as próprias preferências", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    updateMyNotificationSettings.mockResolvedValue(undefined);

    const res = await PATCH(
      new Request("http://x/api/notifications/me/team-preferences", {
        method: "PATCH",
        body: JSON.stringify({ notificationDeliveryMode: "digest", quietHoursStart: 22, quietHoursEnd: 7 }),
      }),
    );

    expect(res.status).toBe(200);
    expect(updateMyNotificationSettings).toHaveBeenCalledWith("t1", "u1", {
      notificationDeliveryMode: "digest", quietHoursStart: 22, quietHoursEnd: 7,
    });
  });

  it("422 com quietHoursStart fora de 0-23", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    const res = await PATCH(
      new Request("http://x/api/notifications/me/team-preferences", {
        method: "PATCH",
        body: JSON.stringify({ quietHoursStart: 25 }),
      }),
    );
    expect(res.status).toBe(422);
  });
});
