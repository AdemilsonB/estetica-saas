import { describe, it, expect } from "vitest";
import { createServiceSchema, updateServiceSchema } from "./types";

describe("returnIntervalDays no schema de serviço", () => {
  it("aceita um intervalo de retorno", () => {
    const r = createServiceSchema.safeParse({
      name: "Escova",
      duration: 45,
      price: 80,
      returnIntervalDays: 30,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.returnIntervalDays).toBe(30);
  });

  it("aceita null — o serviço não participa do retorno", () => {
    const r = createServiceSchema.safeParse({
      name: "Escova",
      duration: 45,
      price: 80,
      returnIntervalDays: null,
    });
    expect(r.success).toBe(true);
  });

  it("é opcional", () => {
    const r = createServiceSchema.safeParse({ name: "Escova", duration: 45, price: 80 });
    expect(r.success).toBe(true);
  });

  it("rejeita zero e negativo", () => {
    // Intervalo de 0 dias dispararia o retorno no mesmo dia do atendimento.
    expect(
      createServiceSchema.safeParse({
        name: "Escova", duration: 45, price: 80, returnIntervalDays: 0,
      }).success,
    ).toBe(false);
    expect(
      createServiceSchema.safeParse({
        name: "Escova", duration: 45, price: 80, returnIntervalDays: -5,
      }).success,
    ).toBe(false);
  });

  it("rejeita intervalo absurdamente longo", () => {
    expect(
      createServiceSchema.safeParse({
        name: "Escova", duration: 45, price: 80, returnIntervalDays: 5000,
      }).success,
    ).toBe(false);
  });

  it("está disponível também na atualização", () => {
    const r = updateServiceSchema.safeParse({ returnIntervalDays: 60 });
    expect(r.success).toBe(true);
  });
});
