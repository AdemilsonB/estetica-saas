import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";

import { PATCH } from "./route";

vi.mock("@/shared/auth/public-session", () => ({
  COOKIE_NAME: "sessao",
  verifyPublicSession: () => ({ tenantId: "t1", customerId: "c1" }),
}));

vi.mock("@/domains/scheduling/public-booking.repository", () => ({
  publicBookingRepository: { findTenantBySlug: async () => ({ id: "t1" }) },
}));

const prismaMock = prisma as unknown as {
  customer: { update: ReturnType<typeof vi.fn> };
};

function requisicao(body: Record<string, unknown>) {
  return new Request("https://app.test/api/public/salao/me", {
    method: "PATCH",
    headers: { cookie: "sessao=x" },
    body: JSON.stringify(body),
  });
}

const contexto = { params: Promise.resolve({ slug: "salao" }) };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.customer = {
    update: vi
      .fn()
      .mockResolvedValue({ id: "c1", name: "Maria", phone: null, email: null }),
  };
});

describe("PATCH /me — preferência de marketing", () => {
  it("aceita uma requisição que só desliga a preferência", async () => {
    // REGRESSÃO: o `.refine` original era `d.phone ?? d.email`. Um booleano `false`
    // é falsy, então o pedido legítimo de DESLIGAR cairia em 422 — o cliente
    // clicaria em desligar e receberia erro.
    const res = await PATCH(requisicao({ aceitaPromocoes: false }), contexto);
    expect(res.status).toBe(200);
  });

  it("ligar grava consentimento com trilha e limpa o opt-out", async () => {
    await PATCH(requisicao({ aceitaPromocoes: true }), contexto);

    const data = prismaMock.customer.update.mock.calls[0][0].data;
    expect(data.consentGiven).toBe(true);
    expect(data.consentDate).toBeInstanceOf(Date);
    expect(data.consentOrigin).toBe("portal");
    expect(data.marketingOptOut).toBe(false);
    expect(data.marketingOptOutAt).toBeNull();
  });

  it("desligar registra opt-out com data e origem", async () => {
    await PATCH(requisicao({ aceitaPromocoes: false }), contexto);

    const data = prismaMock.customer.update.mock.calls[0][0].data;
    expect(data.marketingOptOut).toBe(true);
    expect(data.marketingOptOutOrigin).toBe("portal");
    expect(data.marketingOptOutAt).toBeInstanceOf(Date);
  });

  it("desligar NÃO apaga o consentimento de cadastro", async () => {
    // São coisas diferentes: o consentimento continua registrado, o opt-out é o
    // pedido posterior. Zerar os dois apagaria a trilha de que houve consentimento.
    await PATCH(requisicao({ aceitaPromocoes: false }), contexto);

    const data = prismaMock.customer.update.mock.calls[0][0].data;
    expect(data.consentGiven).toBeUndefined();
    expect(data.consentDate).toBeUndefined();
  });

  it("filtra o update pelo tenant da sessão, nunca do corpo", async () => {
    await PATCH(requisicao({ aceitaPromocoes: true, tenantId: "OUTRO" }), contexto);

    const where = prismaMock.customer.update.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
    expect(where.id).toBe("c1");
  });

  it("continua aceitando telefone sozinho, como antes", async () => {
    const res = await PATCH(requisicao({ phone: "11988887777" }), contexto);

    expect(res.status).toBe(200);
    const data = prismaMock.customer.update.mock.calls[0][0].data;
    expect(data.phone).toBe("11988887777");
    // Sem `aceitaPromocoes` no corpo, nada de consentimento é tocado.
    expect(data.marketingOptOut).toBeUndefined();
  });

  it("rejeita corpo vazio", async () => {
    const res = await PATCH(requisicao({}), contexto);
    expect(res.status).toBe(422);
  });
});
