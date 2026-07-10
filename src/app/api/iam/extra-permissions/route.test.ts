import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const resolveGate = vi.fn();
vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { resolveGate: (...a: unknown[]) => resolveGate(...a) },
}));

import { GET } from "./route";

describe("GET /api/iam/extra-permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({ tenantId: "t1", userId: "u1" });
    resolveGate.mockResolvedValue({ allowed: true, currentPlan: "PRO", requiredPlan: null, requiredPlanLabel: null });
  });

  it("retorna as duas seções extras com o gate resolvido", async () => {
    const res = await GET(new Request("http://x/api/iam/extra-permissions"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.map((s: { key: string }) => s.key)).toEqual(["comissoes", "descontos"]);
    expect(body[0].locked).toBe(false);
  });

  it("marca locked quando o gate nega acesso", async () => {
    resolveGate.mockResolvedValue({ allowed: false, currentPlan: "FREE", requiredPlan: "PRO", requiredPlanLabel: "Pro" });
    const res = await GET(new Request("http://x/api/iam/extra-permissions"));
    const body = await res.json();
    expect(body[0].locked).toBe(true);
    expect(body[0].requiredPlanLabel).toBe("Pro");
  });
});
