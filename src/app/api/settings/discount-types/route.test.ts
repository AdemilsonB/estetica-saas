import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const list = vi.fn();
vi.mock("@/domains/financial/discount-type.repository", () => ({
  discountTypeRepository: { list: (...a: unknown[]) => list(...a) },
}));

import { GET } from "./route";

describe("GET /api/settings/discount-types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 200 quando o usuário tem descontos:view", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { descontos: ["view"] },
    });
    list.mockResolvedValue([]);

    const res = await GET(new Request("http://x/api/settings/discount-types"));

    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith("t1", false);
  });

  it("retorna 403 quando falta descontos:view (mesmo tendo configuracoes:view)", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { configuracoes: ["view", "edit"] },
    });

    const res = await GET(new Request("http://x/api/settings/discount-types"));

    expect(res.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
});
