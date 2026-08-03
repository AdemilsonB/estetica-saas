import { describe, it, expect, beforeEach, vi } from "vitest";
import { customerRepository } from "./customer.repository";
import { optOutService, variantesDeTelefone } from "./opt-out.service";

vi.mock("./customer.repository", () => ({
  customerRepository: { marcarOptOutPorTelefones: vi.fn() },
}));

const repositoryMock = customerRepository as unknown as {
  marcarOptOutPorTelefones: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  repositoryMock.marcarOptOutPorTelefones.mockResolvedValue({ count: 1 });
});

describe("optOutService.marcarPorTelefone", () => {
  it("marca o opt-out com data e origem", async () => {
    await optOutService.marcarPorTelefone("t1", "11999990000", "whatsapp_reply");

    expect(repositoryMock.marcarOptOutPorTelefones).toHaveBeenCalledWith(
      "t1",
      expect.any(Array),
      "whatsapp_reply",
    );
  });

  it("filtra sempre por tenantId", async () => {
    await optOutService.marcarPorTelefone("t1", "11999990000", "whatsapp_reply");

    const call = repositoryMock.marcarOptOutPorTelefones.mock.calls[0];
    expect(call[0]).toBe("t1");
  });

  it("casa o telefone com e sem o DDI 55 (13 dígitos com DDI)", async () => {
    await optOutService.marcarPorTelefone("t1", "5511999990000", "whatsapp_reply");

    const telefones = repositoryMock.marcarOptOutPorTelefones.mock.calls[0][1];
    expect(telefones).toEqual(expect.arrayContaining(["5511999990000", "11999990000"]));
  });

  it("devolve a contagem de clientes marcados", async () => {
    repositoryMock.marcarOptOutPorTelefones.mockResolvedValue({ count: 2 });

    const resultado = await optOutService.marcarPorTelefone("t1", "11999990000", "portal");

    expect(resultado).toEqual({ marcados: 2 });
  });
});

describe("variantesDeTelefone", () => {
  it("gera variante com DDI a partir de 10 dígitos (fixo sem DDI)", () => {
    const variantes = variantesDeTelefone("1133334444");
    expect(variantes).toEqual(expect.arrayContaining(["1133334444", "551133334444"]));
  });

  it("gera variante com DDI a partir de 11 dígitos (celular sem DDI)", () => {
    const variantes = variantesDeTelefone("11999990000");
    expect(variantes).toEqual(expect.arrayContaining(["11999990000", "5511999990000"]));
  });

  it("gera variante sem DDI a partir de 12 dígitos (fixo com DDI)", () => {
    const variantes = variantesDeTelefone("551133334444");
    expect(variantes).toEqual(expect.arrayContaining(["551133334444", "1133334444"]));
  });

  it("gera variante sem DDI a partir de 13 dígitos (celular com DDI)", () => {
    const variantes = variantesDeTelefone("5511999990000");
    expect(variantes).toEqual(expect.arrayContaining(["5511999990000", "11999990000"]));
  });

  it("ignora caracteres nao-numericos", () => {
    const variantes = variantesDeTelefone("(11) 99999-0000");
    expect(variantes).toEqual(expect.arrayContaining(["11999990000", "5511999990000"]));
  });

  it("nao gera duplicatas", () => {
    // '5533334444' = 10 dígitos começando com 55 (DDD 55, sem DDI)
    // Deve gerar só a variante com DDI, não duplicar
    const variantes = variantesDeTelefone("5533334444");
    expect(variantes.length).toBe(2);
    expect(new Set(variantes).size).toBe(2); // nao ha duplicatas
  });
});
