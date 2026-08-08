import { describe, it, expect } from "vitest";

import {
  CUSTOMER_MESSAGE_CATALOG,
  getCatalogEntry,
} from "./customer-message-catalog";

describe("status de disponibilidade no catálogo", () => {
  it("marca winback como indisponível", () => {
    // A reconquista saiu de escopo por decisão de produto. O evento continua no
    // catálogo (remover exigiria mexer no enum do Prisma), mas a UI não pode
    // oferecer um liga/desliga que não faz nada.
    expect(getCatalogEntry("winback").status).toBe("soon");
  });

  it("return_due está disponível — o job passou a existir nesta etapa", () => {
    expect(getCatalogEntry("return_due").status ?? "ga").toBe("ga");
  });

  it("winback é o ÚNICO evento indisponível", () => {
    // Se alguém marcar outro evento como "soon" sem querer, o tenant perde um
    // recurso que funciona — e o único sintoma é um toggle cinza.
    const indisponiveis = CUSTOMER_MESSAGE_CATALOG.filter(
      (entrada) => entrada.status === "soon",
    ).map((entrada) => entrada.event);

    expect(indisponiveis).toEqual(["winback"]);
  });

  it("todo evento sem status explícito conta como disponível", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      if (entrada.event === "winback") continue;
      expect(entrada.status ?? "ga").toBe("ga");
    }
  });
});
