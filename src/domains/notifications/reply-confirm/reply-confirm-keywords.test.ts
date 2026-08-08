import { describe, it, expect } from "vitest";
import { interpretarResposta } from "./reply-confirm-keywords";

describe("interpretarResposta", () => {
  it.each(["1", "sim", "SIM", "confirmar", " Confirmar "])(
    "reconhece %s como confirmação",
    (texto) => {
      expect(interpretarResposta(texto)).toBe("confirmar");
    },
  );

  it.each(["2", "nao", "não", "NÃO", "cancelar"])(
    "reconhece %s como cancelamento",
    (texto) => {
      expect(interpretarResposta(texto)).toBe("cancelar");
    },
  );

  it("ignora acento na normalização", () => {
    expect(interpretarResposta("Não")).toBe("cancelar");
  });

  it("não interpreta a palavra dentro de uma frase", () => {
    // "confirmar" solto é resposta; "vou confirmar depois" é conversa. Agir sobre
    // uma frase cancelaria o horário de alguém que só estava falando.
    expect(interpretarResposta("vou confirmar depois")).toBeNull();
    expect(interpretarResposta("pode cancelar o de sexta?")).toBeNull();
  });

  it("não interpreta número solto que não seja 1 ou 2", () => {
    expect(interpretarResposta("3")).toBeNull();
    expect(interpretarResposta("10")).toBeNull();
  });

  it("devolve null para texto vazio", () => {
    expect(interpretarResposta("   ")).toBeNull();
  });

  it("não confunde com a palavra de descadastro", () => {
    // "PARE" pertence ao opt-out, que roda ANTES no webhook. Se esta função
    // também o reconhecesse, uma mudança de ordem viraria bug silencioso.
    expect(interpretarResposta("PARE")).toBeNull();
  });
});
