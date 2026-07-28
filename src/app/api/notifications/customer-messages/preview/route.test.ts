import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: vi.fn() }));
vi.mock("@/shared/auth/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertAccess: vi.fn() },
  FEATURES: { WHATSAPP_BASIC: "whatsapp_basic" },
}));
vi.mock("@/domains/notifications/customer-messages/customer-message-setting.service", () => ({
  customerMessageSettingService: { resolve: vi.fn() },
}));
vi.mock("@/domains/notifications/customer-messages/customer-message.service", () => ({
  customerMessageService: { render: vi.fn() },
}));

import { getSessionContext } from "@/shared/auth/session";
import { featureGuard } from "@/domains/billing/feature-guard";
import { customerMessageSettingService } from "@/domains/notifications/customer-messages/customer-message-setting.service";
import { customerMessageService } from "@/domains/notifications/customer-messages/customer-message.service";
import { POST } from "./route";

const session = vi.mocked(getSessionContext);
const settings = vi.mocked(customerMessageSettingService);
const mensagens = vi.mocked(customerMessageService);
const guard = vi.mocked(featureGuard);

function pedir(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/notifications/customer-messages/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const tenantConectado = {
  name: "Salão da Lu",
  slug: "salao-da-lu",
  timezone: "America/Sao_Paulo",
  phone: "1199999",
  address: "Rua X",
  whatsappEnabled: true,
  evolutionConnected: true,
  evolutionStatus: "CONNECTED",
};

describe("POST /api/notifications/customer-messages/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.mockResolvedValue({ tenantId: "t1", userId: "u1" } as never);
    guard.assertAccess.mockResolvedValue(undefined as never);
    settings.resolve.mockResolvedValue({
      event: "appointment_created",
      label: "Agendamento criado",
      description: "",
      nature: "transactional",
      enabled: true,
      channels: ["WHATSAPP"],
      isCustom: false,
    });
    mensagens.render.mockResolvedValue({
      subject: null,
      text: "Olá, Maria Silva! Seu agendamento foi criado.",
      mediaUrl: null,
    });
    prismaMock.tenant.findFirst.mockResolvedValue(tenantConectado as never);
    prismaMock.customer.findFirst.mockResolvedValue({
      id: "c1",
      name: "Maria Silva",
      phone: "11999990000",
      email: "maria@ex.com",
    } as never);
    prismaMock.appointment.findFirst.mockResolvedValue(null);
    prismaMock.service.findFirst.mockResolvedValue({ name: "Escova", duration: 45 } as never);
    prismaMock.user.findFirst.mockResolvedValue({ name: "Ana" } as never);
  });

  it("devolve o padrão do tenant e o texto já interpolado", async () => {
    const res = await pedir({ event: "appointment_created", customerId: "c1" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.defaultEnabled).toBe(true);
    expect(body.preview).toContain("Maria Silva");
    expect(body.blockedReason).toBeNull();
  });

  it("busca o cliente sempre dentro do tenant da sessão", async () => {
    await pedir({ event: "appointment_created", customerId: "c1" });

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "c1", tenantId: "t1" }) }),
    );
  });

  it("explica que o cliente não tem telefone", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: "c1",
      name: "Maria",
      phone: null,
      email: null,
    } as never);

    const body = await (await pedir({ event: "appointment_created", customerId: "c1" })).json();

    expect(body.blockedReason).toMatch(/telefone/i);
  });

  it("explica que o WhatsApp do negócio não está conectado", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      ...tenantConectado,
      evolutionConnected: false,
      evolutionStatus: "DISCONNECTED",
    } as never);

    const body = await (await pedir({ event: "appointment_created", customerId: "c1" })).json();

    expect(body.blockedReason).toMatch(/não está conectado/i);
  });

  it("explica que o plano não inclui WhatsApp", async () => {
    guard.assertAccess.mockRejectedValue(new Error("sem plano"));

    const body = await (await pedir({ event: "appointment_created", customerId: "c1" })).json();

    expect(body.blockedReason).toMatch(/plano/i);
  });

  it("confirmação de agendamento nascido no painel vem com o padrão desligado", async () => {
    settings.resolve.mockResolvedValue({
      event: "appointment_confirmed",
      label: "Agendamento confirmado",
      description: "",
      nature: "transactional",
      enabled: true,
      channels: ["WHATSAPP"],
      isCustom: false,
    });
    prismaMock.appointment.findFirst.mockResolvedValue({
      id: "a1",
      customerId: "c1",
      startsAt: new Date("2026-08-02T17:00:00.000Z"),
      origin: "PANEL",
      customer: { id: "c1", name: "Maria Silva", phone: "11999990000", email: "maria@ex.com" },
      service: { name: "Escova", duration: 45 },
      professional: { name: "Ana" },
      package: null,
      promotion: null,
    } as never);

    const body = await (
      await pedir({ event: "appointment_confirmed", appointmentId: "a1" })
    ).json();

    expect(body.defaultEnabled).toBe(false);
  });

  it("rejeita pedido sem cliente e sem agendamento", async () => {
    const res = await pedir({ event: "appointment_created" });
    expect(res.status).toBe(422);
  });
});
