import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "./route";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...args: unknown[]) => getSessionContext(...args) }));

const getForTenant = vi.fn();
const upsertTemplate = vi.fn();
vi.mock("@/domains/notifications/user-notifications/notification-template.service", () => ({
  notificationTemplateService: {
    getForTenant: (...args: unknown[]) => getForTenant(...args),
    upsert: (...args: unknown[]) => upsertTemplate(...args),
  },
}));

function makeSession() {
  return { tenantId: "t1", userId: "u1", isOwner: false, permissions: { configuracoes: ["view", "edit"] } };
}

describe("GET /api/notifications/team-settings/templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna o template pro evento+canal pedidos via query string", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    getForTenant.mockResolvedValue({ subject: "S", body: "B", isSystemDefault: true });

    const res = await GET(
      new Request("http://x/api/notifications/team-settings/templates?eventType=appointment_created&channel=EMAIL"),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.subject).toBe("S");
    expect(getForTenant).toHaveBeenCalledWith("t1", "appointment_created", "EMAIL");
  });

  it("422 quando eventType/channel da query são inválidos ou ausentes", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    const res = await GET(new Request("http://x/api/notifications/team-settings/templates"));
    expect(res.status).toBe(422);
  });
});

describe("PUT /api/notifications/team-settings/templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("salva o template custom do tenant", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    upsertTemplate.mockResolvedValue({ subject: "S", body: "B" });

    const res = await PUT(
      new Request("http://x/api/notifications/team-settings/templates", {
        method: "PUT",
        body: JSON.stringify({ eventType: "appointment_created", channel: "EMAIL", subject: "S", body: "B" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(upsertTemplate).toHaveBeenCalledWith("t1", "appointment_created", "EMAIL", { subject: "S", body: "B" });
  });
});
