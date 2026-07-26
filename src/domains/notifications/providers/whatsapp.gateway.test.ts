import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationChannel, NotificationStatus } from "@prisma/client";

vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertAccess: vi.fn() },
  FEATURES: { WHATSAPP_BASIC: "whatsapp_basic" },
}));

vi.mock("../quota/whatsapp-quota.service", () => ({
  whatsAppQuotaService: {
    checkAndIncrement: vi.fn(),
    decrement: vi.fn(),
  },
}));

vi.mock("./whatsapp.provider", () => ({
  twilioProvider: { send: vi.fn() },
  whatsAppProvider: { send: vi.fn() },
}));

vi.mock("./evolution.provider", () => ({
  evolutionProvider: { send: vi.fn() },
}));

const mockEnv = {
  WHATSAPP_PROVIDER: "twilio" as "evolution" | "twilio",
  EVOLUTION_API_URL: undefined as string | undefined,
};

vi.mock("@/shared/config/env", () => ({
  get env() { return mockEnv; },
}));

import { featureGuard } from "@/domains/billing/feature-guard";
import { whatsAppQuotaService } from "../quota/whatsapp-quota.service";
import { twilioProvider } from "./whatsapp.provider";
import { evolutionProvider } from "./evolution.provider";
import { customerMessageService } from "../customer-messages/customer-message.service";
import { WhatsAppGateway } from "./whatsapp.gateway";

const gateway = new WhatsAppGateway();

const mockDraft = {
  tenantId: "tenant-1",
  appointmentId: "appt-1",
  customerId: "cust-1",
  channel: NotificationChannel.WHATSAPP,
  template: "appointment-created",
  recipient: "11987654321",
  provider: "whatsapp",
  payload: { appointmentId: "appt-1", customerName: "João", serviceName: "Corte", startsAt: "2026-06-01T12:00:00Z" },
};

const mockTenant = {
  id: "tenant-1",
  name: "Barbearia",
  slug: "barbearia",
  timezone: "America/Sao_Paulo",
  whatsappEnabled: true,
  whatsappTemplateConfig: null,
  evolutionInstanceId: null,
  evolutionConnected: false,
  evolutionStatus: "DISCONNECTED",
  evolutionPhone: null,
};

