import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertAccess: vi.fn() },
  FEATURES: { WHATSAPP_BASIC: "whatsapp_basic" },
}));

import { featureGuard } from "@/domains/billing/feature-guard";

import { customerMessageBlockedReason } from "./customer-message-delivery";

const guard = vi.mocked(featureGuard);

const TENANT_PRONTO = {
  whatsappEnabled: true,
  evolutionConnected: true,
  evolutionStatus: "CONNECTED",
};

describe("customerMessageBlockedReason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.assertAccess.mockResolvedValue(undefined as never);
  });

  it("devolve null quando tudo está pronto para o WhatsApp sair", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP"],
      cliente: { phone: "11999990000", email: null },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBeNull();
  });

  it("aponta o cliente sem telefone", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP"],
      cliente: { phone: null, email: null },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBe("Este cliente não tem telefone cadastrado.");
  });

  it("aponta o plano sem WhatsApp", async () => {
    guard.assertAccess.mockRejectedValue(new Error("sem acesso"));

    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP"],
      cliente: { phone: "11999990000", email: null },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBe("Seu plano não inclui o envio de WhatsApp.");
  });

  it("aponta o WhatsApp desconectado", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP"],
      cliente: { phone: "11999990000", email: null },
      tenant: { ...TENANT_PRONTO, evolutionStatus: "DISCONNECTED" },
    });

    expect(motivo).toBe("O WhatsApp do seu negócio não está conectado.");
  });

  it("não bloqueia quando o e-mail salva a entrega, mesmo com o WhatsApp travado", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP", "EMAIL"],
      cliente: { phone: null, email: "maria@exemplo.com" },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBeNull();
  });

  it("bloqueia quando nenhum canal está ligado", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: [],
      cliente: { phone: "11999990000", email: "maria@exemplo.com" },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBe("Nenhum canal está ligado para este aviso nas configurações.");
  });
});
