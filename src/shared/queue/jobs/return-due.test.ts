import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { handleReturnDue } from "./return-due";

const dispatch = vi.fn();

vi.mock("@/domains/notifications/customer-messages/customer-message-dispatcher.service", () => ({
  customerMessageDispatcher: { dispatch: (...a: unknown[]) => dispatch(...a) },
}));

const prismaMock = prisma as unknown as { $queryRaw: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$queryRaw = vi.fn().mockResolvedValue([
    {
      customerId: "c1",
      tenantId: "t1",
      customerName: "Maria",
      phone: "11999990000",
      serviceName: "Escova",
    },
  ]);
});

describe("handleReturnDue", () => {
  it("dispara o evento return_due para cada cliente elegível", async () => {
    await handleReturnDue([]);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toEqual(
      expect.objectContaining({ tenantId: "t1", event: "return_due", customerId: "c1" }),
    );
  });

  it("não filtra consentimento na consulta — quem decide é a guarda do dispatcher", async () => {
    // A guarda central já aplica consentimento, opt-out e anti-fadiga. Repetir o
    // filtro aqui recria o problema que a Etapa 1 resolveu.
    await handleReturnDue([]);

    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).not.toContain("consentGiven");
  });

  it("exige serviço com intervalo configurado", async () => {
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain("returnIntervalDays");
  });

  it("exclui cliente com agendamento futuro", async () => {
    // Quem já tem horário marcado não precisa ser lembrado de voltar.
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain("NOT EXISTS");
  });

  it("considera apenas atendimentos concluídos", async () => {
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain("COMPLETED");
  });

  it("não explode quando não há ninguém elegível", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(handleReturnDue([])).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("segue para o próximo cliente quando um envio falha", async () => {
    // Um telefone inválido não pode impedir os demais lembretes do dia.
    prismaMock.$queryRaw.mockResolvedValue([
      { customerId: "c1", tenantId: "t1", customerName: "A", phone: "1", serviceName: "X" },
      { customerId: "c2", tenantId: "t1", customerName: "B", phone: "2", serviceName: "Y" },
    ]);
    dispatch.mockRejectedValueOnce(new Error("boom"));

    await handleReturnDue([]);

    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
