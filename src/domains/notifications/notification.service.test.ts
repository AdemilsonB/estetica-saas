import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { NotificationService } from "./notification.service";

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

describe("NotificationService.logAndDispatch — enforcement de limite de e-mail/mês", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
    vi.mocked(notificationRepository.createLog).mockResolvedValue({ id: "log-1" } as never);
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
});
