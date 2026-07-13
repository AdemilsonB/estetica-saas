import { describe, it, expect } from "vitest";
import { resolveDelivery } from "./notification-channel-resolver";

const NOW = new Date("2026-07-13T15:00:00Z"); // 15h UTC — fora de quiet hours em qualquer janela noturna
const TZ = "America/Sao_Paulo";

describe("resolveDelivery", () => {
  it("evento desabilitado pelo negócio não gera nada", () => {
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: false, defaultChannels: ["IN_APP", "EMAIL"] },
      emailOverrideEnabled: null,
      prefs: { deliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null },
      now: NOW,
      tz: TZ,
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
      tz: TZ,
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
      tz: TZ,
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
      tz: TZ,
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
      tz: TZ,
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
      tz: TZ,
    });
    expect(result.inApp).toBe(true);
    expect(result.email).toBe(false);
  });

  it("dentro da janela de silêncio (horário local, não UTC), segura o email até o fim da janela", () => {
    // 2026-07-13T08:00:00Z em America/Sao_Paulo (UTC-3) = 05:00 local -> dentro de 22h-7h.
    // Um bug que comparasse a hora UTC (8) direto contra 22-7 diria "fora" (8 não está em 22-7) -- errado.
    const now = new Date("2026-07-13T08:00:00Z");
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
      emailOverrideEnabled: null,
      prefs: { deliveryMode: "realtime", quietHoursStart: 22, quietHoursEnd: 7 },
      now,
      tz: "America/Sao_Paulo",
    });
    expect(result.inApp).toBe(true);
    expect(result.email).toBe(true);
    expect(result.emailStartAfter).not.toBeNull();
    expect(result.emailStartAfter!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("fora da janela de silêncio (horário local, não UTC), envia imediatamente", () => {
    // 2026-07-13T23:00:00Z em America/Sao_Paulo (UTC-3) = 20:00 local -> fora de 22h-7h.
    // Um bug que comparasse a hora UTC (23) direto contra 22-7 diria "dentro" (23 está em 22-7) -- errado.
    const now = new Date("2026-07-13T23:00:00Z");
    const result = resolveDelivery({
      eventType: "appointment_created",
      tenantSetting: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
      emailOverrideEnabled: null,
      prefs: { deliveryMode: "realtime", quietHoursStart: 22, quietHoursEnd: 7 },
      now,
      tz: "America/Sao_Paulo",
    });
    expect(result.emailStartAfter).toBeNull();
  });
});
