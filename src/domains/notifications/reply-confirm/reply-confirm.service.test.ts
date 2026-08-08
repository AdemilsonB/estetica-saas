import { describe, it, expect, beforeEach, vi } from "vitest";
import { replyConfirmService } from "./reply-confirm.service";
import { replyConfirmRepository } from "./reply-confirm.repository";
import { schedulingService } from "@/domains/scheduling/scheduling.service";

vi.mock("./reply-confirm.repository", () => ({
  replyConfirmRepository: { houveLembreteRecente: vi.fn(), candidatos: vi.fn() },
}));

vi.mock("@/domains/scheduling/scheduling.service", () => ({
  schedulingService: { updateAppointmentStatus: vi.fn() },
}));

const repo = vi.mocked(replyConfirmRepository);
const scheduling = vi.mocked(schedulingService);

const base = {
  tenantId: "t1",
  telefone: "5511999990000",
  timezone: "America/Sao_Paulo",
};

/** 2026-08-10 14:00 no fuso de São Paulo (UTC-3). */
const AMANHA = new Date("2026-08-10T17:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  repo.houveLembreteRecente.mockResolvedValue(true);
  repo.candidatos.mockResolvedValue([{ id: "a1", startsAt: AMANHA, customerId: "c1" }]);
  scheduling.updateAppointmentStatus.mockResolvedValue({} as never);
});

describe("replyConfirmService.processar", () => {
  it("devolve null quando o texto não é resposta de confirmação", async () => {
    const r = await replyConfirmService.processar({ ...base, texto: "quero agendar" });

    expect(r).toBeNull();
    expect(repo.houveLembreteRecente).not.toHaveBeenCalled();
    expect(scheduling.updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it("devolve null quando não houve lembrete nas últimas 48h", async () => {
    // Sem essa checagem, um "1" solto de conversa confirmaria um horário sozinho.
    repo.houveLembreteRecente.mockResolvedValue(false);

    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(r).toBeNull();
    expect(scheduling.updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it("devolve null quando não há candidato", async () => {
    repo.candidatos.mockResolvedValue([]);

    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(r).toBeNull();
    expect(scheduling.updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it("confirma o agendamento com 1", async () => {
    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(scheduling.updateAppointmentStatus).toHaveBeenCalledWith("t1", "a1", {
      status: "CONFIRMED",
      notify: false,
    });
    expect(r?.resposta).toContain("confirmado");
  });

  it("cancela o agendamento com 2", async () => {
    const r = await replyConfirmService.processar({ ...base, texto: "2" });

    expect(scheduling.updateAppointmentStatus).toHaveBeenCalledWith("t1", "a1", {
      status: "CANCELLED",
      notify: false,
    });
    expect(r?.resposta).toContain("cancelado");
  });

  it("age no mais próximo e DIZ QUAL FOI quando há mais de um candidato", async () => {
    // Nunca agir em silêncio sobre horário ambíguo: o cliente precisa saber em
    // qual dos horários dele a ação caiu.
    const DEPOIS = new Date("2026-08-11T17:00:00.000Z");
    repo.candidatos.mockResolvedValue([
      { id: "a1", startsAt: AMANHA, customerId: "c1" },
      { id: "a2", startsAt: DEPOIS, customerId: "c1" },
    ]);

    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(scheduling.updateAppointmentStatus).toHaveBeenCalledWith(
      "t1",
      "a1",
      expect.anything(),
    );
    expect(r?.resposta).toContain("mais de um horário");
    expect(r?.resposta).toContain("10/08");
    expect(r?.resposta).not.toContain("{{data_hora}}");
  });

  it("não avisa de ambiguidade quando há um candidato só", async () => {
    const r = await replyConfirmService.processar({ ...base, texto: "1" });
    expect(r?.resposta).not.toContain("mais de um horário");
  });

  it("passa notify: false — o cliente já sabe, ele que pediu", async () => {
    // A ação nasce de uma mensagem do próprio cliente. Reenviar a ele o aviso de
    // "seu horário foi confirmado" pelo motor seria mensagem duplicada.
    await replyConfirmService.processar({ ...base, texto: "1" });

    expect(scheduling.updateAppointmentStatus.mock.calls[0][2]).toEqual(
      expect.objectContaining({ notify: false }),
    );
  });

  it("devolve null e não propaga quando a ação falha", async () => {
    // Roda dentro do webhook; deixar escapar derrubaria o handler e o WhatsApp
    // reentregaria o evento, podendo agir duas vezes.
    scheduling.updateAppointmentStatus.mockRejectedValue(new Error("boom"));

    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(r).toBeNull();
  });

  it("formata a data no fuso do tenant, não no do processo", async () => {
    const DEPOIS = new Date("2026-08-11T17:00:00.000Z");
    repo.candidatos.mockResolvedValue([
      { id: "a1", startsAt: AMANHA, customerId: "c1" },
      { id: "a2", startsAt: DEPOIS, customerId: "c1" },
    ]);

    const r = await replyConfirmService.processar({
      ...base,
      texto: "1",
      timezone: "America/Sao_Paulo",
    });

    // 2026-08-10T17:00Z = 14:00 em São Paulo.
    expect(r?.resposta).toContain("14:00");
  });
});
