import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { NotificationService } from "./notification.service";
import { customerMessageService } from "./customer-messages/customer-message.service";

vi.mock("./notification.repository", () => ({
  notificationRepository: {
    createLog: vi.fn(),
    countEmailsThisMonth: vi.fn(),
  },
}));
vi.mock("./providers/whatsapp.gateway", () => ({
  whatsAppGateway: { send: vi.fn() },
}));
vi.mock("./providers/email.provider", () => ({
  getEmailProvider: vi.fn(() => ({ send: vi.fn() })),
}));
vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertWithinLimit: vi.fn() },
}));

import { notificationRepository } from "./notification.repository";
import { whatsAppGateway } from "./providers/whatsapp.gateway";
import { getEmailProvider } from "./providers/email.provider";
import { featureGuard } from "@/domains/billing/feature-guard";

const TENANT_ID = "tenant-1";

const mockTenant = {
  name: "Salão",
  slug: "salao",
  timezone: "America/Sao_Paulo",
  phone: null,
  address: null,
};

describe("NotificationService.logAndDispatch — enforcement de limite de e-mail/mês", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
    vi.mocked(notificationRepository.createLog).mockResolvedValue({ id: "log-1" } as never);
    prismaMock.tenant.findFirst.mockResolvedValue(mockTenant as never);
  });

  it("não consulta limite de e-mail para canal WHATSAPP", async () => {
    vi.mocked(whatsAppGateway.send).mockResolvedValue({
      status: NotificationStatus.SENT,
    } as never);

    await service.logAndDispatch({
      tenantId: TENANT_ID,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-created",
      recipient: "+5511999999999",
      payload: {},
    } as never);

    expect(notificationRepository.countEmailsThisMonth).not.toHaveBeenCalled();
    expect(featureGuard.assertWithinLimit).not.toHaveBeenCalled();
  });

  it("conta e-mails do mês e assevera o limite antes de enviar por EMAIL", async () => {
    vi.mocked(notificationRepository.countEmailsThisMonth).mockResolvedValue(4);
    vi.mocked(featureGuard.assertWithinLimit).mockResolvedValue(undefined);
    vi.spyOn(customerMessageService, "render").mockResolvedValue({
      subject: "Assunto",
      text: "Corpo",
      mediaUrl: null,
    });
    const sendMock = vi.fn().mockResolvedValue({ status: NotificationStatus.SENT });
    vi.mocked(getEmailProvider).mockReturnValue({ send: sendMock } as never);

    await service.logAndDispatch({
      tenantId: TENANT_ID,
      channel: NotificationChannel.EMAIL,
      template: "appointment-created",
      recipient: "cliente@teste.com",
      payload: {},
    } as never);

    expect(notificationRepository.countEmailsThisMonth).toHaveBeenCalledWith(TENANT_ID);
    expect(featureGuard.assertWithinLimit).toHaveBeenCalledWith(TENANT_ID, "email_month", 4);
    expect(sendMock).toHaveBeenCalled();
  });

  it("propaga o erro do featureGuard e não envia o e-mail quando o limite é excedido", async () => {
    vi.mocked(notificationRepository.countEmailsThisMonth).mockResolvedValue(999);
    vi.mocked(featureGuard.assertWithinLimit).mockRejectedValue(new Error("Limite atingido"));
    const sendMock = vi.fn();
    vi.mocked(getEmailProvider).mockReturnValue({ send: sendMock } as never);

    await expect(
      service.logAndDispatch({
        tenantId: TENANT_ID,
        channel: NotificationChannel.EMAIL,
        template: "appointment-created",
        recipient: "cliente@teste.com",
        payload: {},
      } as never),
    ).rejects.toThrow("Limite atingido");

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("usa o template do banco para montar assunto e corpo do e-mail", async () => {
    const renderSpy = vi.spyOn(customerMessageService, "render").mockResolvedValue({
      subject: "Assunto do tenant",
      text: "Corpo do tenant",
      mediaUrl: null,
    });
    prismaMock.tenant.findFirst.mockResolvedValue({
      name: "Salão",
      slug: "salao",
      timezone: "America/Sao_Paulo",
      phone: null,
      address: null,
    } as never);
    vi.mocked(notificationRepository.countEmailsThisMonth).mockResolvedValue(0);
    vi.mocked(featureGuard.assertWithinLimit).mockResolvedValue(undefined);

    const sendSpy = vi.fn().mockResolvedValue({ status: NotificationStatus.SENT });
    vi.mocked(getEmailProvider).mockReturnValue({ send: sendSpy } as never);

    await service.logAndDispatch({
      tenantId: "t1",
      channel: NotificationChannel.EMAIL,
      template: "appointment-created",
      recipient: "maria@exemplo.com",
      payload: { customerName: "Maria", serviceName: "Escova" },
    } as never);

    expect(renderSpy).toHaveBeenCalledWith("t1", "appointment_created", "EMAIL", expect.anything());
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: "maria@exemplo.com", subject: "Assunto do tenant" }),
    );
    expect(sendSpy.mock.calls[0][0].html).toContain("Corpo do tenant");
  });

  it("marca a notificação como FALHA quando o template legado é desconhecido", async () => {
    vi.mocked(notificationRepository.countEmailsThisMonth).mockResolvedValue(0);
    vi.mocked(featureGuard.assertWithinLimit).mockResolvedValue(undefined);
    const sendMock = vi.fn();
    vi.mocked(getEmailProvider).mockReturnValue({ send: sendMock } as never);

    await service.logAndDispatch({
      tenantId: TENANT_ID,
      channel: NotificationChannel.EMAIL,
      template: "template-inexistente",
      recipient: "cliente@teste.com",
      payload: {},
    } as never);

    expect(sendMock).not.toHaveBeenCalled();
    expect(notificationRepository.createLog).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ status: NotificationStatus.FAILED }),
    );
  });

  it("registra FALHA em vez de propagar quando a resolução do template estoura", async () => {
    // `logAndDispatch` roda dentro de handlers assíncronos do event bus, que engolem a
    // rejeição. Se a exceção escapasse, o envio sumiria sem rastro nem no NotificationLog —
    // foi exatamente o que aconteceria com a migration da Fase 1 ainda não aplicada.
    vi.mocked(notificationRepository.countEmailsThisMonth).mockResolvedValue(0);
    vi.mocked(featureGuard.assertWithinLimit).mockResolvedValue(undefined);
    const sendMock = vi.fn();
    vi.mocked(getEmailProvider).mockReturnValue({ send: sendMock } as never);
    vi.spyOn(customerMessageService, "render").mockRejectedValue(
      new Error("The table `public.CustomerMessageTemplate` does not exist"),
    );

    await expect(
      service.logAndDispatch({
        tenantId: TENANT_ID,
        channel: NotificationChannel.EMAIL,
        template: "appointment-created",
        recipient: "cliente@teste.com",
        payload: { customerName: "Maria" },
      } as never),
    ).resolves.toBeDefined();

    expect(sendMock).not.toHaveBeenCalled();
    expect(notificationRepository.createLog).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({
        status: NotificationStatus.FAILED,
        errorMessage: expect.stringContaining("CustomerMessageTemplate"),
      }),
    );
  });
});
