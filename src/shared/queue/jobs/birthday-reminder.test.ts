import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { handleBirthdayReminder } from "./birthday-reminder";

const dispatch = vi.fn();

vi.mock("@/domains/notifications/customer-messages/customer-message-dispatcher.service", () => ({
  customerMessageDispatcher: { dispatch: (...args: unknown[]) => dispatch(...args) },
}));

const prismaMock = prisma as unknown as { $queryRaw: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$queryRaw = vi.fn().mockResolvedValue([
    {
      id: "c1",
      tenantId: "t1",
      name: "Maria",
      phone: "11999990000",
      birthdayMessage: "Texto legado que não deve mais vencer o template",
    },
  ]);
});

describe("handleBirthdayReminder", () => {
  it("usa o template do catálogo, ignorando o birthdayMessage legado", async () => {
    // O campo saiu da UI mas continuava com efeito: quem salvou um texto antes da
    // limpeza tinha esse texto vencendo o catálogo, sem nenhuma tela onde editar.
    await handleBirthdayReminder([]);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).not.toHaveProperty("message");
  });

  it("não filtra consentimento no SQL — quem decide é a guarda do dispatcher", async () => {
    await handleBirthdayReminder([]);

    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).not.toContain("consentGiven");
  });
});
