import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));

const snoozeCompletion = vi.fn();
vi.mock("@/domains/scheduling/scheduling.service", () => ({
  schedulingService: { snoozeCompletion: (...a: unknown[]) => snoozeCompletion(...a) },
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://x/api/scheduling/appointments/appt-1/snooze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext() {
  return { params: Promise.resolve({ appointmentId: "appt-1" }) };
}

describe("POST /api/scheduling/appointments/[appointmentId]/snooze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snoozeCompletion.mockResolvedValue({ id: "appt-1", completionSnoozedUntil: new Date() });
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { agenda: ["view", "edit"] },
    });
  });

  it("retorna 403 sem permissão agenda:edit", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { agenda: ["view"] },
    });

    const res = await POST(makeRequest({ days: 3 }), makeContext());

    expect(res.status).toBe(403);
    expect(snoozeCompletion).not.toHaveBeenCalled();
  });

  it("retorna 422 quando days não é 1, 3 ou 7", async () => {
    const res = await POST(makeRequest({ days: 5 }), makeContext());

    expect(res.status).toBe(422);
    expect(snoozeCompletion).not.toHaveBeenCalled();
  });

  it("chama o service com tenantId, appointmentId e days válidos", async () => {
    const res = await POST(makeRequest({ days: 7 }), makeContext());

    expect(res.status).toBe(200);
    expect(snoozeCompletion).toHaveBeenCalledWith("t1", "appt-1", 7);
  });
});
