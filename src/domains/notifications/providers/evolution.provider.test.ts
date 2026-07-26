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
import { EvolutionInstanceExistsError } from "@/shared/errors";
import type { TenantWhatsAppConfig } from "./whatsapp-provider.interface";
import type { RenderedCustomerMessage } from "../customer-messages/types";

const provider = new EvolutionProvider();

const mockRendered: RenderedCustomerMessage = {
  subject: null,
  text: "Texto pronto do template",
  mediaUrl: null,
};

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

    const result = await provider.send(mockDraft, mockTenant, mockRendered);

    expect(result.success).toBe(true);
    expect(result.externalId).toBe("EVO-MSG-001");
    expect(result.provider).toBe("evolution");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("envia o texto já renderizado, sem montar mensagem", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: { id: "MSG1" } }),
    });

    const resultado = await provider.send(
      { tenantId: "t1", channel: "WHATSAPP", template: "appointment-created", recipient: "11999990000", payload: {} },
      { id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo", whatsappEnabled: true, whatsappTemplateConfig: null, evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null },
      { subject: null, text: "Texto pronto do template", mediaUrl: null },
    );

    expect(resultado.success).toBe(true);
    const corpo = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(corpo.text).toBe("Texto pronto do template");
    expect(corpo.number).toBe("5511999990000");
  });

  it("usa sendMedia com legenda quando há mediaUrl", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: { id: "MSG2" } }),
    });

    await provider.send(
      { tenantId: "t1", channel: "WHATSAPP", template: "birthday", recipient: "11999990000", payload: {} },
      { id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo", whatsappEnabled: true, whatsappTemplateConfig: null, evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null },
      { subject: null, text: "Parabéns!", mediaUrl: "https://cdn.exemplo/banner.png" },
    );

    expect(String(mockFetch.mock.calls[0][0])).toContain("/message/sendMedia/inst-1");
    const corpo = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(corpo.caption).toBe("Parabéns!");
    expect(corpo.media).toBe("https://cdn.exemplo/banner.png");
  });

  it("retorna success=false quando Evolution API retorna erro 5xx", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const result = await provider.send(mockDraft, mockTenant, mockRendered);

    expect(result.success).toBe(false);
    expect(result.provider).toBe("evolution");
  });

  it("retorna success=false para telefone inválido (< 10 dígitos)", async () => {
    const result = await provider.send({ ...mockDraft, recipient: "123" }, mockTenant, mockRendered);

    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("retorna success=false quando evolutionInstanceId é null", async () => {
    const tenantSemInstancia = { ...mockTenant, evolutionInstanceId: null };
    const result = await provider.send(mockDraft, tenantSemInstancia, mockRendered);

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

  it("getConnectedPhone extrai o número do ownerJid e formata com +55", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ ownerJid: "5511987654321@s.whatsapp.net" }],
    });

    const phone = await provider.getConnectedPhone("tenant-1");

    expect(phone).toBe("+5511987654321");
  });

  it("getConnectedPhone acrescenta +55 quando o número vem sem DDI", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ owner: "11987654321" }],
    });

    const phone = await provider.getConnectedPhone("tenant-1");

    expect(phone).toBe("+5511987654321");
  });

  it("getConnectedPhone retorna null quando não há número (tolera falha)", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{}] });

    const phone = await provider.getConnectedPhone("tenant-1");

    expect(phone).toBeNull();
  });

  it("createInstance registra o webhook inline no corpo do create (formato v2)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ qrcode: { base64: "data:image/png;base64,QR" } }),
    });

    const { qrCode } = await provider.createInstance("tenant-1", {
      url: "https://app.example.com/api/webhooks/evolution?token=abc",
      events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
    });

    expect(qrCode).toBe("data:image/png;base64,QR");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/instance/create");
    const body = JSON.parse(options.body);
    expect(body.webhook).toEqual({
      url: "https://app.example.com/api/webhooks/evolution?token=abc",
      byEvents: false,
      base64: false,
      events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
    });
  });

  it("createInstance não envia webhook quando não fornecido", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ qrcode: { base64: "qr" } }),
    });

    await provider.createInstance("tenant-1");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.webhook).toBeUndefined();
  });

  it("createInstance com 403 'already in use' exclui a instância órfã e tenta de novo", async () => {
    const forbidden = {
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({ status: 403, error: "Forbidden", response: { message: ['This name "tenant-1" is already in use.'] } }),
    };
    mockFetch
      .mockResolvedValueOnce(forbidden) // create → 403 already in use
      .mockResolvedValueOnce({ ok: true }) // logout
      .mockResolvedValueOnce({ ok: true }) // delete
      .mockResolvedValueOnce({ ok: true, json: async () => ({ qrcode: { base64: "qr-novo" } }) }); // retry create

    const { qrCode } = await provider.createInstance("tenant-1");

    expect(qrCode).toBe("qr-novo");
    const urls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("/instance/create");
    expect(urls[1]).toContain("/instance/logout/tenant-1");
    expect(urls[2]).toContain("/instance/delete/tenant-1");
    expect(urls[3]).toContain("/instance/create");
  });

  it("createInstance lança EvolutionInstanceExistsError quando o 403 persiste após retry", async () => {
    const forbidden = {
      ok: false,
      status: 403,
      text: async () => 'This name "tenant-1" is already in use.',
    };
    mockFetch
      .mockResolvedValueOnce(forbidden) // create
      .mockResolvedValueOnce({ ok: true }) // logout
      .mockResolvedValueOnce({ ok: true }) // delete
      .mockResolvedValueOnce(forbidden); // retry create → ainda em uso

    await expect(provider.createInstance("tenant-1")).rejects.toBeInstanceOf(EvolutionInstanceExistsError);
  });

  it("createInstance inclui status e corpo da resposta no erro genérico", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(provider.createInstance("tenant-1")).rejects.toThrow(/401.*Unauthorized/);
  });

  it("deleteInstance faz logout antes do delete", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await provider.deleteInstance("tenant-1");

    const urls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("/instance/logout/tenant-1");
    expect(urls[1]).toContain("/instance/delete/tenant-1");
  });

  it("deleteInstance tolera 404 (instância já não existe)", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" }) // logout
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "not found" }); // delete

    await expect(provider.deleteInstance("tenant-1")).resolves.toBeUndefined();
  });

  it("deleteInstance lança erro quando o delete falha de verdade", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true }) // logout
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "erro" }); // delete

    await expect(provider.deleteInstance("tenant-1")).rejects.toThrow(/400/);
  });

});
