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

  it("transacional nasce ligado, promocional nasce desligado (opt-in por LGPD)", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      expect(entrada.defaultEnabled).toBe(entrada.nature === "transactional");
    }
  });

  it("todo evento nasce com o canal WhatsApp", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      expect(entrada.defaultChannels).toEqual(["WHATSAPP"]);
    }
  });

  it("CUSTOMER_MESSAGE_TEMPLATE_KEY cobre os 10 eventos", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      expect(CUSTOMER_MESSAGE_TEMPLATE_KEY[entrada.event]).toBeTruthy();
    }
    expect(Object.keys(CUSTOMER_MESSAGE_TEMPLATE_KEY)).toHaveLength(10);
  });

  it("nenhum evento compartilha chave de log com outro", () => {
    // O invariante que a derivação de LEGACY_TEMPLATE_TO_EVENT pode violar: duas
    // entradas com a mesma chave colapsam em uma, e o evento perdido passa a
    // falhar como "Template desconhecido" no gateway, sem erro visível aqui.
    const chaves = Object.values(CUSTOMER_MESSAGE_TEMPLATE_KEY);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(Object.keys(LEGACY_TEMPLATE_TO_EVENT)).toHaveLength(chaves.length);
  });

  it("a chave de log de cada evento volta ao próprio evento", () => {
    for (const [evento, chave] of Object.entries(CUSTOMER_MESSAGE_TEMPLATE_KEY)) {
      expect(LEGACY_TEMPLATE_TO_EVENT[chave]).toBe(evento);
    }
  });
});
