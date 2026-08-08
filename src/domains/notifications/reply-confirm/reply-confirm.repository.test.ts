import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { replyConfirmRepository } from "./reply-confirm.repository";

const prismaMock = prisma as unknown as {
  notificationLog: { count: ReturnType<typeof vi.fn> };
  appointment: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  prismaMock.notificationLog = { count: vi.fn().mockResolvedValue(0) };
  prismaMock.appointment = { findMany: vi.fn().mockResolvedValue([]) };
});

describe("houveLembreteRecente", () => {
  it("devolve true quando existe lembrete nas últimas 48h", async () => {
    prismaMock.notificationLog.count.mockResolvedValue(1);
    expect(await replyConfirmRepository.houveLembreteRecente("t1", "5511999990000")).toBe(true);
  });

  it("devolve false quando não existe", async () => {
    expect(await replyConfirmRepository.houveLembreteRecente("t1", "5511999990000")).toBe(false);
  });

  it("filtra por tenantId, pelo template do lembrete e pela janela de 48h", async () => {
    await replyConfirmRepository.houveLembreteRecente("t1", "5511999990000");

    const where = prismaMock.notificationLog.count.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
    expect(where.template).toBe("appointment-reminder");
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("casa o telefone com e sem o DDI 55", async () => {
    // O NotificationLog grava o destinatário como o telefone do cliente (sem DDI,
    // formato do cadastro), mas o WhatsApp entrega o remoteJid COM o DDI. Sem as
    // duas variantes, o "1" do cliente nunca casaria com o lembrete que ele recebeu.
    await replyConfirmRepository.houveLembreteRecente("t1", "5511999990000");

    const where = prismaMock.notificationLog.count.mock.calls[0][0].where;
    expect(where.recipient.in).toEqual(
      expect.arrayContaining(["5511999990000", "11999990000"]),
    );
  });
});

describe("candidatos", () => {
  it("busca SCHEDULED nas próximas 48h, do mais próximo para o mais distante", async () => {
    await replyConfirmRepository.candidatos("t1", "5511999990000");

    const args = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe("t1");
    expect(args.where.status).toBe("SCHEDULED");
    expect(args.where.startsAt.gte).toBeInstanceOf(Date);
    expect(args.where.startsAt.lte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ startsAt: "asc" });
  });

  it("localiza o cliente pelo telefone dentro do tenant, com as duas variantes", async () => {
    await replyConfirmRepository.candidatos("t1", "5511999990000");

    const where = prismaMock.appointment.findMany.mock.calls[0][0].where;
    expect(where.customer.phone.in).toEqual(
      expect.arrayContaining(["5511999990000", "11999990000"]),
    );
    // Cliente arquivado não deve gerar candidato.
    expect(where.customer.deletedAt).toBeNull();
  });

  it("devolve os campos que o service precisa", async () => {
    const agora = new Date();
    prismaMock.appointment.findMany.mockResolvedValue([
      { id: "a1", startsAt: agora, customerId: "c1" },
    ]);

    const lista = await replyConfirmRepository.candidatos("t1", "5511999990000");

    expect(lista).toEqual([{ id: "a1", startsAt: agora, customerId: "c1" }]);
  });
});
