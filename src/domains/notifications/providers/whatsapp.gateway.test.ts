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
});
