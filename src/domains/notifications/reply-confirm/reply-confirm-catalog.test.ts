import { describe, it, expect } from "vitest";
import { REPLY_CONFIRM_DEFAULTS, montarConvite } from "./reply-confirm-catalog";

describe("montarConvite", () => {
  it("usa o padrão quando não há personalização", () => {
    expect(montarConvite(null)).toBe(REPLY_CONFIRM_DEFAULTS.convite);
  });

  it("usa o texto do tenant quando existe", () => {
    expect(montarConvite("Responda 1 ou 2")).toBe("Responda 1 ou 2");
  });

  it("trata string em branco como ausência de personalização", () => {
    // '' é falsy e já causou bug neste projeto — um switch mandava string vazia
    // e o gateway caía no template, enviando mesmo desligado.
    expect(montarConvite("   ")).toBe(REPLY_CONFIRM_DEFAULTS.convite);
  });

  it("o convite padrão menciona as duas opções", () => {
    expect(REPLY_CONFIRM_DEFAULTS.convite).toContain("1");
    expect(REPLY_CONFIRM_DEFAULTS.convite).toContain("2");
  });

  it("a resposta ambígua tem espaço para o horário escolhido", () => {
    // Com mais de um candidato o sistema age no mais próximo e diz qual foi —
    // nunca age em silêncio sobre horário ambíguo.
    expect(REPLY_CONFIRM_DEFAULTS.ambiguo).toContain("{{data_hora}}");
  });
});
