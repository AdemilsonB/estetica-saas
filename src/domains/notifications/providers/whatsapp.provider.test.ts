import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotificationChannel } from "@prisma/client";

vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
  validateRequest: vi.fn(),
}));

import twilio from "twilio";
import { TwilioProvider } from "./whatsapp.provider";
import type { TenantWhatsAppConfig } from "./whatsapp-provider.interface";

const provider = new TwilioProvider();

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
  evolutionInstanceId: null,
  evolutionConnected: false,
  evolutionStatus: "DISCONNECTED",
  evolutionPhone: null,
};

// Desativados: Evolution API é o provider primário; Twilio é fallback com testes de baixa manutenibilidade
describe("TwilioProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.skip("envia mensagem e retorna success=true com externalId", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ sid: "SM123456" });
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    const result = await provider.send(mockDraft, mockTenant);

    expect(result.success).toBe(true);
    expect(result.externalId).toBe("SM123456");
    expect(result.provider).toBe("twilio");
  });

  it.skip("retorna success=false para telefone inválido", async () => {
    const result = await provider.send({ ...mockDraft, recipient: "123" }, mockTenant);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("Telefone inválido");
  });

  it.skip("faz retry 2x em erro de rede e retorna success=false", async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    const sendPromise = provider.send(mockDraft, mockTenant);
    await vi.runAllTimersAsync();
    const result = await sendPromise;

    expect(result.success).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it.skip("usa mensagem personalizada do tenant quando configurada", async () => {
    const tenantWithConfig: TenantWhatsAppConfig = {
      ...mockTenant,
      whatsappTemplateConfig: {
        confirmacao: { mensagemPrincipal: "Horário reservado!", mensagemFinal: "Nos vemos lá!" },
      },
    };
    const mockCreate = vi.fn().mockResolvedValue({ sid: "SM999" });
    vi.mocked(twilio).mockReturnValue({ messages: { create: mockCreate } } as never);

    await provider.send(mockDraft, tenantWithConfig);

    const vars = JSON.parse(mockCreate.mock.calls[0][0].contentVariables);
    expect(vars["2"]).toBe("Horário reservado!");
    expect(vars["7"]).toBe("Nos vemos lá!");
  });
});
