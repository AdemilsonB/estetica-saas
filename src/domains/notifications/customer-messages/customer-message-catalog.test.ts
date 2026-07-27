import { describe, it, expect } from "vitest";
import {
  CUSTOMER_MESSAGE_CATALOG,
  CUSTOMER_MESSAGE_CATALOG_MAP,
  CUSTOMER_MESSAGE_TEMPLATE_KEY,
  getCatalogEntry,
  LEGACY_TEMPLATE_TO_EVENT,
} from "./customer-message-catalog";

describe("catálogo de mensagens ao cliente", () => {
  it("cobre os 10 eventos e não tem duplicata", () => {
    expect(CUSTOMER_MESSAGE_CATALOG).toHaveLength(10);
    const eventos = CUSTOMER_MESSAGE_CATALOG.map((e) => e.event);
    expect(new Set(eventos).size).toBe(10);
  });

  it("toda variável citada no corpo padrão está declarada em `variables`", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      for (const canal of ["WHATSAPP", "EMAIL"] as const) {
        const usadas = [...entrada.defaults[canal].body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(
          (m) => m[1],
        );
        for (const variavel of usadas) {
          expect(
            entrada.variables,
            `evento ${entrada.event} canal ${canal} usa {{${variavel}}} sem declarar`,
          ).toContain(variavel);
        }
      }
    }
  });

  it("todo corpo padrão é não-vazio e todo e-mail tem assunto", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      expect(entrada.defaults.WHATSAPP.body.trim().length).toBeGreaterThan(0);
      expect(entrada.defaults.EMAIL.body.trim().length).toBeGreaterThan(0);
      expect(entrada.defaults.EMAIL.subject?.trim().length ?? 0).toBeGreaterThan(0);
      expect(entrada.defaults.WHATSAPP.subject).toBeNull();
    }
  });

  it("classifica a natureza de cada evento corretamente", () => {
    expect(CUSTOMER_MESSAGE_CATALOG_MAP.appointment_created.nature).toBe("transactional");
    expect(CUSTOMER_MESSAGE_CATALOG_MAP.appointment_reminder.nature).toBe("transactional");
    expect(CUSTOMER_MESSAGE_CATALOG_MAP.birthday.nature).toBe("promotional");
    expect(CUSTOMER_MESSAGE_CATALOG_MAP.return_due.nature).toBe("promotional");
    expect(CUSTOMER_MESSAGE_CATALOG_MAP.winback.nature).toBe("promotional");
  });

  it("o corpo padrão de WhatsApp é gerado pelo scaffold legado quando ele existe", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      if (!entrada.legacy) continue;
      expect(entrada.defaults.WHATSAPP.body).toBe(
        entrada.legacy.scaffold(entrada.legacy.principal, entrada.legacy.final),
      );
    }
  });

  it("mapeia os nomes de template legados para os eventos novos", () => {
    expect(LEGACY_TEMPLATE_TO_EVENT["appointment-created"]).toBe("appointment_created");
    expect(LEGACY_TEMPLATE_TO_EVENT["appointment-no-show"]).toBe("appointment_no_show");
    expect(LEGACY_TEMPLATE_TO_EVENT["birthday"]).toBe("birthday");
  });

  it("getCatalogEntry devolve a entrada e nunca undefined para evento válido", () => {
    expect(getCatalogEntry("winback").label).toBeTruthy();
  });

  it("todo evento do catálogo nasce ligado e no canal WhatsApp", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      expect(entrada.defaultEnabled).toBe(true);
      expect(entrada.defaultChannels).toEqual(["WHATSAPP"]);
    }
  });

  it("CUSTOMER_MESSAGE_TEMPLATE_KEY cobre os 10 eventos", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      expect(CUSTOMER_MESSAGE_TEMPLATE_KEY[entrada.event]).toBeTruthy();
    }
    expect(Object.keys(CUSTOMER_MESSAGE_TEMPLATE_KEY)).toHaveLength(10);
  });

  it("CUSTOMER_MESSAGE_TEMPLATE_KEY e LEGACY_TEMPLATE_TO_EVENT são inversos exatos", () => {
    // Sem isso, o dispatcher escolheria uma chave de log que o gateway não sabe
    // traduzir de volta em evento — e a mensagem morreria como "Template desconhecido".
    for (const [evento, chave] of Object.entries(CUSTOMER_MESSAGE_TEMPLATE_KEY)) {
      expect(LEGACY_TEMPLATE_TO_EVENT[chave]).toBe(evento);
    }
    expect(Object.keys(LEGACY_TEMPLATE_TO_EVENT)).toHaveLength(10);
  });
});