describe("WhatsAppGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureGuard.assertAccess).mockResolvedValue(undefined);
    vi.mocked(whatsAppQuotaService.checkAndIncrement).mockResolvedValue(true);
    vi.mocked(whatsAppQuotaService.decrement).mockResolvedValue(undefined);
  });

  it("retorna FAILED quando plano não suporta WhatsApp", async () => {
    vi.mocked(featureGuard.assertAccess).mockRejectedValue(new Error("plano"));

    const result = await gateway.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(result.errorMessage).toContain("Plano não suporta");
  });

  it("retorna PENDING quando whatsappEnabled é false", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ ...mockTenant, whatsappEnabled: false } as never);

    const result = await gateway.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.PENDING);
  });

  it("retorna FAILED quando quota está esgotada", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    vi.mocked(whatsAppQuotaService.checkAndIncrement).mockResolvedValue(false);

    const result = await gateway.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(result.errorMessage).toContain("Limite mensal");
  });

  it("usa Twilio quando WHATSAPP_PROVIDER=twilio e retorna SENT", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    vi.mocked(twilioProvider.send).mockResolvedValue({ success: true, externalId: "SM123", provider: "twilio" });

    const result = await gateway.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.SENT);
    expect(result.provider).toBe("twilio");
    expect(twilioProvider.send).toHaveBeenCalledOnce();
  });

  it("decrementa quota e retorna FAILED quando Twilio falha", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    vi.mocked(twilioProvider.send).mockResolvedValue({ success: false, errorMessage: "Erro Twilio", provider: "twilio" });

    const result = await gateway.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(whatsAppQuotaService.decrement).toHaveBeenCalledWith("tenant-1");
  });

  it("usa Evolution quando o tenant está conectado, mesmo com WHATSAPP_PROVIDER=twilio (default)", async () => {
    // Regressão: o default de WHATSAPP_PROVIDER era "twilio", fazendo a Evolution
    // NUNCA ser tentada — as mensagens iam pro Twilio (não configurado) e falhavam.
    // Agora o roteamento é pela conexão do tenant, não pelo env global.
    mockEnv.WHATSAPP_PROVIDER = "twilio";
    mockEnv.EVOLUTION_API_URL = "https://evolution.example.com";

    const tenant = {
      ...mockTenant,
      evolutionConnected: true,
      evolutionStatus: "CONNECTED",
      evolutionInstanceId: "tenant-1",
    };
    prismaMock.tenant.findFirst.mockResolvedValue(tenant as never);

    const { evolutionProvider } = await import("./evolution.provider");
    vi.mocked(evolutionProvider.send).mockResolvedValue({ success: true, externalId: "EVO-1", provider: "evolution" });

    const result = await gateway.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.SENT);
    expect(result.provider).toBe("evolution");
    expect(result.externalId).toBe("EVO-1");
    expect(evolutionProvider.send).toHaveBeenCalledOnce();
    expect(twilioProvider.send).not.toHaveBeenCalled();

    mockEnv.EVOLUTION_API_URL = undefined;
  });

  it("não usa Evolution quando o tenant não está conectado (cai no Twilio)", async () => {
    mockEnv.EVOLUTION_API_URL = "https://evolution.example.com";
    // tenant padrão tem evolutionConnected=false / status DISCONNECTED
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    vi.mocked(twilioProvider.send).mockResolvedValue({ success: true, externalId: "SM-x", provider: "twilio" });

    const { evolutionProvider } = await import("./evolution.provider");

    const result = await gateway.send(mockDraft);

    expect(result.provider).toBe("twilio");
    expect(evolutionProvider.send).not.toHaveBeenCalled();

    mockEnv.EVOLUTION_API_URL = undefined;
  });

  it("usa fallback Twilio quando Evolution falha e registra provider evolution→twilio", async () => {
    mockEnv.WHATSAPP_PROVIDER = "evolution";
    mockEnv.EVOLUTION_API_URL = "https://evolution.example.com";

    const tenant = {
      ...mockTenant,
      evolutionConnected: true,
      evolutionStatus: "CONNECTED",
      evolutionInstanceId: "tenant-1",
    };
    prismaMock.tenant.findFirst.mockResolvedValue(tenant as never);

    const { evolutionProvider } = await import("./evolution.provider");
    vi.mocked(evolutionProvider.send).mockResolvedValue({ success: false, errorMessage: "Timeout", provider: "evolution" });
    vi.mocked(twilioProvider.send).mockResolvedValue({ success: true, externalId: "SM-fallback", provider: "twilio" });

    const result = await gateway.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.SENT);
    expect(result.provider).toBe("evolution→twilio");
    expect(result.externalId).toBe("SM-fallback");

    // Restaurar
    mockEnv.WHATSAPP_PROVIDER = "twilio";
    mockEnv.EVOLUTION_API_URL = undefined;
  });

  it("renderiza pelo service e repassa o texto ao provider", async () => {
    mockEnv.EVOLUTION_API_URL = "https://evolution.example.com";
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo",
      phone: null, address: null, whatsappEnabled: true, whatsappTemplateConfig: null,
      evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null,
    } as never);

    const renderSpy = vi.spyOn(customerMessageService, "render").mockResolvedValue({
      subject: null, text: "Renderizado!", mediaUrl: null,
    });
    const sendSpy = vi.spyOn(evolutionProvider, "send").mockResolvedValue({ success: true, provider: "evolution" });

    await gateway.send({
      tenantId: "t1", channel: "WHATSAPP", template: "appointment-created",
      recipient: "11999990000", payload: { customerName: "Maria", serviceName: "Escova", startsAt: "2026-08-02T17:00:00.000Z" },
    } as never);

    expect(renderSpy).toHaveBeenCalledWith("t1", "appointment_created", "WHATSAPP", expect.objectContaining({ customerName: "Maria" }));
    expect(sendSpy.mock.calls[0][2]).toEqual({ subject: null, text: "Renderizado!", mediaUrl: null });

    mockEnv.EVOLUTION_API_URL = undefined;
  });

  it("mensagem pontual do modal tem precedência sobre o template", async () => {
    mockEnv.EVOLUTION_API_URL = "https://evolution.example.com";
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo",
      phone: null, address: null, whatsappEnabled: true, whatsappTemplateConfig: null,
      evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null,
    } as never);

    const renderSpy = vi.spyOn(customerMessageService, "render");
    const sendSpy = vi.spyOn(evolutionProvider, "send").mockResolvedValue({ success: true, provider: "evolution" });

    await gateway.send({
      tenantId: "t1", channel: "WHATSAPP", template: "appointment-cancelled",
      recipient: "11999990000", payload: { customerName: "Maria", serviceName: "Escova", message: "Texto escrito na hora" },
    } as never);

    expect(renderSpy).not.toHaveBeenCalled();
    expect(sendSpy.mock.calls[0][2].text).toBe("Texto escrito na hora");

    mockEnv.EVOLUTION_API_URL = undefined;
  });

  it("template desconhecido falha com erro claro em vez de enviar texto vazio", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo",
      phone: null, address: null, whatsappEnabled: true, whatsappTemplateConfig: null,
      evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null,
    } as never);

    const resultado = await gateway.send({
      tenantId: "t1", channel: "WHATSAPP", template: "template-que-nao-existe",
      recipient: "11999990000", payload: { customerName: "Maria" },
    } as never);

    expect(resultado.status).toBe("FAILED");
    expect(resultado.errorMessage).toContain("template-que-nao-existe");
    expect(whatsAppQuotaService.decrement).toHaveBeenCalledWith("t1");
  });
});
