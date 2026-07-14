import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationTemplateService } from "./notification-template.service";

const repo = { findByTenant: vi.fn(), upsert: vi.fn() };

describe("NotificationTemplateService.getForTenant", () => {
  let service: NotificationTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationTemplateService(repo as never);
  });

  it("retorna o template do tenant quando existe", async () => {
    repo.findByTenant.mockResolvedValue({ subject: "Assunto custom", body: "Corpo custom" });
    const result = await service.getForTenant("t1", "appointment_created", "EMAIL");
    expect(result).toEqual({ subject: "Assunto custom", body: "Corpo custom", isSystemDefault: false });
  });

  it("cai pro template padrão do sistema quando o tenant não tem um próprio", async () => {
    repo.findByTenant.mockResolvedValue(null);
    const result = await service.getForTenant("t1", "appointment_created", "EMAIL");
    expect(result?.isSystemDefault).toBe(true);
    expect(result?.subject).toBe("Novo agendamento");
  });

  it("retorna null quando nem o tenant nem o sistema têm template pro canal (ex.: birthday_digest/EMAIL)", async () => {
    repo.findByTenant.mockResolvedValue(null);
    const result = await service.getForTenant("t1", "birthday_digest", "EMAIL");
    expect(result).toBeNull();
  });
});

describe("NotificationTemplateService.upsert", () => {
  it("delega ao repository", async () => {
    repo.upsert.mockResolvedValue({ id: "tpl1" });
    const service = new NotificationTemplateService(repo as never);
    await service.upsert("t1", "appointment_created", "EMAIL", { subject: "S", body: "B" });
    expect(repo.upsert).toHaveBeenCalledWith("t1", "appointment_created", "EMAIL", { subject: "S", body: "B" });
  });
});
