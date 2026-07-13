import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationTemplateRepository } from "./notification-template.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("NotificationTemplateRepository", () => {
  let repo: NotificationTemplateRepository;

  beforeEach(() => {
    repo = new NotificationTemplateRepository();
    vi.clearAllMocks();
  });

  it("findByTenant busca por tenantId + eventType + channel", async () => {
    prismaMock.notificationTemplate.findFirst.mockResolvedValue({
      id: "tpl1", subject: "Assunto", body: "Corpo {{cliente}}",
    } as never);

    const result = await repo.findByTenant("t1", "appointment_created", "EMAIL");

    expect(result?.body).toBe("Corpo {{cliente}}");
    expect(prismaMock.notificationTemplate.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t1", eventType: "appointment_created", channel: "EMAIL" },
    });
  });

  it("retorna null quando o tenant não tem template próprio (usa fallback do sistema)", async () => {
    prismaMock.notificationTemplate.findFirst.mockResolvedValue(null as never);
    const result = await repo.findByTenant("t1", "appointment_created", "EMAIL");
    expect(result).toBeNull();
  });
});
