import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationChannel, NotificationStatus } from "@prisma/client";

vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
  validateRequest: vi.fn(),
}));

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

import twilio from "twilio";
import { featureGuard } from "@/domains/billing/feature-guard";
import { whatsAppQuotaService } from "../quota/whatsapp-quota.service";
import { WhatsAppProvider } from "./whatsapp.provider";

const provider = new WhatsAppProvider();

const mockDraft = {
  tenantId: "tenant-1",
  appointmentId: "appt-1",
  customerId: "cust-1",
  channel: NotificationChannel.WHATSAPP,
  template: "appointment-created",
  recipient: "11987654321",
  provider: "twilio",
  payload: {
    appointmentId: "appt-1",
    customerName: "João Silva",
    serviceName: "Corte",
    startsAt: "2026-06-01T12:00:00.000Z",
  },
};

const mockTenant = {
  whatsappEnabled: true,
  name: "Barbearia Silva",
  slug: "barbearia-silva",
  timezone: "America/Sao_Paulo",
  whatsappTemplateConfig: null,
};

describe("WhatsAppProvider", () => {
  beforeEach(() => {
    vi.mocked(featureGuard.assertAccess).mockResolvedValue(undefined);
    vi.mocked(whatsAppQuotaService.checkAndIncrement).mockResolvedValue(true);
    vi.mocked(whatsAppQuotaService.decrement).mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("envia mensagem e retorna SENT com externalId", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    const mockCreate = vi.fn().mockResolvedValue({ sid: "SM123456" });
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    const result = await provider.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.SENT);
    expect(result.externalId).toBe("SM123456");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("retorna PENDING quando whatsappEnabled é false", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(
      { ...mockTenant, whatsappEnabled: false } as never,
    );

    const result = await provider.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.PENDING);
  });

  it("retorna FAILED para telefone inválido (< 10 dígitos)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);

    const result = await provider.send({ ...mockDraft, recipient: "123" });

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(result.errorMessage).toContain("Telefone inválido");
  });

  it("retorna FAILED quando quota está esgotada", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    vi.mocked(whatsAppQuotaService.checkAndIncrement).mockResolvedValue(false);

    const result = await provider.send(mockDraft);

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(result.errorMessage).toContain("Limite mensal");
  });

  it("faz retry 2x em erro de rede, reverte quota e retorna FAILED", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    const mockCreate = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    // Dispara o send e avança os timers fake para cada delay de retry
    const sendPromise = provider.send(mockDraft);
    // Avança todos os timers pendentes (2 retries × 1000ms)
    await vi.runAllTimersAsync();
    const result = await sendPromise;

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(mockCreate).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    expect(whatsAppQuotaService.decrement).toHaveBeenCalledWith("tenant-1");
  });

  it("usa mensagem personalizada do tenant quando configurada", async () => {
    const tenantWithConfig = {
      ...mockTenant,
      whatsappTemplateConfig: {
        confirmacao: {
          mensagemPrincipal: "Seu horário foi reservado!",
          mensagemFinal: "Nos vemos lá!",
        },
      },
    };
    prismaMock.tenant.findFirst.mockResolvedValue(tenantWithConfig as never);
    const mockCreate = vi.fn().mockResolvedValue({ sid: "SM999" });
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    await provider.send(mockDraft);

    const callArg = mockCreate.mock.calls[0][0];
    const vars = JSON.parse(callArg.contentVariables);
    expect(vars["2"]).toBe("Seu horário foi reservado!");
    expect(vars["7"]).toBe("Nos vemos lá!");
  });

  it("não acessa startsAt para template appointment-cancelled", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
    const mockCreate = vi.fn().mockResolvedValue({ sid: "SM777" });
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    const cancelledDraft = {
      ...mockDraft,
      template: "appointment-cancelled",
      payload: {
        appointmentId: "appt-1",
        customerName: "João Silva",
        serviceName: "Corte",
        status: "CANCELLED",
        // startsAt AUSENTE — intencional
      },
    };

    const result = await provider.send(cancelledDraft);

    expect(result.status).toBe(NotificationStatus.SENT);
  });
});
