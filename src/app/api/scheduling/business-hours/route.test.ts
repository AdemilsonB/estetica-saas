import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));

const getBusinessHours = vi.fn();
vi.mock("@/domains/iam/iam.service", () => ({
  iamService: { getBusinessHours: (...a: unknown[]) => getBusinessHours(...a) },
}));

const getPolicy = vi.fn();
vi.mock("@/domains/scheduling/scheduling-policy.service", () => ({
  schedulingPolicyService: { getPolicy: (...a: unknown[]) => getPolicy(...a) },
}));

import { GET } from "./route";

describe("GET /api/scheduling/business-hours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 200 pra quem só tem agenda:view (profissional comum, sem configuracoes:view)", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { agenda: ["view", "create"] },
    });
    getBusinessHours.mockResolvedValue({ "1": { open: "09:00", close: "18:00", active: true } });
    getPolicy.mockResolvedValue({ slotIntervalMinutes: 30 });

    const res = await GET(new Request("http://x/api/scheduling/business-hours"));

    expect(res.status).toBe(200);
    expect(getBusinessHours).toHaveBeenCalledWith("t1");
    const body = await res.json();
    expect(body.slotIntervalMinutes).toBe(30);
    expect(body.businessHours["1"].open).toBe("09:00");
  });

  it("retorna 403 quando falta agenda:view", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { financeiro: ["view"] },
    });

    const res = await GET(new Request("http://x/api/scheduling/business-hours"));

    expect(res.status).toBe(403);
    expect(getBusinessHours).not.toHaveBeenCalled();
  });
});
