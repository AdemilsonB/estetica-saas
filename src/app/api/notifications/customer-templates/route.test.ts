import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({
  getSessionContext: (...args: unknown[]) => getSessionContext(...args),
}));

const listByTenant = vi.fn();
const upsert = vi.fn();
vi.mock("@/domains/notifications/customer-messages/customer-message-template.repository", () => ({
  customerMessageTemplateRepository: {
    listByTenant: (...args: unknown[]) => listByTenant(...args),
    upsert: (...args: unknown[]) => upsert(...args),
  },
}));

import { GET, PUT } from "./route";

function makeSession(overrides: Partial<{ isOwner: boolean; permissions: Record<string, string[]> }> = {}) {
  return {
    tenantId: "t1",
    userId: "u1",
    isOwner: overrides.isOwner ?? false,
    permissions: overrides.permissions ?? { configuracoes: ["view", "edit"] },
  };
}

describe("GET /api/notifications/customer-templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve o catálogo com a personalização aplicada", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    listByTenant.mockResolvedValue([
      { event: "birthday", channel: "WHATSAPP", subject: null, body: "Meu texto", mediaUrl: null },
    ]);

    const res = await GET(new Request("http://localhost/api/notifications/customer-templates"));
    const json = await res.json();

    expect(res.status).toBe(200);

    const aniversario = json.items.find(
      (i: { event: string; channel: string }) => i.event === "birthday" && i.channel === "WHATSAPP",
    );
    expect(aniversario.isCustom).toBe(true);
    expect(aniversario.body).toBe("Meu texto");
    expect(aniversario.defaultBody).not.toBe("Meu texto");

    const criado = json.items.find(
      (i: { event: string; channel: string }) => i.event === "appointment_created" && i.channel === "WHATSAPP",
    );
    expect(criado.isCustom).toBe(false);
    expect(criado.variables).toContain("cliente");
  });

  it("retorna todos os eventos do catálogo × os 2 canais, mesmo sem nenhuma personalização", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    listByTenant.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/notifications/customer-templates"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items.every((i: { isCustom: boolean }) => i.isCustom === false)).toBe(true);
    // 10 eventos do catálogo × 2 canais (WHATSAPP/EMAIL).
    expect(json.items).toHaveLength(20);
  });
});

describe("PUT /api/notifications/customer-templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita corpo vazio", async () => {
    getSessionContext.mockResolvedValue(makeSession());

    const res = await PUT(
      new Request("http://localhost/api/notifications/customer-templates", {
        method: "PUT",
        body: JSON.stringify({ event: "birthday", channel: "WHATSAPP", subject: null, body: "", mediaUrl: null }),
      }),
    );

    // ValidationError do projeto responde 422 (ver src/shared/errors/domain-error.ts),
    // não 400 — mantendo o padrão usado em todas as outras rotas de notifications.
    expect(res.status).toBe(422);
  });

  it("nunca aceita tenantId vindo do body", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    upsert.mockResolvedValue({
      event: "birthday",
      channel: "WHATSAPP",
      subject: null,
      body: "Oi",
      mediaUrl: null,
    });

    await PUT(
      new Request("http://localhost/api/notifications/customer-templates", {
        method: "PUT",
        body: JSON.stringify({
          tenantId: "tenant-invasor",
          event: "birthday",
          channel: "WHATSAPP",
          subject: null,
          body: "Oi",
          mediaUrl: null,
        }),
      }),
    );

    expect(upsert).toHaveBeenCalledWith("t1", {
      event: "birthday",
      channel: "WHATSAPP",
      subject: null,
      body: "Oi",
      mediaUrl: null,
    });
  });

  it("403 sem permissão settings:manage", async () => {
    getSessionContext.mockResolvedValue(makeSession({ permissions: { configuracoes: ["view"] } }));

    const res = await PUT(
      new Request("http://localhost/api/notifications/customer-templates", {
        method: "PUT",
        body: JSON.stringify({ event: "birthday", channel: "WHATSAPP", subject: null, body: "Oi", mediaUrl: null }),
      }),
    );

    expect(res.status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });
});
