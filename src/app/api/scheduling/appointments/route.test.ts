import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));

const createAppointment = vi.fn();
vi.mock("@/domains/scheduling/scheduling.service", () => ({
  schedulingService: { createAppointment: (...a: unknown[]) => createAppointment(...a) },
}));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://x/api/scheduling/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  customerId: "ccustomer0000000000000001",
  serviceId: "cservice00000000000000001",
  startsAt: "2026-08-03T09:00:00.000Z",
};

describe("POST /api/scheduling/appointments — quem pode agendar em nome de quem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAppointment.mockResolvedValue({ id: "apt1" });
  });

  it("permite um profissional comum (sem agenda:edit) agendar pra si mesmo", async () => {
    const selfId = "11111111-1111-4111-8111-111111111111";
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: selfId, isOwner: false, permissions: { agenda: ["view", "create"] },
    });

    const res = await POST(makeRequest({ ...baseBody, professionalId: selfId }));

    expect(res.status).toBe(201);
    expect(createAppointment).toHaveBeenCalledTimes(1);
  });

  it("bloqueia profissional comum tentando agendar em nome de outro profissional", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "11111111-1111-4111-8111-111111111111", isOwner: false, permissions: { agenda: ["view", "create"] },
    });

    const res = await POST(makeRequest({
      ...baseBody,
      professionalId: "22222222-2222-4222-8222-222222222222",
    }));

    expect(res.status).toBe(403);
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("permite quem tem agenda:edit (gerente) agendar em nome de outro profissional", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "11111111-1111-4111-8111-111111111111", isOwner: false, permissions: { agenda: ["view", "create", "edit"] },
    });

    const res = await POST(makeRequest({
      ...baseBody,
      professionalId: "22222222-2222-4222-8222-222222222222",
    }));

    expect(res.status).toBe(201);
    expect(createAppointment).toHaveBeenCalledTimes(1);
  });

  it("permite o dono (isOwner) agendar em nome de outro profissional mesmo sem agenda:edit explícito", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "11111111-1111-4111-8111-111111111111", isOwner: true, permissions: {},
    });

    const res = await POST(makeRequest({
      ...baseBody,
      professionalId: "22222222-2222-4222-8222-222222222222",
    }));

    expect(res.status).toBe(201);
    expect(createAppointment).toHaveBeenCalledTimes(1);
  });
});
