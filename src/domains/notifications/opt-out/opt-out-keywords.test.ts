import { describe, it, expect } from "vitest";
import { ehPedidoDeDescadastro } from "./opt-out-keywords";

describe("ehPedidoDeDescadastro", () => {
  it.each(["PARE", "parar", "Sair", "descadastrar", "CANCELAR INSCRICAO"])(
    "reconhece %s",
    (texto) => {
      expect(ehPedidoDeDescadastro(texto)).toBe(true);
    },
  );

  it("ignora acento e espaço em volta", () => {
    expect(ehPedidoDeDescadastro("  Cancelar Inscrição  ")).toBe(true);
  });

  it("não reconhece a palavra dentro de uma frase", () => {
    // "Pode parar de mandar às 7h?" é conversa, não descadastro. Marcar opt-out
    // por conta disso silenciaria o canal do tenant sem o cliente ter pedido.
    expect(ehPedidoDeDescadastro("pode parar de mandar às 7h?")).toBe(false);
  });

  it("não reconhece texto vazio", () => {
    expect(ehPedidoDeDescadastro("   ")).toBe(false);
  });

  it("não confunde com o 2 da confirmação por resposta", () => {
    expect(ehPedidoDeDescadastro("2")).toBe(false);
  });
});
