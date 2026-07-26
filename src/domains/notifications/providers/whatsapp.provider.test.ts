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

  it("envia o texto renderizado como body, sem contentSid", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC1";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
    process.env.APP_URL = "https://app.teste";

    const create = vi.fn().mockResolvedValue({ sid: "SM1" });
    vi.mocked(twilio).mockReturnValue({ messages: { create } } as never);

    const resultado = await provider.send(
      { tenantId: "t1", channel: "WHATSAPP", template: "appointment-created", recipient: "11999990000", payload: {} },
      { id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo", whatsappEnabled: true, whatsappTemplateConfig: null, evolutionInstanceId: null, evolutionConnected: false, evolutionStatus: "DISCONNECTED", evolutionPhone: null },
      { subject: null, text: "Texto pronto", mediaUrl: null },
    );

    expect(resultado.success).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Texto pronto", to: "whatsapp:+5511999990000" }),
    );
    expect(create.mock.calls[0][0]).not.toHaveProperty("contentSid");
  });

  it("não exige mais as env vars TWILIO_TPL_*", async () => {
    delete process.env.TWILIO_TPL_CONFIRMATION;
    process.env.TWILIO_ACCOUNT_SID = "AC1";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
    process.env.APP_URL = "https://app.teste";

    const create = vi.fn().mockResolvedValue({ sid: "SM2" });
    vi.mocked(twilio).mockReturnValue({ messages: { create } } as never);

    const resultado = await provider.send(
      { tenantId: "t1", channel: "WHATSAPP", template: "birthday", recipient: "11999990000", payload: {} },
      { id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo", whatsappEnabled: true, whatsappTemplateConfig: null, evolutionInstanceId: null, evolutionConnected: false, evolutionStatus: "DISCONNECTED", evolutionPhone: null },
      { subject: null, text: "Parabéns!", mediaUrl: null },
    );

    expect(resultado.success).toBe(true);
  });
});
