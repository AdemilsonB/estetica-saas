import { describe, it, expect } from "vitest";
import { resolveDelivery } from "./notification-channel-resolver";

const NOW = new Date("2026-07-13T15:00:00Z"); // 15h UTC — fora de quiet hours em qualquer janela noturna

describe("resolveDelivery", () => {
  it("evento desabilitado pelo negócio não gera nada", () => {
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: false, defaultChannels: ["IN_APP", "EMAIL"] },
      emailOverrideEnabled: null,
      prefs: { deliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null },
      now: NOW,
    });
    expect(result).toEqual({ eventEnabled: false, inApp: false, email: false, emailStartAfter: null });
  });

  it("sem configuração do tenant usa o default do sistema para o evento", () => {
    const result = resolveDelivery({
      eventType: "customer_created", // default do sistema: só IN_APP
      tenantSetting: null,
      emailOverrideEnabled: null,
      prefs: { deliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null },
      now: NOW,
    });
    expect(result.inApp).toBe(true);
    expect(result.email).toBe(false);
  });

  it("negócio habilita EMAIL e usuário não tem override -> email sai", () => {
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
      emailOverrideEnabled: null,
      prefs: { deliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null },
      now: NOW,
    });
    expect(result.inApp).toBe(true);
    expect(result.email).toBe(true);
    expect(result.emailStartAfter).toBeNull();
  });

  it("override do usuário desliga EMAIL mesmo com negócio habilitado (interseção)", () => {
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
      emailOverrideEnabled: false,
      prefs: { deliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null },
      now: NOW,
    });
    expect(result.inApp).toBe(true);
    expect(result.email).toBe(false);
  });

  it("negócio desliga EMAIL no defaultChannels -> override do usuário não consegue ligar (interseção)", () => {
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: true, defaultChannels: ["IN_APP"] },
      emailOverrideEnabled: true,
      prefs: { deliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null },
      now: NOW,
    });
    expect(result.email).toBe(false);
  });

  it("modo digest nunca envia email por evento (IN_APP continua ativo)", () => {
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
      emailOverrideEnabled: null,
      prefs: { deliveryMode: "digest", quietHoursStart: null, quietHoursEnd: null },
      now: NOW,
    });
    expect(result.inApp).toBe(true);
    expect(result.email).toBe(false);
  });

  it("dentro da janela de silêncio, segura o email até o fim da janela (IN_APP não é bloqueado)", () => {
    const now = new Date("2026-07-13T23:30:00Z"); // hora UTC 23 — mock abaixo trata como hora local
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
      emailOverrideEnabled: null,
      prefs: { deliveryMode: "realtime", quietHoursStart: 22, quietHoursEnd: 7 },
      now,
    });
    expect(result.inApp).toBe(true);
    expect(result.email).toBe(true);
    expect(result.emailStartAfter).not.toBeNull();
    expect(result.emailStartAfter!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("fora da janela de silêncio, envia imediatamente", () => {
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
      emailOverrideEnabled: null,
      prefs: { deliveryMode: "realtime", quietHoursStart: 22, quietHoursEnd: 7 },
      now: NOW, // 15h
    });
    expect(result.emailStartAfter).toBeNull();
  });
});
