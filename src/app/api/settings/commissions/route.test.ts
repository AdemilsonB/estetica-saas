import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const listByTenant = vi.fn();
vi.mock("@/domains/financial/commission.repository", () => ({
  commissionRepository: { listByTenant: (...a: unknown[]) => listByTenant(...a) },
}));

import { GET } from "./route";

describe("GET /api/settings/commissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 200 quando o usuário tem comissoes:view", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { comissoes: ["view"] },
    });
    listByTenant.mockResolvedValue([]);

    const res = await GET(new Request("http://x/api/settings/commissions"));

    expect(res.status).toBe(200);
    expect(listByTenant).toHaveBeenCalledWith("t1");
  });

  it("retorna 403 quando falta comissoes:view (mesmo tendo configuracoes:view)", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { configuracoes: ["view", "edit"] },
    });

    const res = await GET(new Request("http://x/api/settings/commissions"));

    expect(res.status).toBe(403);
    expect(listByTenant).not.toHaveBeenCalled();
  });
});
