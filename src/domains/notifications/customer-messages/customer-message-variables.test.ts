import { describe, it, expect } from "vitest";
import { buildCustomerMessageVariables } from "./customer-message-variables";

const tenant = {
  name: "Salão da Lu",
  slug: "salao-da-lu",
  timezone: "America/Sao_Paulo",
  phone: "(11) 99999-0000",
  address: "Rua X, 123",
};

describe("buildCustomerMessageVariables", () => {
  it("formata data e hora no fuso do tenant, não no fuso do processo", () => {
    // 02/08/2026 14:00 em São Paulo = 17:00Z
    const vars = buildCustomerMessageVariables({
      customerName: "Maria Silva",
      serviceName: "Escova",
      startsAt: new Date("2026-08-02T17:00:00.000Z"),
      tenant,
    });
    expect(vars.data).toBe("02/08/2026");
    expect(vars.hora).toBe("14:00");
    expect(vars.dia_semana).toBe("domingo");
  });

  it("usa o fuso do tenant mesmo quando ele difere de São Paulo", () => {
    const vars = buildCustomerMessageVariables({
      customerName: "Maria",
      startsAt: new Date("2026-08-02T17:00:00.000Z"),
      tenant: { ...tenant, timezone: "America/Manaus" },
    });
    expect(vars.hora).toBe("13:00");
  });

  it("extrai o primeiro nome", () => {
    const vars = buildCustomerMessageVariables({ customerName: "Maria Silva", tenant });
    expect(vars.primeiro_nome).toBe("Maria");
  });

  it("primeiro nome de nome simples é o próprio nome", () => {
    const vars = buildCustomerMessageVariables({ customerName: "Maria", tenant });
    expect(vars.primeiro_nome).toBe("Maria");
  });

  it("formata valor em real e duração em minutos", () => {
    const vars = buildCustomerMessageVariables({
      customerName: "Maria",
      price: 80,
      durationMinutes: 45,
      tenant,
    });
    expect(vars.valor).toBe("R$ 80,00");
    expect(vars.duracao).toBe("45 min");
  });

  it("monta os links usando as rotas reais do app", () => {
    // Rotas verificadas: /agendar/[slug] é o fluxo de agendamento e /[slug]/cliente é o
    // portal. NÃO existe /[slug]/portal — /[slug] sozinho é a vitrine pública.
    const vars = buildCustomerMessageVariables({ customerName: "Maria", tenant });
    expect(vars.link_agendamento).toContain("/agendar/salao-da-lu");
    expect(vars.link_portal).toContain("/salao-da-lu/cliente");
  });

  it("devolve string vazia para todo campo ausente, nunca undefined", () => {
    const vars = buildCustomerMessageVariables({ customerName: "Maria", tenant });
    expect(vars.data).toBe("");
    expect(vars.hora).toBe("");
    expect(vars.servico).toBe("");
    expect(vars.profissional).toBe("");
    expect(vars.valor).toBe("");
    expect(vars.duracao).toBe("");
    expect(vars.dias_sem_vir).toBe("");
    expect(vars.ultimo_servico).toBe("");
    for (const valor of Object.values(vars)) {
      expect(typeof valor).toBe("string");
    }
  });

  it("aceita telefone e endereço nulos", () => {
    const vars = buildCustomerMessageVariables({
      customerName: "Maria",
      tenant: { ...tenant, phone: null, address: null },
    });
    expect(vars.telefone_negocio).toBe("");
    expect(vars.endereco).toBe("");
  });
});
