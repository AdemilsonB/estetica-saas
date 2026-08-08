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
      daysSinceLastVisit: 30,
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
    // "returnIntervalDays" aparece 2x no SQL (filtro + aritmética do intervalo) —
    // afirmar só a presença da string deixaria passar se o filtro fosse removido.
    // A cláusula do FILTRO precisa aparecer explicitamente.
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain(`s."returnIntervalDays" IS NOT NULL`);
  });

  it("exclui cliente com agendamento futuro correlacionando por cliente E tenant", async () => {
    // Quem já tem horário marcado não precisa ser lembrado de voltar. A correlação
    // precisa ser por customerId E tenantId — sem o tenantId, um agendamento de
    // OUTRO negócio excluiria o cliente indevidamente (vazamento cross-tenant).
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain(`fut."customerId" = c.id`);
    expect(sql).toContain(`fut."tenantId" = c."tenantId"`);
    expect(sql).toContain(`fut.status IN ('SCHEDULED', 'CONFIRMED')`);
  });

  it("compara 'hoje' do tenant contra NOW() com uma única conversão de fuso", async () => {
    // startsAt é timestamp naive gravado como UTC — precisa das DUAS conversões
    // (AT TIME ZONE 'UTC' AT TIME ZONE tz) para virar hora local. NOW() já é
    // timestamptz (instante absoluto); aplicar a MESMA cadeia dupla nele desloca o
    // resultado por duas vezes o offset, na direção errada. Só uma conversão.
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain(`(NOW() AT TIME ZONE t.timezone)::date`);
    expect(sql).not.toContain(`NOW() AT TIME ZONE 'UTC' AT TIME ZONE`);
  });

  it("devolve dias desde a visita e nome do serviço para a mensagem", async () => {
    // O texto padrão do catálogo usa {{dias_sem_vir}} e {{ultimo_servico}} — sem
    // esses dois campos no payload, a mensagem sai com buracos.
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toMatch(/s\."returnIntervalDays"\s+AS\s+"daysSinceLastVisit"/);

    expect(dispatch.mock.calls[0][0].payload).toEqual(
      expect.objectContaining({ daysSinceLastVisit: 30, lastServiceName: "Escova" }),
    );
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
