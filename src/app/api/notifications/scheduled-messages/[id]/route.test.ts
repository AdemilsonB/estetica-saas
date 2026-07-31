import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: vi.fn() }));
vi.mock("@/shared/auth/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/domains/notifications/scheduled-messages/scheduled-message.service", () => ({
  scheduledMessageService: { update: vi.fn(), cancel: vi.fn() },
}));

import { getSessionContext } from "@/shared/auth/session";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";
import { ScheduledMessageNotEditableError } from "@/shared/errors";

import { DELETE, PATCH } from "./route";

const session = vi.mocked(getSessionContext);
const service = vi.mocked(scheduledMessageService);

function sessaoCom(permissions: Record<string, string[]>) {
  session.mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-1",
    isOwner: false,
    permissions,
  } as unknown as Awaited<ReturnType<typeof getSessionContext>>);
}

const params = Promise.resolve({ id: "sm-1" });

describe("/api/notifications/scheduled-messages/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoCom({ clientes: ["view", "edit"] });
  });

  it("PATCH edita com o tenantId da sessão e devolve 204", async () => {
    service.update.mockResolvedValue(undefined);

    const res = await PATCH(
      new Request("http://localhost/api/notifications/scheduled-messages/sm-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Novo texto", date: "2099-01-01", time: "09:00" }),
      }),
      { params },
    );

    expect(res.status).toBe(204);
    expect(service.update).toHaveBeenCalledWith("tenant-1", "sm-1", {
      body: "Novo texto",
      date: "2099-01-01",
      time: "09:00",
    });
  });

  it("PATCH em mensagem já enviada vira 409, não 500", async () => {
    service.update.mockRejectedValue(new ScheduledMessageNotEditableError("SENT"));

    const res = await PATCH(
      new Request("http://localhost/api/notifications/scheduled-messages/sm-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Novo texto", date: "2099-01-01", time: "09:00" }),
      }),
      { params },
    );

    expect(res.status).toBe(409);
  });

  it("DELETE cancela e devolve 204", async () => {
    service.cancel.mockResolvedValue(undefined);

    const res = await DELETE(
      new Request("http://localhost/api/notifications/scheduled-messages/sm-1", {
        method: "DELETE",
      }),
      { params },
    );

    expect(res.status).toBe(204);
    expect(service.cancel).toHaveBeenCalledWith("tenant-1", "sm-1");
  });

  it("DELETE exige clientes:edit", async () => {
    sessaoCom({ clientes: ["view"] });

    const res = await DELETE(
      new Request("http://localhost/api/notifications/scheduled-messages/sm-1", {
        method: "DELETE",
      }),
      { params },
    );

    expect(res.status).toBe(403);
    expect(service.cancel).not.toHaveBeenCalled();
  });
});
