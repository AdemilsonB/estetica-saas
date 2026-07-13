import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "pg-boss";
import { handleTeamNotificationEmail, type TeamNotificationEmailPayload } from "./team-notification-email";

const emailSend = vi.fn();
vi.mock("@/domains/notifications/providers/email.provider", () => ({
  getEmailProvider: () => ({ send: emailSend }),
}));

const findByTenant = vi.fn();
vi.mock("@/domains/notifications/user-notifications/notification-template.repository", () => ({
  notificationTemplateRepository: { findByTenant: (...args: unknown[]) => findByTenant(...args) },
}));

const userFindFirst = vi.fn();
const tenantFindFirst = vi.fn();
vi.mock("@/shared/database/prisma", () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => userFindFirst(...args) },
    tenant: { findFirst: (...args: unknown[]) => tenantFindFirst(...args) },
  },
}));

function makeJob(data: TeamNotificationEmailPayload): Job<TeamNotificationEmailPayload>[] {
  return [{ id: "j1", data } as Job<TeamNotificationEmailPayload>];
}

describe("handleTeamNotificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindFirst.mockResolvedValue({ email: "ana@x.com", name: "Ana" });
    tenantFindFirst.mockResolvedValue({ name: "Estúdio X" });
    findByTenant.mockResolvedValue(null); // sem template próprio -> usa fallback do sistema
  });

  it("renderiza o template padrão do sistema e envia por e-mail", async () => {
    await handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "appointment_created",
      variables: { cliente: "Maria", servico: "Corte", data: "13/07", hora: "14:00" },
    }));

    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({
      to: "ana@x.com",
      subject: "Novo agendamento",
    }));
  });

  it("usa o template do tenant quando existe, em vez do padrão do sistema", async () => {
    findByTenant.mockResolvedValue({ subject: "Assunto custom {{cliente}}", body: "Corpo {{cliente}}" });
    await handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "appointment_created", variables: { cliente: "Maria" },
    }));
    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ subject: "Assunto custom Maria" }));
  });

  it("usuário inexistente (removido após enfileirar) não quebra o job", async () => {
    userFindFirst.mockResolvedValue(null);
    await expect(handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "appointment_created", variables: {},
    }))).resolves.toBeUndefined();
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("evento sem template de e-mail definido (in-app only) não envia nada", async () => {
    await handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "birthday_digest", variables: {},
    }));
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("falha do provedor de e-mail é capturada e não propaga", async () => {
    emailSend.mockRejectedValue(new Error("Resend indisponível"));
    await expect(handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "appointment_created", variables: { cliente: "Maria" },
    }))).resolves.toBeUndefined();
  });
});
