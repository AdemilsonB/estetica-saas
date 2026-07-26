import { describe, it, expect } from "vitest";
import { interpolateTemplate } from "../user-notifications/notification-template-engine";
import { buildCustomerMessageVariables } from "./customer-message-variables";
import { CUSTOMER_MESSAGE_CATALOG, LEGACY_TEMPLATE_TO_EVENT } from "./customer-message-catalog";
import { buildLegacyBody } from "./legacy-template-backfill";

const tenant = {
  id: "t1",
  name: "Salão da Lu",
  slug: "salao-da-lu",
  timezone: "America/Sao_Paulo",
  phone: "(11) 99999-0000",
  address: "Rua X, 123",
};

const STARTS_AT_ISO = "2026-08-02T17:00:00.000Z";

/**
 * CÓPIA CONGELADA de `buildEvolutionMessage` como ele existia antes desta migração
 * (evolution.provider.ts:52-105, commit 8ade22c). Não importe a função real: a Task 7 a
 * apaga, e este teste precisa sobreviver a isso — ele é o guardião permanente de que o
 * texto enviado ao cliente não mudou. Nunca "atualize" este snapshot para fazer um teste
 * passar; se ele divergir, o errado é o catálogo.
 */
function buildEvolutionMessageCongelado(
  template: string,
  payload: { customerName: string; serviceName: string; startsAt?: string; message?: string },
  cfg: { name: string; slug: string; timezone: string; whatsappTemplateConfig: unknown },
): string {
  const TEMPLATE_TO_CONFIG_KEY: Record<string, string> = {
    "appointment-created": "confirmacao",
    "appointment-confirmed": "confirmado",
    "appointment-reminder": "lembrete",
    "appointment-cancelled": "cancelamento",
    "appointment-no-show": "nao_comparecimento",
    birthday: "aniversario",
  };
  const TEMPLATE_DEFAULTS: Record<string, { mensagemPrincipal: string; mensagemFinal: string }> = {
    confirmacao: { mensagemPrincipal: "Seu agendamento foi criado.", mensagemFinal: "Até lá!" },
    confirmado: { mensagemPrincipal: "Seu agendamento está confirmado.", mensagemFinal: "Te esperamos!" },
    lembrete: { mensagemPrincipal: "Lembrete:", mensagemFinal: "Até lá!" },
    cancelamento: { mensagemPrincipal: "Seu agendamento foi cancelado.", mensagemFinal: "Para reagendar, entre em contato conosco." },
    nao_comparecimento: { mensagemPrincipal: "Notamos que você não compareceu ao seu horário.", mensagemFinal: "Quando quiser reagendar, estamos à disposição!" },
    aniversario: { mensagemPrincipal: "Feliz aniversário! Temos um presente especial para você.", mensagemFinal: "Venha nos visitar em breve!" },
  };

  const fmt = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...o }).format(new Date(iso));

  const configKey = TEMPLATE_TO_CONFIG_KEY[template];
  const raw = cfg.whatsappTemplateConfig as Record<
    string,
    { mensagemPrincipal?: string; mensagemFinal?: string }
  > | null;
  const config = raw?.[configKey] ?? {};
  const defaults = TEMPLATE_DEFAULTS[configKey];
  const principal = config.mensagemPrincipal ?? defaults.mensagemPrincipal;
  const final = config.mensagemFinal ?? defaults.mensagemFinal;
  const tz = cfg.timezone;

  if (template === "appointment-created" || template === "appointment-confirmed") {
    if (payload.message) return payload.message;
    const date = fmt(payload.startsAt!, tz, { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = fmt(payload.startsAt!, tz, { hour: "2-digit", minute: "2-digit" });
    const link = `${process.env.APP_URL ?? ""}/agendar/${cfg.slug}`;
    return `Olá, ${payload.customerName}! ${principal} 📅 ${date} às ${time} | ${payload.serviceName} | ${cfg.name}. ${final} 🔗 ${link}`;
  }

  if (template === "appointment-reminder") {
    const time = fmt(payload.startsAt!, tz, { hour: "2-digit", minute: "2-digit" });
    return `Olá, ${payload.customerName}! ${principal} Hoje às ${time} | ${payload.serviceName} | ${cfg.name}. ${final}`;
  }

  if (template === "birthday") {
    return `Olá, ${payload.customerName}! ${principal} De ${cfg.name}. ${final}`;
  }

  return `Olá, ${payload.customerName}! ${principal} | ${payload.serviceName} | ${cfg.name}. ${final}`;
}

const PAYLOAD_BASE = {
  appointmentId: "a1",
  customerName: "Maria Silva",
  serviceName: "Escova",
  startsAt: STARTS_AT_ISO,
};

function renderizarNovo(body: string) {
  return interpolateTemplate(
    body,
    buildCustomerMessageVariables({
      customerName: PAYLOAD_BASE.customerName,
      serviceName: PAYLOAD_BASE.serviceName,
      startsAt: new Date(STARTS_AT_ISO),
      tenant,
    }),
    false,
  );
}

describe("equivalência entre o texto legado e o template migrado", () => {
  // `appointment-rescheduled` fica fora do laço de equivalência porque NÃO EXISTE texto
  // antigo a preservar: o caminho legado lança TypeError antes de montar qualquer string
  // (evolution.provider.ts:57-62 — sem entrada em TEMPLATE_TO_CONFIG_KEY, `defaults` vem
  // undefined). O comportamento atual em produção é "nenhuma mensagem é enviada". O teste
  // abaixo documenta isso; o template novo do catálogo é uma correção, não uma regressão.
  const templatesLegados = Object.keys(LEGACY_TEMPLATE_TO_EVENT).filter(
    (t) => t !== "appointment-rescheduled",
  );

  it.each(templatesLegados)(
    "%s sem customização: catálogo reproduz o texto atual byte a byte",
    (templateLegado) => {
      const antigo = buildEvolutionMessageCongelado(templateLegado, PAYLOAD_BASE, {
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
        whatsappTemplateConfig: null,
      });

      const evento = LEGACY_TEMPLATE_TO_EVENT[templateLegado];
      const entrada = CUSTOMER_MESSAGE_CATALOG.find((e) => e.event === evento)!;
      const novo = renderizarNovo(entrada.defaults.WHATSAPP.body);

      expect(novo).toBe(antigo);
    },
  );

  it.each(templatesLegados)(
    "%s COM customização: o backfill reproduz o texto atual byte a byte",
    (templateLegado) => {
      const evento = LEGACY_TEMPLATE_TO_EVENT[templateLegado];
      const entrada = CUSTOMER_MESSAGE_CATALOG.find((e) => e.event === evento)!;
      if (!entrada.legacy) return;

      const configDoTenant = {
        [entrada.legacy.configKey]: {
          mensagemPrincipal: "Texto customizado do dono.",
          mensagemFinal: "Abraço da equipe!",
        },
      };

      const antigo = buildEvolutionMessageCongelado(templateLegado, PAYLOAD_BASE, {
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
        whatsappTemplateConfig: configDoTenant,
      });

      const corpoMigrado = buildLegacyBody(evento, configDoTenant);
      expect(corpoMigrado).not.toBeNull();
      expect(renderizarNovo(corpoMigrado!)).toBe(antigo);
    },
  );

  it("não cria registro quando o tenant nunca personalizou aquele evento", () => {
    expect(buildLegacyBody("appointment_created", null)).toBeNull();
    expect(buildLegacyBody("appointment_created", {})).toBeNull();
    expect(buildLegacyBody("appointment_created", { cancelamento: { mensagemPrincipal: "x" } })).toBeNull();
  });

  it("eventos sem equivalente legado nunca geram registro", () => {
    expect(buildLegacyBody("appointment_requested", { confirmacao: { mensagemPrincipal: "x" } })).toBeNull();
    expect(buildLegacyBody("appointment_rescheduled", { confirmacao: { mensagemPrincipal: "x" } })).toBeNull();
    expect(buildLegacyBody("return_due", null)).toBeNull();
  });

  it("customização parcial (só o principal) preserva o final padrão", () => {
    const corpo = buildLegacyBody("appointment_created", {
      confirmacao: { mensagemPrincipal: "Só o principal." },
    });
    expect(corpo).toContain("Só o principal.");
    expect(corpo).toContain("Até lá!");
  });

  it("documenta o bug legado: remarcação lançava exceção e nunca chegava ao cliente", () => {
    expect(() =>
      buildEvolutionMessageCongelado("appointment-rescheduled", PAYLOAD_BASE, {
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
        whatsappTemplateConfig: null,
      }),
    ).toThrow(TypeError);
  });

  it("o template novo de remarcação renderiza texto útil (corrige o bug legado)", () => {
    const entrada = CUSTOMER_MESSAGE_CATALOG.find((e) => e.event === "appointment_rescheduled")!;
    const texto = renderizarNovo(entrada.defaults.WHATSAPP.body);
    expect(texto).toContain("Maria Silva");
    expect(texto).toContain("Escova");
    expect(texto).toContain("02/08/2026");
    expect(texto).not.toContain("{{");
    expect(texto).not.toContain("undefined");
  });
});

describe("ramo degenerado sem startsAt (não-regressão, não equivalência)", () => {
  it("renderiza sem quebrar, deixando data e hora vazias", () => {
    const entrada = CUSTOMER_MESSAGE_CATALOG.find((e) => e.event === "appointment_created")!;
    const texto = interpolateTemplate(
      entrada.defaults.WHATSAPP.body,
      buildCustomerMessageVariables({
        customerName: "Maria Silva",
        serviceName: "Escova",
        tenant,
      }),
      false,
    );

    expect(texto).toContain("Maria Silva");
    expect(texto).toContain("Escova");
    expect(texto).not.toContain("undefined");
    expect(texto).not.toContain("{{");
  });
});
