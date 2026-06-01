import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationChannel } from "@prisma/client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/shared/config/env", () => ({
  env: {
    EVOLUTION_API_URL: "https://evolution.example.com",
    EVOLUTION_API_KEY: "test-key",
  },
}));

import { EvolutionProvider } from "./evolution.provider";
import type { TenantWhatsAppConfig } from "./whatsapp-provider.interface";

const provider = new EvolutionProvider();

const mockDraft = {
  tenantId: "tenant-1",
  appointmentId: "appt-1",
  customerId: "cust-1",
  channel: NotificationChannel.WHATSAPP,
  template: "appointment-created",
  recipient: "11987654321",
  provider: "whatsapp",
  payload: {
    appointmentId: "appt-1",
    customerName: "João Silva",
    serviceName: "Corte",
    startsAt: "2026-06-01T12:00:00.000Z",
  },
};

const mockTenant: TenantWhatsAppConfig = {
  id: "tenant-1",
  name: "Barbearia Silva",
  slug: "barbearia-silva",
  timezone: "America/Sao_Paulo",
  whatsappEnabled: true,
  whatsappTemplateConfig: null,
  evolutionInstanceId: "tenant-1",
  evolutionConnected: true,
  evolutionStatus: "CONNECTED",
  evolutionPhone: "+5511999999999",
};

describe("EvolutionProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("envia mensagem e retorna success=true com externalId", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: { id: "EVO-MSG-001" } }),
    });

    const result = await provider.send(mockDraft, mockTenant);

    expect(result.success).toBe(true);
    expect(result.externalId).toBe("EVO-MSG-001");
    expect(result.provider).toBe("evolution");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("chama Evolution API com número sem prefixo + e URL correta", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: { id: "EVO-001" } }),
    });

    await provider.send(mockDraft, mockTenant);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/message/sendText/tenant-1");
    const body = JSON.parse(options.body);
    expect(body.number).toBe("5511987654321");
    expect(body.text).toContain("João Silva");
  });

  it("retorna success=false quando Evolution API retorna erro 5xx", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const result = await provider.send(mockDraft, mockTenant);

    expect(result.success).toBe(false);
    expect(result.provider).toBe("evolution");
  });

  it("retorna success=false para telefone inválido (< 10 dígitos)", async () => {
    const result = await provider.send({ ...mockDraft, recipient: "123" }, mockTenant);

    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("retorna success=false quando evolutionInstanceId é null", async () => {
    const tenantSemInstancia = { ...mockTenant, evolutionInstanceId: null };
    const result = await provider.send(mockDraft, tenantSemInstancia);

    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("getStatus retorna CONNECTED quando Evolution API retorna state=open", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ instance: { instanceName: "tenant-1", state: "open" } }),
    });

    const state = await provider.getStatus("tenant-1");

    expect(state).toBe("CONNECTED");
  });

  it("getStatus retorna CONNECTING quando state=connecting", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ instance: { instanceName: "tenant-1", state: "connecting" } }),
    });

    const state = await provider.getStatus("tenant-1");

    expect(state).toBe("CONNECTING");
  });

  it("getStatus retorna ERROR quando fetch falha", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const state = await provider.getStatus("tenant-1");

    expect(state).toBe("ERROR");
  });

  it("getQrCode retorna base64 do QR Code", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ base64: "data:image/png;base64,ABCDEF" }),
    });

    const qr = await provider.getQrCode("tenant-1");

    expect(qr).toBe("data:image/png;base64,ABCDEF");
  });

  it("mensagem de appointment-created contém data, hora e link", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: { id: "EVO-002" } }),
    });

    await provider.send(mockDraft, mockTenant);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // 2026-06-01T12:00:00Z em São Paulo = 09:00 UTC-3
    expect(body.text).toContain("01/06/2026");
    expect(body.text).toContain("Barbearia Silva");
    expect(body.text).toContain("/agendar/barbearia-silva");
  });
});
