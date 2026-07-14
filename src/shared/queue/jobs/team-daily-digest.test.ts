import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleTeamDailyDigest } from "./team-daily-digest";

const emailSend = vi.fn();
vi.mock("@/domains/notifications/providers/email.provider", () => ({
  getEmailProvider: () => ({ send: emailSend }),
}));

const tenantFindMany = vi.fn();
vi.mock("@/shared/database/prisma", () => ({
  prisma: { tenant: { findMany: (...args: unknown[]) => tenantFindMany(...args) } },
}));

const findByTenant = vi.fn();
vi.mock("@/domains/notifications/user-notifications/tenant-notification-setting.repository", () => ({
  tenantNotificationSettingRepository: { findByTenant: (...args: unknown[]) => findByTenant(...args) },
}));

const findEmailOverridesForUsers = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification-preference.repository", () => ({
  userNotificationPreferenceRepository: { findEmailOverridesForUsers: (...args: unknown[]) => findEmailOverridesForUsers(...args) },
}));

const findAllForDigest = vi.fn();
const countTodayAppointmentsFor = vi.fn();
const findTodayForDigest = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification.repository", () => ({
  userNotificationRepository: {
    findAllForDigest: (...args: unknown[]) => findAllForDigest(...args),
    countTodayAppointmentsFor: (...args: unknown[]) => countTodayAppointmentsFor(...args),
    findTodayForDigest: (...args: unknown[]) => findTodayForDigest(...args),
  },
}));

describe("handleTeamDailyDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // 11h UTC = 08h em America/Sao_Paulo (UTC-3, sem horário de verão) — janela
    // em que o job processa o tenant, já que o corte por hora local usa `new Date()`.
    vi.setSystemTime(new Date("2026-07-13T11:00:00Z"));
    tenantFindMany.mockResolvedValue([{ id: "t1", name: "Estúdio X", timezone: "America/Sao_Paulo" }]);
    findByTenant.mockResolvedValue(null); // default do sistema: daily_digest habilitado, canal EMAIL
    findEmailOverridesForUsers.mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("envia o resumo do dia para usuário em modo realtime com daily_digest habilitado", async () => {
    findAllForDigest.mockResolvedValue([{ id: "u1", email: "u1@x.com", notificationDeliveryMode: "realtime" }]);
    countTodayAppointmentsFor.mockResolvedValue(4);

    await handleTeamDailyDigest();

    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: "u1@x.com", subject: "Resumo do seu dia" }));
  });

  it("usuário em modo digest recebe também o consolidado do dia (anti-fadiga)", async () => {
    findAllForDigest.mockResolvedValue([{ id: "u2", email: "u2@x.com", notificationDeliveryMode: "digest" }]);
    countTodayAppointmentsFor.mockResolvedValue(0);
    findTodayForDigest.mockResolvedValue([
      { type: "appointment_created" }, { type: "appointment_created" }, { type: "customer_created" },
    ]);

    await handleTeamDailyDigest();

    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: "u2@x.com", subject: "Seu resumo de notificações de hoje" }));
  });

  it("modo digest sem notificações hoje não envia o consolidado", async () => {
    findAllForDigest.mockResolvedValue([{ id: "u3", email: "u3@x.com", notificationDeliveryMode: "digest" }]);
    findTodayForDigest.mockResolvedValue([]);

    await handleTeamDailyDigest();

    expect(emailSend).not.toHaveBeenCalledWith(expect.objectContaining({ subject: "Seu resumo de notificações de hoje" }));
  });

  it("sem usuários no tenant, não consulta nada mais", async () => {
    findAllForDigest.mockResolvedValue([]);
    await handleTeamDailyDigest();
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("falha de envio em um usuário não impede o processamento dos demais", async () => {
    findAllForDigest.mockResolvedValue([
      { id: "u1", email: "u1@x.com", notificationDeliveryMode: "realtime" },
      { id: "u2", email: "u2@x.com", notificationDeliveryMode: "realtime" },
    ]);
    countTodayAppointmentsFor.mockResolvedValue(1);
    emailSend.mockRejectedValueOnce(new Error("falha")).mockResolvedValueOnce({});

    await expect(handleTeamDailyDigest()).resolves.toBeUndefined();
    expect(emailSend).toHaveBeenCalledTimes(2);
  });

  it("só processa o tenant quando é 08h no horário local dele (não processa em outro horário)", async () => {
    // Mocka Date para uma hora fixa e usa um timezone cujo offset garante
    // que 08h local NÃO corresponde à hora do sistema (America/Los_Angeles,
    // bem distante de qualquer timezone real do servidor de CI/dev).
    vi.setSystemTime(new Date("2026-07-13T08:00:00Z")); // 08h UTC
    tenantFindMany.mockResolvedValue([{ id: "t1", name: "Estúdio X", timezone: "America/Los_Angeles" }]); // UTC-7/8, não é 08h lá
    findAllForDigest.mockResolvedValue([{ id: "u1", email: "u1@x.com", notificationDeliveryMode: "realtime" }]);

    await handleTeamDailyDigest();

    expect(emailSend).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
