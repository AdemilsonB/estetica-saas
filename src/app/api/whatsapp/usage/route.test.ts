import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanName } from "@prisma/client";

vi.mock("@/shared/auth/session", () => ({
  getSessionContext: vi.fn(),
}));

vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertAccess: vi.fn(), canAccess: vi.fn() },
  FEATURES: { WHATSAPP_BASIC: "whatsapp_basic" },
}));

vi.mock("@/domains/notifications/quota/whatsapp-quota.service", () => ({
  whatsAppQuotaService: { getUsage: vi.fn() },
}));

vi.mock("@/app/api/_lib/runtime", () => ({
  initializeDomainRuntime: vi.fn(),
}));

vi.mock("@/shared/database/prisma", () => ({
  prisma: {
    tenant: { findFirst: vi.fn() },
  },
}));

import { getSessionContext } from "@/shared/auth/session";
import { featureGuard } from "@/domains/billing/feature-guard";
import { whatsAppQuotaService } from "@/domains/notifications/quota/whatsapp-quota.service";
import { prisma } from "@/shared/database/prisma";
import { GET } from "./route";

function makeRequest() {
  return new Request("http://localhost/api/whatsapp/usage", {
    headers: { authorization: "Bearer token" },
  });
}

describe("GET /api/whatsapp/usage", () => {
  beforeEach(() => {
    vi.mocked(getSessionContext).mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "OWNER",
    } as never);
    vi.mocked(featureGuard.assertAccess).mockResolvedValue(undefined);
    vi.mocked(whatsAppQuotaService.getUsage).mockResolvedValue({
      used: 347,
      limit: 500,
      resetDate: "2026-06-01",
    });
    vi.mocked(prisma.tenant.findFirst).mockResolvedValue({
      plan: PlanName.STARTER,
    } as never);
  });

  it("retorna dados de uso para tenant STARTER autenticado", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.used).toBe(347);
    expect(body.limit).toBe(500);
    expect(body.resetDate).toBe("2026-06-01");
  });

  it("retorna 403 quando feature gate falha (plano FREE)", async () => {
    const { PlanFeatureError } = await import("@/shared/errors");
    vi.mocked(featureGuard.assertAccess).mockRejectedValue(
      new PlanFeatureError("whatsapp_basic", PlanName.STARTER),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });
});
