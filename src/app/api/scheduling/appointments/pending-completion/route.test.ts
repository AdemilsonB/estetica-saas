import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));

const listPendingCompletion = vi.fn();
vi.mock("@/domains/scheduling/scheduling.service", () => ({
  schedulingService: { listPendingCompletion: (...a: unknown[]) => listPendingCompletion(...a) },
}));

import { GET } from "./route";

function makeRequest() {
  return new Request("http://x/api/scheduling/appointments/pending-completion");
}

describe("GET /api/scheduling/appointments/pending-completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPendingCompletion.mockResolvedValue([]);
  });

  it("retorna 401/403 sem permissão agenda:view", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: {},
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
    expect(listPendingCompletion).not.toHaveBeenCalled();
  });

  it("restringe ao próprio profissional quando não tem agenda:view_all", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { agenda: ["view"] },
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(listPendingCompletion).toHaveBeenCalledWith("t1", { professionalId: "u1" });
  });

  it("retorna o consolidado da equipe quando tem agenda:view_all", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { agenda: ["view", "view_all"] },
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(listPendingCompletion).toHaveBeenCalledWith("t1", { professionalId: undefined });
  });

  it("dono sempre vê o consolidado, mesmo sem view_all explícito", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: true, permissions: {},
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(listPendingCompletion).toHaveBeenCalledWith("t1", { professionalId: undefined });
  });
});
