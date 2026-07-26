import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({
  getSessionContext: (...args: unknown[]) => getSessionContext(...args),
}));

const remove = vi.fn();
vi.mock("@/domains/notifications/customer-messages/customer-message-template.repository", () => ({
  customerMessageTemplateRepository: {
    remove: (...args: unknown[]) => remove(...args),
  },
}));

import { DELETE } from "./route";

function makeSession(overrides: Partial<{ isOwner: boolean; permissions: Record<string, string[]> }> = {}) {
  return {
    tenantId: "t1",
    userId: "u1",
    isOwner: overrides.isOwner ?? false,
    permissions: overrides.permissions ?? { configuracoes: ["view", "edit"] },
  };
}

function makeParams(event: string, channel: string) {
  return { params: Promise.resolve({ event, channel }) };
}

describe("DELETE /api/notifications/customer-templates/[event]/[channel]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("apaga usando o tenantId da sessão, nunca algum valor vindo da URL", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    remove.mockResolvedValue(undefined);

    const res = await DELETE(
      new Request("http://localhost/api/notifications/customer-templates/birthday/WHATSAPP", {
        method: "DELETE",
      }),
      makeParams("birthday", "WHATSAPP"),
    );

    expect(res.status).toBe(204);
    expect(remove).toHaveBeenCalledWith("t1", "birthday", "WHATSAPP");
  });

  it("devolve 204 mesmo quando o tenant nunca personalizou aquele evento (restaurar padrão não falha)", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    // O repository já usa deleteMany por baixo dos panos — nunca lança quando não há registro.
    remove.mockResolvedValue(undefined);

    const res = await DELETE(
      new Request("http://localhost/api/notifications/customer-templates/winback/EMAIL", {
        method: "DELETE",
      }),
      makeParams("winback", "EMAIL"),
    );

    expect(res.status).toBe(204);
    expect(remove).toHaveBeenCalledWith("t1", "winback", "EMAIL");
  });

  it("422 quando event é inválido na URL", async () => {
    getSessionContext.mockResolvedValue(makeSession());

    const res = await DELETE(
      new Request("http://localhost/api/notifications/customer-templates/evento-invalido/WHATSAPP", {
        method: "DELETE",
      }),
      makeParams("evento-invalido", "WHATSAPP"),
    );

    expect(res.status).toBe(422);
    expect(remove).not.toHaveBeenCalled();
  });

  it("422 quando channel é inválido na URL", async () => {
    getSessionContext.mockResolvedValue(makeSession());

    const res = await DELETE(
      new Request("http://localhost/api/notifications/customer-templates/birthday/SMS", {
        method: "DELETE",
      }),
      makeParams("birthday", "SMS"),
    );

    expect(res.status).toBe(422);
    expect(remove).not.toHaveBeenCalled();
  });

  it("exige PERMISSIONS.settings.manage", async () => {
    getSessionContext.mockResolvedValue(makeSession({ permissions: { configuracoes: ["view"] } }));

    const res = await DELETE(
      new Request("http://localhost/api/notifications/customer-templates/birthday/WHATSAPP", {
        method: "DELETE",
      }),
      makeParams("birthday", "WHATSAPP"),
    );

    expect(res.status).toBe(403);
    expect(remove).not.toHaveBeenCalled();
  });
});
