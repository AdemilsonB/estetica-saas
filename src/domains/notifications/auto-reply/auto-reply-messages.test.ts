import { describe, it, expect } from "vitest";
import {
  AUTO_REPLY_DEFAULTS,
  montarRespostaBook,
  montarRespostaCancel,
  montarRespostaPrecos,
  montarRespostaHorarios,
} from "./auto-reply-messages";

const semPersonalizacao = {
  autoReplyMessage: null,
  autoReplyCancelMessage: null,
  autoReplyPriceIntro: null,
  autoReplyHoursIntro: null,
};

describe("respostas automáticas — duas camadas", () => {
  it("usa o padrão do catálogo quando não há personalização", () => {
    const texto = montarRespostaCancel(semPersonalizacao, "https://app.test/agendar/salao");
    expect(texto).toContain(AUTO_REPLY_DEFAULTS.cancel.split("{{link_agendamento}}")[0].trim());
  });

  it("usa o texto do tenant quando existe", () => {
    const texto = montarRespostaCancel(
      { ...semPersonalizacao, autoReplyCancelMessage: "Ligue pra gente: {{link_agendamento}}" },
      "https://app.test/agendar/salao",
    );
    expect(texto).toBe("Ligue pra gente: https://app.test/agendar/salao");
  });

  it("string vazia conta como ausência de personalização", () => {
    // '' é falsy e já causou bug neste projeto: um switch mandava string vazia
    // e o gateway caía no template, enviando mesmo desligado.
    const texto = montarRespostaCancel(
      { ...semPersonalizacao, autoReplyCancelMessage: "   " },
      "https://app.test/agendar/salao",
    );
    expect(texto).toContain("https://app.test/agendar/salao");
  });

  it("interpola o link no texto de agendar", () => {
    const texto = montarRespostaBook(semPersonalizacao, "https://app.test/agendar/salao");
    expect(texto).toContain("https://app.test/agendar/salao");
    expect(texto).not.toContain("{{");
  });

  it("monta a lista de preços sob a moldura do tenant", () => {
    const texto = montarRespostaPrecos(
      { ...semPersonalizacao, autoReplyPriceIntro: "Olha nossos preços:" },
      [
        { name: "Escova", price: 80, priceType: "FIXED" },
        { name: "Coloração", price: null, priceType: "ON_CONSULTATION" },
      ],
    );
    expect(texto).toContain("Olha nossos preços:");
    expect(texto).toContain("• Escova: R$ 80,00");
    expect(texto).toContain("• Coloração: Sob consulta");
  });

  it("usa o texto de lista vazia quando não há serviço", () => {
    const texto = montarRespostaPrecos(semPersonalizacao, []);
    expect(texto).toBe(AUTO_REPLY_DEFAULTS.priceEmpty);
  });

  it("monta o horário só com os dias habilitados", () => {
    const texto = montarRespostaHorarios(semPersonalizacao, {
      mon: { open: "09:00", close: "18:00", enabled: true },
      sun: { open: "09:00", close: "18:00", enabled: false },
    });
    expect(texto).toContain("Seg: 09:00–18:00");
    expect(texto).not.toContain("Dom");
  });

  it("usa o texto de vazio quando não há horário configurado", () => {
    expect(montarRespostaHorarios(semPersonalizacao, null)).toBe(AUTO_REPLY_DEFAULTS.hoursEmpty);
  });
});
