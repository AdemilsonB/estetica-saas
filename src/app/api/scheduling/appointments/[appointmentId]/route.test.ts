import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));

const updateAppointment = vi.fn();
vi.mock("@/domains/scheduling/scheduling.service", () => ({
  schedulingService: { updateAppointment: (...a: unknown[]) => updateAppointment(...a) },
}));

import { PATCH } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://x/api/scheduling/appointments/appt-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext() {
  return { params: Promise.resolve({ appointmentId: "appt-1" }) };
}

describe("PATCH /api/scheduling/appointments/[appointmentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateAppointment.mockResolvedValue({ id: "appt-1", notes: "Aguardando pagamento" });
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { agenda: ["view", "edit"] },
    });
  });

  it("retorna 403 sem permissão agenda:edit", async () => {
    getSessionContext.mockResolvedValue({
      tenantId: "t1", userId: "u1", isOwner: false, permissions: { agenda: ["view"] },
    });

    const res = await PATCH(makeRequest({ notes: "x" }), makeContext());

    expect(res.status).toBe(403);
    expect(updateAppointment).not.toHaveBeenCalled();
  });

  it("retorna 422 quando nenhum campo é enviado", async () => {
    const res = await PATCH(makeRequest({}), makeContext());

    expect(res.status).toBe(422);
    expect(updateAppointment).not.toHaveBeenCalled();
  });

  it("permite atualizar só a observação (notes)", async () => {
    const res = await PATCH(makeRequest({ notes: "Aguardando pagamento" }), makeContext());

    expect(res.status).toBe(200);
    expect(updateAppointment).toHaveBeenCalledWith(
      "t1",
      "appt-1",
      expect.objectContaining({ notes: "Aguardando pagamento" }),
    );
  });
});
