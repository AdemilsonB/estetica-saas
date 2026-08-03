import { describe, it, expect } from "vitest";
import { avaliarConsentimento, PROMOCIONAIS_MAX_POR_SEMANA } from "./customer-message-consent";

const semRestricao = { consentGiven: true, marketingOptOut: false, promocionaisNaSemana: 0 };

describe("avaliarConsentimento", () => {
  describe("evento transacional", () => {
    it("envia mesmo sem consentimento", () => {
      const d = avaliarConsentimento("appointment_created", {
        ...semRestricao,
        consentGiven: false,
      });
      expect(d.permitido).toBe(true);
    });

    it("envia mesmo com opt-out de marketing ativo", () => {
      // Opt-out é de marketing. Bloquear a confirmação de um horário que o próprio
      // cliente marcou seria quebrar o serviço que ele contratou.
      const d = avaliarConsentimento("appointment_reminder", {
        ...semRestricao,
        marketingOptOut: true,
      });
      expect(d.permitido).toBe(true);
    });

    it("não conta na anti-fadiga", () => {
      const d = avaliarConsentimento("appointment_cancelled", {
        ...semRestricao,
        promocionaisNaSemana: 99,
      });
      expect(d.permitido).toBe(true);
    });
  });

  describe("evento promocional", () => {
    it("envia quando tudo está liberado", () => {
      const d = avaliarConsentimento("birthday", semRestricao);
      expect(d.permitido).toBe(true);
    });

    it("bloqueia sem consentimento", () => {
      const d = avaliarConsentimento("birthday", { ...semRestricao, consentGiven: false });
      expect(d).toEqual({ permitido: false, motivo: "sem-consentimento" });
    });

    it("bloqueia com opt-out ativo", () => {
      const d = avaliarConsentimento("birthday", { ...semRestricao, marketingOptOut: true });
      expect(d).toEqual({ permitido: false, motivo: "opt-out" });
    });

    it("bloqueia quando já atingiu o teto semanal", () => {
      const d = avaliarConsentimento("return_due", {
        ...semRestricao,
        promocionaisNaSemana: PROMOCIONAIS_MAX_POR_SEMANA,
      });
      expect(d).toEqual({ permitido: false, motivo: "anti-fadiga" });
    });

    it("opt-out tem precedência sobre anti-fadiga quando ambos valem", () => {
      // O motivo é mostrado ao tenant na prévia da campanha. "Ele pediu para sair"
      // é acionável de um jeito que "atingiu o limite da semana" não é.
      const d = avaliarConsentimento("birthday", {
        consentGiven: true,
        marketingOptOut: true,
        promocionaisNaSemana: 99,
      });
      expect(d).toEqual({ permitido: false, motivo: "opt-out" });
    });
  });
});
