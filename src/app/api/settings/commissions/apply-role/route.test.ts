import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const applyRateToRole = vi.fn();
vi.mock("@/domains/financial/commission.repository", () => ({
  commissionRepository: { applyRateToRole: (...a: unknown[]) => applyRateToRole(...a) },
}));

import { POST } from "./route";

const ROLE_ID_CUID = "cabcdefghijklmnopqrstuvwx";

function makeRequest(body: unknown) {
  return new Request("http://x/api/settings/commissions/apply-role", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/settings/commissions/apply-role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aplica a taxa quando o usuário tem comissoes:edit", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { comissoes: ["view", "edit"] },
    });
    applyRateToRole.mockResolvedValue({ applied: 3 });

    const res = await POST(makeRequest({ roleId: ROLE_ID_CUID, rate: 40 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: 3 });
    expect(applyRateToRole).toHaveBeenCalledWith("t1", ROLE_ID_CUID, 40);
  });

  it("retorna 403 quando falta comissoes:edit", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { comissoes: ["view"] },
    });

    const res = await POST(makeRequest({ roleId: ROLE_ID_CUID, rate: 40 }));

    expect(res.status).toBe(403);
    expect(applyRateToRole).not.toHaveBeenCalled();
  });
});
