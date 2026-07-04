import { describe, it, expect, vi, beforeEach } from "vitest";

const listForUser = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification.service", () => ({
  userNotificationService: { listForUser: (...a: unknown[]) => listForUser(...a) },
}));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));

import { GET } from "./route";

describe("GET /api/notifications/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({ tenantId: "t1", userId: "u1" });
    listForUser.mockResolvedValue({ items: [], unreadCount: 0, isManager: false, prefs: {} });
  });

  it("usa tenantId/userId do token e period=30 por padrão", async () => {
    const res = await GET(new Request("http://x/api/notifications/me"));
    expect(res.status).toBe(200);
    expect(listForUser).toHaveBeenCalledWith("t1", "u1", { period: "30", limit: 50 });
  });

  it("aceita period=all da query", async () => {
    await GET(new Request("http://x/api/notifications/me?period=all"));
    expect(listForUser).toHaveBeenCalledWith("t1", "u1", { period: "all", limit: 50 });
  });
});
