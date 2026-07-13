import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...args: unknown[]) => getSessionContext(...args) }));

const listForTenant = vi.fn();
const updateEvent = vi.fn();
vi.mock("@/domains/notifications/user-notifications/team-notification-settings.service", () => ({
  teamNotificationSettingsService: {
    listForTenant: (...args: unknown[]) => listForTenant(...args),
    updateEvent: (...args: unknown[]) => updateEvent(...args),
  },
}));

import { GET, PATCH } from "./route";

function makeSession(overrides: Partial<{ isOwner: boolean; permissions: Record<string, string[]> }> = {}) {
  return {
    tenantId: "t1", userId: "u1",
    isOwner: overrides.isOwner ?? false,
    permissions: overrides.permissions ?? { configuracoes: ["view", "edit"] },
  };
}

describe("GET /api/notifications/team-settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna a lista de configurações do tenant", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    listForTenant.mockResolvedValue([{ eventType: "appointment_created", enabled: true }]);

    const res = await GET(new Request("http://x/api/notifications/team-settings"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.settings).toHaveLength(1);
    expect(listForTenant).toHaveBeenCalledWith("t1");
  });

  it("403 quando falta permissão", async () => {
    getSessionContext.mockResolvedValue(makeSession({ permissions: {} }));
    const res = await GET(new Request("http://x/api/notifications/team-settings"));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/notifications/team-settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atualiza um evento com permissão de edição", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    updateEvent.mockResolvedValue({ eventType: "appointment_created", enabled: false });

    const res = await PATCH(
      new Request("http://x/api/notifications/team-settings", {
        method: "PATCH",
        body: JSON.stringify({ eventType: "appointment_created", enabled: false, defaultChannels: ["IN_APP"] }),
      }),
    );

    expect(res.status).toBe(200);
    expect(updateEvent).toHaveBeenCalledWith("t1", "appointment_created", { enabled: false, defaultChannels: ["IN_APP"] });
  });

  it("422 com payload inválido", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    const res = await PATCH(
      new Request("http://x/api/notifications/team-settings", {
        method: "PATCH",
        body: JSON.stringify({ eventType: "evento_invalido", enabled: "nao-e-boolean" }),
      }),
    );
    expect(res.status).toBe(422);
  });
});
