# Motor de mensagens ao cliente — Fase 1 (fundação) — Plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Spec:** [`docs/superpowers/specs/2026-07-26-motor-mensagens-cliente-design.md`](../specs/2026-07-26-motor-mensagens-cliente-design.md) — seções 3, 4 e 5.

**Goal:** Tirar todo o texto de mensagem ao cliente de dentro do código de envio, substituindo-o por um catálogo único de mensagens padrão do sistema mais uma camada de personalização por tenant, sem que nenhum tenant perca o texto que já customizou.

**Architecture:** Um catálogo em código define a mensagem padrão de cada evento por canal. Um model novo (`CustomerMessageTemplate`) guarda apenas as personalizações — ausência de registro significa "usa o padrão". Um service resolve template → interpola variáveis → devolve texto pronto; os providers (Evolution, Twilio, e-mail) passam a ser burros e só transportam o texto já renderizado.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma + Supabase, Zod, TanStack Query, Shadcn UI, Vitest.

## Global Constraints

- **Idioma:** todo output em Português do Brasil — código, comentários, commits, logs, UI.
- **Multi-tenancy:** todo repository filtra por `tenantId` em TODAS as queries; `tenantId` vem sempre do token via `getSessionContext()`, nunca do body ou da URL.
- **Camadas:** API Route (controller fino, valida com Zod) → Service (regra de negócio) → Repository (dados) → Prisma.
- **TypeScript:** strict, sem `any`, sem `as unknown as`.
- **Erros:** sempre erros de domínio tipados de `src/shared/errors/`. Nunca `throw new Error('string')`.
- **Nenhum campo novo entra na query de sessão (`/me`).** Precedente: coluna nova acoplada ao `/me` já causou logout global (P2022) duas vezes quando a migration atrasou.
- **A Vercel não roda migrations no build.** `prisma migrate deploy` é manual e vai no runbook.
- **Fuso horário:** toda formatação de data/hora usa `tenant.timezone` via `Intl.DateTimeFormat`, nunca o fuso do processo.
- **Mensagens padrão do sistema continuam existindo.** O catálogo *é* o conjunto de mensagens genéricas do Agendê. Tenant sem registro no banco usa o padrão — não recebe cópia dos defaults na criação.
- **Gate de entrega:** `npx tsc --noEmit` com zero erros e `npx vitest run` com tudo verde antes de cada commit de tarefa.
- **Branch:** todo o trabalho desta fase acontece em `feat/motor-mensagens-cliente-fase-1`. Nunca commitar em `main`.

### Restrição herdada do Twilio (decisão registrada nesta fase)

O `TwilioProvider` hoje envia via `contentSid` — templates pré-aprovados na Twilio, com os fragmentos do tenant entrando como variáveis numeradas ([`whatsapp.provider.ts:117-161`](../../../src/domains/notifications/providers/whatsapp.provider.ts#L117-L161)). Texto livre escrito pelo tenant é **incompatível** com esse caminho.

**Decisão:** o Twilio passa a enviar o texto renderizado como `body`. Isso funciona dentro da janela de 24 h de atendimento do WhatsApp Business e falha fora dela. É aceitável porque o Twilio é **fallback** — a Evolution é o provedor primário e por-tenant, e o Twilio só entra quando a Evolution falha ou não está conectada. A alternativa (manter `contentSid`) faria a personalização do tenant ser silenciosamente ignorada no fallback, o que é pior: o tenant veria seu texto salvo e o cliente receberia outro. As env vars `TWILIO_TPL_*` deixam de ser obrigatórias.

---

## Estrutura de arquivos

**Diretório novo:** `src/domains/notifications/customer-messages/`

| Arquivo | Responsabilidade |
|---|---|
| `customer-message-catalog.ts` | Mensagens padrão do sistema, variáveis por evento, natureza (transacional/promocional), mapa `template legado → evento` |
| `customer-message-variables.ts` | Monta o dicionário de variáveis a partir do contexto (formatação no fuso do tenant) |
| `legacy-template-backfill.ts` | Converte `whatsappTemplateConfig` legado em corpo de template (função pura, usada pelo script e pelos testes) |
| `customer-message-template.repository.ts` | Acesso a `CustomerMessageTemplate`, sempre filtrando `tenantId` |
| `customer-message.service.ts` | Resolve template (banco → catálogo) e renderiza |
| `schemas.ts` | Zod de entrada da API de templates |
| `types.ts` | Tipos do subdomínio |

**Arquivos modificados:**

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | Enum `CustomerMessageEvent`, model `CustomerMessageTemplate`, relação em `Tenant` |
| `providers/whatsapp-provider.interface.ts` | `send()` passa a receber a mensagem já renderizada |
| `providers/evolution.provider.ts` | Remove `buildEvolutionMessage`, `TEMPLATE_DEFAULTS`, `TEMPLATE_TO_CONFIG_KEY`; suporta `mediaUrl` |
| `providers/whatsapp.provider.ts` | Remove `TEMPLATE_DEFAULTS`, `TEMPLATE_TO_CONFIG_KEY`, `TEMPLATE_SIDS`, `buildTwilioTemplateParams`; envia `body` |
| `providers/whatsapp.gateway.ts` | Renderiza antes de chamar o provider |
| `providers/email-templates.ts` | Remove os 3 `booking*Html`; adiciona layout único parametrizado |
| `notification.service.ts` | Remove `EMAIL_SUBJECTS` e `buildEmailHtml`; usa o service novo |
| `app/api/whatsapp/templates/route.ts` | **Deletado**, substituído pela rota nova |
| `app/(app)/configuracoes/notificacoes/page.tsx` | Terceira sub-aba "Mensagens ao cliente" |

**Arquivos criados (fora do domínio):**

| Arquivo | Responsabilidade |
|---|---|
| `src/app/api/notifications/customer-templates/route.ts` | GET (lista) e PUT (salva) |
| `src/app/api/notifications/customer-templates/[event]/[channel]/route.ts` | DELETE (restaurar padrão) |
| `src/hooks/settings/use-customer-message-templates.ts` | TanStack Query |
| `src/components/domain/settings/customer-message-list.tsx` | Lista de eventos (cartões no mobile) |
| `src/components/domain/settings/customer-message-editor.tsx` | Editor com chips e prévia |
| `scripts/backfill-customer-message-templates.mjs` | Backfill de produção |

---

## Task 1: Catálogo de mensagens do sistema

**Files:**
- Create: `src/domains/notifications/customer-messages/types.ts`
- Create: `src/domains/notifications/customer-messages/customer-message-catalog.ts`
- Test: `src/domains/notifications/customer-messages/customer-message-catalog.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro, sem Prisma).
- Produces:
  - `type CustomerMessageNature = "transactional" | "promotional"`
  - `type CustomerMessageChannel = "WHATSAPP" | "EMAIL"`
  - `type LegacyTemplateBinding = { configKey: string; principal: string; final: string; scaffold: (principal: string, final: string) => string }`
  - `type CustomerMessageCatalogEntry = { event: CustomerMessageEventKey; label: string; description: string; nature: CustomerMessageNature; defaultEnabled: boolean; variables: string[]; defaults: Record<CustomerMessageChannel, { subject: string | null; body: string }>; legacy: LegacyTemplateBinding | null }`
  - `type CustomerMessageEventKey` — união de strings, espelhando o enum do Prisma criado na Task 3
  - `const CUSTOMER_MESSAGE_CATALOG: CustomerMessageCatalogEntry[]`
  - `const CUSTOMER_MESSAGE_CATALOG_MAP: Record<CustomerMessageEventKey, CustomerMessageCatalogEntry>`
  - `function getCatalogEntry(event: CustomerMessageEventKey): CustomerMessageCatalogEntry`
  - `const LEGACY_TEMPLATE_TO_EVENT: Record<string, CustomerMessageEventKey>` — mapeia as strings antigas (`"appointment-created"`…) para o evento novo

> O tipo `CustomerMessageEventKey` é declarado como união de strings aqui (e não importado do `@prisma/client`) para que este módulo seja puro e testável sem o Prisma Client gerado. A Task 3 cria o enum no schema com exatamente os mesmos valores, e a Task 4 adiciona a asserção de compatibilidade entre os dois.

- [ ] **Step 1: Criar o arquivo de tipos**

`src/domains/notifications/customer-messages/types.ts`:

```ts
export type CustomerMessageEventKey =
  | "appointment_requested"
  | "appointment_created"
  | "appointment_confirmed"
  | "appointment_rescheduled"
  | "appointment_cancelled"
  | "appointment_no_show"
  | "appointment_reminder"
  | "birthday"
  | "return_due"
  | "winback";

export type CustomerMessageChannel = "WHATSAPP" | "EMAIL";

/**
 * Transacional = comunicação sobre um horário que o cliente marcou. Nunca respeita
 * opt-out de marketing e nunca conta no anti-fadiga. Promocional = o oposto.
 */
export type CustomerMessageNature = "transactional" | "promotional";

/**
 * Ligação com a configuração legada (`Tenant.whatsappTemplateConfig`), usada apenas
 * pelo backfill da Fase 1. Eventos sem equivalente legado têm `legacy: null`.
 */
export type LegacyTemplateBinding = {
  configKey: string;
  principal: string;
  final: string;
  scaffold: (principal: string, final: string) => string;
};

export type CustomerMessageCatalogEntry = {
  event: CustomerMessageEventKey;
  label: string;
  description: string;
  nature: CustomerMessageNature;
  defaultEnabled: boolean;
  variables: string[];
  defaults: Record<CustomerMessageChannel, { subject: string | null; body: string }>;
  legacy: LegacyTemplateBinding | null;
};

export type RenderedCustomerMessage = {
  subject: string | null;
  text: string;
  mediaUrl: string | null;
};
```

- [ ] **Step 2: Escrever o teste do catálogo (falhando)**

`src/domains/notifications/customer-messages/customer-message-catalog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CUSTOMER_MESSAGE_CATALOG,
  CUSTOMER_MESSAGE_CATALOG_MAP,
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
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domains/notifications/customer-messages/customer-message-catalog.test.ts`
Expected: FAIL — `Failed to resolve import "./customer-message-catalog"`.

- [ ] **Step 4: Implementar o catálogo**

`src/domains/notifications/customer-messages/customer-message-catalog.ts`:

```ts
import type {
  CustomerMessageCatalogEntry,
  CustomerMessageEventKey,
} from "./types";

// Variáveis comuns a todo evento ligado a um agendamento.
const VARS_AGENDAMENTO = [
  "cliente",
  "primeiro_nome",
  "servico",
  "profissional",
  "data",
  "hora",
  "dia_semana",
  "duracao",
  "valor",
  "negocio",
  "endereco",
  "telefone_negocio",
  "link_agendamento",
  "link_portal",
];

const VARS_CLIENTE = [
  "cliente",
  "primeiro_nome",
  "negocio",
  "endereco",
  "telefone_negocio",
  "link_agendamento",
  "link_portal",
];

/**
 * Esqueleto que reproduz exatamente o texto que o sistema envia hoje em
 * `buildEvolutionMessage` para os eventos com data/hora. Manter idêntico: o teste de
 * equivalência da Task 6 depende disto para garantir que nenhum tenant perceba a migração.
 */
const scaffoldComDataHora = (principal: string, final: string) =>
  `Olá, {{cliente}}! ${principal} 📅 {{data}} às {{hora}} | {{servico}} | {{negocio}}. ${final} 🔗 {{link_agendamento}}`;

/** Esqueleto de `appointment-reminder`: só hora, sem data e sem link. */
const scaffoldLembrete = (principal: string, final: string) =>
  `Olá, {{cliente}}! ${principal} Hoje às {{hora}} | {{servico}} | {{negocio}}. ${final}`;

/** Esqueleto sem data/hora: cancelamento e no-show. */
const scaffoldSimples = (principal: string, final: string) =>
  `Olá, {{cliente}}! ${principal} | {{servico}} | {{negocio}}. ${final}`;

/** Esqueleto de aniversário: sem serviço. */
const scaffoldAniversario = (principal: string, final: string) =>
  `Olá, {{cliente}}! ${principal} De {{negocio}}. ${final}`;

export const CUSTOMER_MESSAGE_CATALOG: CustomerMessageCatalogEntry[] = [
  {
    event: "appointment_requested",
    label: "Pedido de agendamento recebido",
    description:
      "Enviada quando o cliente agenda pela vitrine pública e o horário ainda aguarda sua confirmação.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: "Olá, {{cliente}}! 📝 Recebemos seu pedido de agendamento para {{servico}} em {{data}} às {{hora}}. Assim que confirmarmos, te aviso por aqui. — {{negocio}}",
      },
      EMAIL: {
        subject: "Recebemos seu pedido de agendamento",
        body: "Olá, {{cliente}}!\n\nRecebemos seu pedido de agendamento:\n\n{{servico}} — {{data}} às {{hora}}\n\nAssim que confirmarmos, você recebe um novo aviso.\n\n— {{negocio}}",
      },
    },
    legacy: null,
  },
  {
    event: "appointment_created",
    label: "Agendamento criado",
    description: "Enviada quando você marca um horário pelo painel.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldComDataHora("Seu agendamento foi criado.", "Até lá!"),
      },
      EMAIL: {
        subject: "Agendamento confirmado",
        body: "Olá, {{cliente}}!\n\nSeu agendamento foi criado:\n\n{{servico}} — {{data}} às {{hora}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "confirmacao",
      principal: "Seu agendamento foi criado.",
      final: "Até lá!",
      scaffold: scaffoldComDataHora,
    },
  },
  {
    event: "appointment_confirmed",
    label: "Agendamento confirmado",
    description: "Enviada quando você confirma um pedido feito pela vitrine pública.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldComDataHora("Seu agendamento está confirmado.", "Te esperamos!"),
      },
      EMAIL: {
        subject: "Agendamento confirmado",
        body: "Olá, {{cliente}}!\n\nSeu agendamento está confirmado:\n\n{{servico}} — {{data}} às {{hora}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "confirmado",
      principal: "Seu agendamento está confirmado.",
      final: "Te esperamos!",
      scaffold: scaffoldComDataHora,
    },
  },
  {
    event: "appointment_rescheduled",
    label: "Agendamento remarcado",
    description: "Enviada quando a data ou a hora de um agendamento muda.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: "Olá, {{cliente}}! Seu agendamento foi remarcado para {{data}} às {{hora}} | {{servico}} | {{negocio}}.",
      },
      EMAIL: {
        subject: "Seu agendamento foi remarcado",
        body: "Olá, {{cliente}}!\n\nSeu agendamento foi remarcado:\n\n{{servico}} — {{data}} às {{hora}}\n\n— {{negocio}}",
      },
    },
    legacy: null,
  },
  {
    event: "appointment_cancelled",
    label: "Agendamento cancelado",
    description: "Enviada quando um agendamento é cancelado.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldSimples(
          "Seu agendamento foi cancelado.",
          "Para reagendar, entre em contato conosco.",
        ),
      },
      EMAIL: {
        subject: "Agendamento cancelado",
        body: "Olá, {{cliente}}.\n\nSeu agendamento de {{servico}} foi cancelado.\n\nPara reagendar, entre em contato: {{telefone_negocio}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "cancelamento",
      principal: "Seu agendamento foi cancelado.",
      final: "Para reagendar, entre em contato conosco.",
      scaffold: scaffoldSimples,
    },
  },
  {
    event: "appointment_no_show",
    label: "Falta registrada",
    description: "Enviada quando você registra que o cliente não compareceu.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldSimples(
          "Notamos que você não compareceu ao seu horário.",
          "Quando quiser reagendar, estamos à disposição!",
        ),
      },
      EMAIL: {
        subject: "Sentimos sua falta",
        body: "Olá, {{cliente}}.\n\nNotamos que você não compareceu ao horário de {{servico}}.\n\nQuando quiser reagendar, estamos à disposição.\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "nao_comparecimento",
      principal: "Notamos que você não compareceu ao seu horário.",
      final: "Quando quiser reagendar, estamos à disposição!",
      scaffold: scaffoldSimples,
    },
  },
  {
    event: "appointment_reminder",
    label: "Lembrete de horário",
    description: "Enviada automaticamente antes do atendimento, no prazo que você configurou.",
    nature: "transactional",
    defaultEnabled: true,
    variables: VARS_AGENDAMENTO,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldLembrete("Lembrete:", "Até lá!"),
      },
      EMAIL: {
        subject: "Lembrete do seu agendamento",
        body: "Olá, {{cliente}}!\n\nLembrete do seu agendamento:\n\n{{servico}} — {{data}} às {{hora}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "lembrete",
      principal: "Lembrete:",
      final: "Até lá!",
      scaffold: scaffoldLembrete,
    },
  },
  {
    event: "birthday",
    label: "Aniversário",
    description: "Enviada no aniversário do cliente.",
    nature: "promotional",
    defaultEnabled: false,
    variables: VARS_CLIENTE,
    defaults: {
      WHATSAPP: {
        subject: null,
        body: scaffoldAniversario(
          "Feliz aniversário! Temos um presente especial para você.",
          "Venha nos visitar em breve!",
        ),
      },
      EMAIL: {
        subject: "Feliz aniversário!",
        body: "Olá, {{cliente}}!\n\nFeliz aniversário! Temos um presente especial para você.\n\nVenha nos visitar: {{link_agendamento}}\n\n— {{negocio}}",
      },
    },
    legacy: {
      configKey: "aniversario",
      principal: "Feliz aniversário! Temos um presente especial para você.",
      final: "Venha nos visitar em breve!",
      scaffold: scaffoldAniversario,
    },
  },
  {
    event: "return_due",
    label: "Hora do retorno",
    description:
      "Enviada quando chega a data de retorno recomendada do serviço que o cliente fez.",
    nature: "promotional",
    defaultEnabled: false,
    variables: [...VARS_CLIENTE, "ultimo_servico", "dias_sem_vir"],
    defaults: {
      WHATSAPP: {
        subject: null,
        body: "Oi, {{primeiro_nome}}! 💇 Já faz {{dias_sem_vir}} dias desde seu último {{ultimo_servico}} — costuma ser a hora de renovar. Quer garantir seu horário? 🔗 {{link_agendamento}}",
      },
      EMAIL: {
        subject: "Já é hora do seu retorno",
        body: "Oi, {{primeiro_nome}}!\n\nJá faz {{dias_sem_vir}} dias desde seu último {{ultimo_servico}}.\n\nQuer garantir seu horário? {{link_agendamento}}\n\n— {{negocio}}",
      },
    },
    legacy: null,
  },
  {
    event: "winback",
    label: "Reconquista",
    description: "Enviada para clientes que estão há muito tempo sem aparecer.",
    nature: "promotional",
    defaultEnabled: false,
    variables: [...VARS_CLIENTE, "ultimo_servico", "dias_sem_vir"],
    defaults: {
      WHATSAPP: {
        subject: null,
        body: "Oi, {{primeiro_nome}}! Sentimos sua falta por aqui — já são {{dias_sem_vir}} dias. 💛 Que tal marcar um horário? 🔗 {{link_agendamento}}",
      },
      EMAIL: {
        subject: "Sentimos sua falta",
        body: "Oi, {{primeiro_nome}}!\n\nSentimos sua falta por aqui — já são {{dias_sem_vir}} dias.\n\nQue tal marcar um horário? {{link_agendamento}}\n\n— {{negocio}}",
      },
    },
    legacy: null,
  },
];

export const CUSTOMER_MESSAGE_CATALOG_MAP = Object.fromEntries(
  CUSTOMER_MESSAGE_CATALOG.map((entrada) => [entrada.event, entrada]),
) as Record<CustomerMessageEventKey, CustomerMessageCatalogEntry>;

export function getCatalogEntry(event: CustomerMessageEventKey): CustomerMessageCatalogEntry {
  return CUSTOMER_MESSAGE_CATALOG_MAP[event];
}

/**
 * `NotificationDraft.template` ainda usa os nomes antigos com hífen. Este mapa permite
 * traduzir sem tocar em `subscriptions.ts` nem nos jobs nesta fase.
 */
export const LEGACY_TEMPLATE_TO_EVENT: Record<string, CustomerMessageEventKey> = {
  "appointment-created": "appointment_created",
  "appointment-confirmed": "appointment_confirmed",
  "appointment-rescheduled": "appointment_rescheduled",
  "appointment-cancelled": "appointment_cancelled",
  "appointment-no-show": "appointment_no_show",
  "appointment-reminder": "appointment_reminder",
  birthday: "birthday",
};
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domains/notifications/customer-messages/customer-message-catalog.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/motor-mensagens-cliente-fase-1
git add src/domains/notifications/customer-messages/
git commit -m "feat(notifications): catálogo de mensagens padrão do sistema ao cliente"
```

---

## Task 2: Construtor de variáveis

**Files:**
- Create: `src/domains/notifications/customer-messages/customer-message-variables.ts`
- Test: `src/domains/notifications/customer-messages/customer-message-variables.test.ts`

**Interfaces:**
- Consumes: `TemplateVariables` de `../user-notifications/notification-template-engine`.
- Produces:
  - `type CustomerMessageContext = { customerName: string; serviceName?: string; professionalName?: string; startsAt?: Date; durationMinutes?: number; price?: number; daysSinceLastVisit?: number; lastServiceName?: string; tenant: { name: string; slug: string; timezone: string; phone?: string | null; address?: string | null } }`
  - `function buildCustomerMessageVariables(ctx: CustomerMessageContext): TemplateVariables`

- [ ] **Step 1: Escrever o teste (falhando)**

`src/domains/notifications/customer-messages/customer-message-variables.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCustomerMessageVariables } from "./customer-message-variables";

const tenant = {
  name: "Salão da Lu",
  slug: "salao-da-lu",
  timezone: "America/Sao_Paulo",
  phone: "(11) 99999-0000",
  address: "Rua X, 123",
};

describe("buildCustomerMessageVariables", () => {
  it("formata data e hora no fuso do tenant, não no fuso do processo", () => {
    // 02/08/2026 14:00 em São Paulo = 17:00Z
    const vars = buildCustomerMessageVariables({
      customerName: "Maria Silva",
      serviceName: "Escova",
      startsAt: new Date("2026-08-02T17:00:00.000Z"),
      tenant,
    });
    expect(vars.data).toBe("02/08/2026");
    expect(vars.hora).toBe("14:00");
    expect(vars.dia_semana).toBe("domingo");
  });

  it("usa o fuso do tenant mesmo quando ele difere de São Paulo", () => {
    const vars = buildCustomerMessageVariables({
      customerName: "Maria",
      startsAt: new Date("2026-08-02T17:00:00.000Z"),
      tenant: { ...tenant, timezone: "America/Manaus" },
    });
    expect(vars.hora).toBe("13:00");
  });

  it("extrai o primeiro nome", () => {
    const vars = buildCustomerMessageVariables({ customerName: "Maria Silva", tenant });
    expect(vars.primeiro_nome).toBe("Maria");
  });

  it("primeiro nome de nome simples é o próprio nome", () => {
    const vars = buildCustomerMessageVariables({ customerName: "Maria", tenant });
    expect(vars.primeiro_nome).toBe("Maria");
  });

  it("formata valor em real e duração em minutos", () => {
    const vars = buildCustomerMessageVariables({
      customerName: "Maria",
      price: 80,
      durationMinutes: 45,
      tenant,
    });
    expect(vars.valor).toBe("R$ 80,00");
    expect(vars.duracao).toBe("45 min");
  });

  it("monta os links a partir do slug", () => {
    const vars = buildCustomerMessageVariables({ customerName: "Maria", tenant });
    expect(vars.link_agendamento).toContain("/salao-da-lu");
    expect(vars.link_portal).toContain("/salao-da-lu/portal");
  });

  it("devolve string vazia para todo campo ausente, nunca undefined", () => {
    const vars = buildCustomerMessageVariables({ customerName: "Maria", tenant });
    expect(vars.data).toBe("");
    expect(vars.hora).toBe("");
    expect(vars.servico).toBe("");
    expect(vars.profissional).toBe("");
    expect(vars.valor).toBe("");
    expect(vars.duracao).toBe("");
    expect(vars.dias_sem_vir).toBe("");
    expect(vars.ultimo_servico).toBe("");
    for (const valor of Object.values(vars)) {
      expect(typeof valor).toBe("string");
    }
  });

  it("aceita telefone e endereço nulos", () => {
    const vars = buildCustomerMessageVariables({
      customerName: "Maria",
      tenant: { ...tenant, phone: null, address: null },
    });
    expect(vars.telefone_negocio).toBe("");
    expect(vars.endereco).toBe("");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domains/notifications/customer-messages/customer-message-variables.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

`src/domains/notifications/customer-messages/customer-message-variables.ts`:

```ts
import type { TemplateVariables } from "../user-notifications/notification-template-engine";

export type CustomerMessageContext = {
  customerName: string;
  serviceName?: string;
  professionalName?: string;
  startsAt?: Date;
  durationMinutes?: number;
  price?: number;
  daysSinceLastVisit?: number;
  lastServiceName?: string;
  tenant: {
    name: string;
    slug: string;
    timezone: string;
    phone?: string | null;
    address?: string | null;
  };
};

function formatar(date: Date, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, ...options }).format(date);
}

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? "";
}

/**
 * Monta o dicionário de variáveis do template. Todo valor é string — campo ausente vira
 * string vazia, para que `interpolateTemplate` nunca produza "undefined" no texto enviado.
 */
export function buildCustomerMessageVariables(ctx: CustomerMessageContext): TemplateVariables {
  const tz = ctx.tenant.timezone;
  const appUrl = process.env.APP_URL ?? "";

  return {
    cliente: ctx.customerName,
    primeiro_nome: primeiroNome(ctx.customerName),
    servico: ctx.serviceName ?? "",
    profissional: ctx.professionalName ?? "",
    data: ctx.startsAt
      ? formatar(ctx.startsAt, tz, { day: "2-digit", month: "2-digit", year: "numeric" })
      : "",
    hora: ctx.startsAt ? formatar(ctx.startsAt, tz, { hour: "2-digit", minute: "2-digit" }) : "",
    dia_semana: ctx.startsAt ? formatar(ctx.startsAt, tz, { weekday: "long" }) : "",
    duracao: ctx.durationMinutes !== undefined ? `${ctx.durationMinutes} min` : "",
    valor:
      ctx.price !== undefined
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.price)
        : "",
    negocio: ctx.tenant.name,
    endereco: ctx.tenant.address ?? "",
    telefone_negocio: ctx.tenant.phone ?? "",
    link_agendamento: `${appUrl}/${ctx.tenant.slug}`,
    link_portal: `${appUrl}/${ctx.tenant.slug}/portal`,
    dias_sem_vir: ctx.daysSinceLastVisit !== undefined ? String(ctx.daysSinceLastVisit) : "",
    ultimo_servico: ctx.lastServiceName ?? "",
  };
}
```

> `Intl.NumberFormat` para BRL produz espaço não-quebrável entre "R$" e o número em alguns
> runtimes. Se o teste do valor falhar por isso, normalize com
> `.replace(/ /g, " ")` no retorno — e mantenha a asserção como está.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domains/notifications/customer-messages/customer-message-variables.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/customer-messages/customer-message-variables.ts src/domains/notifications/customer-messages/customer-message-variables.test.ts
git commit -m "feat(notifications): construtor de variáveis de mensagem no fuso do tenant"
```

---

## Task 3: Schema Prisma — enum e model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_customer_message_template/migration.sql` (gerado)

**Interfaces:**
- Produces: enum `CustomerMessageEvent` e model `CustomerMessageTemplate` no Prisma Client, com os mesmos 10 valores de `CustomerMessageEventKey` da Task 1.

- [ ] **Step 1: Adicionar o enum e o model ao schema**

Em `prisma/schema.prisma`, junto dos demais enums de notificação:

```prisma
enum CustomerMessageEvent {
  appointment_requested
  appointment_created
  appointment_confirmed
  appointment_rescheduled
  appointment_cancelled
  appointment_no_show
  appointment_reminder
  birthday
  return_due
  winback
}
```

E o model:

```prisma
model CustomerMessageTemplate {
  id        String               @id @default(cuid())
  tenantId  String
  event     CustomerMessageEvent
  channel   NotificationChannel
  subject   String?
  body      String               @db.Text
  mediaUrl  String?
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, event, channel])
  @@index([tenantId])
}
```

- [ ] **Step 2: Adicionar a relação inversa no model `Tenant`**

Na lista de relações do model `Tenant`, ao lado de `notificationTemplates`:

```prisma
  customerMessageTemplates    CustomerMessageTemplate[]
```

- [ ] **Step 3: Gerar a migration sem aplicar e revisar o SQL**

```bash
npx prisma migrate dev --create-only --name add_customer_message_template
```

Revise o SQL gerado. Ele deve conter apenas `CREATE TYPE`, `CREATE TABLE`, `CREATE UNIQUE INDEX`,
`CREATE INDEX` e `ALTER TABLE ... ADD CONSTRAINT`. **Se aparecer qualquer `DROP`, pare e investigue** —
esta migration é puramente aditiva.

- [ ] **Step 4: Aplicar localmente e gerar o client**

```bash
npx prisma migrate dev
npx prisma generate
```

- [ ] **Step 5: Verificar a compilação**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(notifications): model CustomerMessageTemplate e enum CustomerMessageEvent"
```

---

## Task 4: Repository de templates

**Files:**
- Create: `src/domains/notifications/customer-messages/customer-message-template.repository.ts`
- Test: `src/domains/notifications/customer-messages/customer-message-template.repository.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/shared/database/prisma`; `CustomerMessageEventKey` da Task 1.
- Produces:
  - `customerMessageTemplateRepository.findByEvent(tenantId: string, event: CustomerMessageEventKey, channel: "WHATSAPP" | "EMAIL"): Promise<CustomerMessageTemplate | null>`
  - `customerMessageTemplateRepository.listByTenant(tenantId: string): Promise<CustomerMessageTemplate[]>`
  - `customerMessageTemplateRepository.upsert(tenantId: string, input: { event: CustomerMessageEventKey; channel: "WHATSAPP" | "EMAIL"; subject: string | null; body: string; mediaUrl: string | null }): Promise<CustomerMessageTemplate>`
  - `customerMessageTemplateRepository.remove(tenantId: string, event: CustomerMessageEventKey, channel: "WHATSAPP" | "EMAIL"): Promise<void>`

- [ ] **Step 1: Escrever o teste (falhando)**

Siga o padrão de mock já usado em `src/shared/test/prisma-mock.ts`.

`src/domains/notifications/customer-messages/customer-message-template.repository.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { customerMessageTemplateRepository } from "./customer-message-template.repository";

describe("customerMessageTemplateRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByEvent filtra por tenantId, evento e canal", async () => {
    prismaMock.customerMessageTemplate.findFirst.mockResolvedValue(null);

    await customerMessageTemplateRepository.findByEvent("tenant-1", "appointment_created", "WHATSAPP");

    expect(prismaMock.customerMessageTemplate.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", event: "appointment_created", channel: "WHATSAPP" },
    });
  });

  it("listByTenant filtra por tenantId", async () => {
    prismaMock.customerMessageTemplate.findMany.mockResolvedValue([]);

    await customerMessageTemplateRepository.listByTenant("tenant-1");

    expect(prismaMock.customerMessageTemplate.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
    });
  });

  it("upsert usa a chave composta e grava o tenantId no create", async () => {
    prismaMock.customerMessageTemplate.upsert.mockResolvedValue({} as never);

    await customerMessageTemplateRepository.upsert("tenant-1", {
      event: "appointment_cancelled",
      channel: "WHATSAPP",
      subject: null,
      body: "Oi {{cliente}}",
      mediaUrl: null,
    });

    expect(prismaMock.customerMessageTemplate.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_event_channel: {
          tenantId: "tenant-1",
          event: "appointment_cancelled",
          channel: "WHATSAPP",
        },
      },
      create: {
        tenantId: "tenant-1",
        event: "appointment_cancelled",
        channel: "WHATSAPP",
        subject: null,
        body: "Oi {{cliente}}",
        mediaUrl: null,
      },
      update: { subject: null, body: "Oi {{cliente}}", mediaUrl: null },
    });
  });

  it("remove apaga apenas do tenant informado", async () => {
    prismaMock.customerMessageTemplate.deleteMany.mockResolvedValue({ count: 1 });

    await customerMessageTemplateRepository.remove("tenant-1", "birthday", "EMAIL");

    expect(prismaMock.customerMessageTemplate.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", event: "birthday", channel: "EMAIL" },
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domains/notifications/customer-messages/customer-message-template.repository.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
import type { CustomerMessageTemplate } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

import type { CustomerMessageChannel, CustomerMessageEventKey } from "./types";

export type CustomerMessageTemplateInput = {
  event: CustomerMessageEventKey;
  channel: CustomerMessageChannel;
  subject: string | null;
  body: string;
  mediaUrl: string | null;
};

export class CustomerMessageTemplateRepository {
  async findByEvent(
    tenantId: string,
    event: CustomerMessageEventKey,
    channel: CustomerMessageChannel,
  ): Promise<CustomerMessageTemplate | null> {
    return prisma.customerMessageTemplate.findFirst({
      where: { tenantId, event, channel },
    });
  }

  async listByTenant(tenantId: string): Promise<CustomerMessageTemplate[]> {
    return prisma.customerMessageTemplate.findMany({ where: { tenantId } });
  }

  async upsert(
    tenantId: string,
    input: CustomerMessageTemplateInput,
  ): Promise<CustomerMessageTemplate> {
    return prisma.customerMessageTemplate.upsert({
      where: {
        tenantId_event_channel: { tenantId, event: input.event, channel: input.channel },
      },
      create: {
        tenantId,
        event: input.event,
        channel: input.channel,
        subject: input.subject,
        body: input.body,
        mediaUrl: input.mediaUrl,
      },
      update: { subject: input.subject, body: input.body, mediaUrl: input.mediaUrl },
    });
  }

  /**
   * Apagar o registro é o que "restaurar padrão" faz: sem registro, a resolução cai
   * no catálogo do sistema. `deleteMany` em vez de `delete` para não lançar quando
   * o tenant nunca personalizou aquele evento.
   */
  async remove(
    tenantId: string,
    event: CustomerMessageEventKey,
    channel: CustomerMessageChannel,
  ): Promise<void> {
    await prisma.customerMessageTemplate.deleteMany({ where: { tenantId, event, channel } });
  }
}

export const customerMessageTemplateRepository = new CustomerMessageTemplateRepository();
```

- [ ] **Step 4: Adicionar a asserção de compatibilidade entre o enum e a união de strings**

Ao final de `src/domains/notifications/customer-messages/types.ts`:

```ts
import type { CustomerMessageEvent } from "@prisma/client";

/**
 * Garante em tempo de compilação que `CustomerMessageEventKey` e o enum do Prisma têm
 * exatamente os mesmos valores. Se alguém adicionar um evento em só um dos dois lugares,
 * `npx tsc --noEmit` quebra aqui.
 */
type AssertMesmosValores<A extends B, B extends A> = true;
export type _EnumEmSincronia = AssertMesmosValores<
  CustomerMessageEventKey,
  `${CustomerMessageEvent}`
>;
```

- [ ] **Step 5: Rodar teste e compilação**

Run: `npx vitest run src/domains/notifications/customer-messages/customer-message-template.repository.test.ts && npx tsc --noEmit`
Expected: PASS — 4 testes; zero erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/customer-messages/
git commit -m "feat(notifications): repository de templates de mensagem ao cliente"
```

---

## Task 5: Service de resolução e renderização

**Files:**
- Create: `src/domains/notifications/customer-messages/customer-message.service.ts`
- Test: `src/domains/notifications/customer-messages/customer-message.service.test.ts`

**Interfaces:**
- Consumes: `customerMessageTemplateRepository` (Task 4), `getCatalogEntry` (Task 1), `buildCustomerMessageVariables` (Task 2), `interpolateTemplate` de `../user-notifications/notification-template-engine`.
- Produces:
  - `type ResolvedCustomerTemplate = { subject: string | null; body: string; mediaUrl: string | null; isCustom: boolean }`
  - `customerMessageService.resolveTemplate(tenantId, event, channel): Promise<ResolvedCustomerTemplate>`
  - `customerMessageService.render(tenantId, event, channel, ctx: CustomerMessageContext): Promise<RenderedCustomerMessage>`

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { customerMessageService } from "./customer-message.service";
import { customerMessageTemplateRepository } from "./customer-message-template.repository";
import { getCatalogEntry } from "./customer-message-catalog";

vi.mock("./customer-message-template.repository", () => ({
  customerMessageTemplateRepository: { findByEvent: vi.fn() },
}));

const repo = vi.mocked(customerMessageTemplateRepository);

const tenant = {
  name: "Salão da Lu",
  slug: "salao-da-lu",
  timezone: "America/Sao_Paulo",
  phone: "(11) 99999-0000",
  address: "Rua X, 123",
};

describe("customerMessageService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("usa o padrão do catálogo quando o tenant não personalizou", async () => {
    repo.findByEvent.mockResolvedValue(null);

    const resolvido = await customerMessageService.resolveTemplate(
      "tenant-1",
      "appointment_created",
      "WHATSAPP",
    );

    expect(resolvido.isCustom).toBe(false);
    expect(resolvido.body).toBe(getCatalogEntry("appointment_created").defaults.WHATSAPP.body);
  });

  it("a personalização do tenant sobrescreve o padrão", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: null,
      body: "Oi {{primeiro_nome}}, tudo certo!",
      mediaUrl: null,
    } as never);

    const resolvido = await customerMessageService.resolveTemplate(
      "tenant-1",
      "appointment_created",
      "WHATSAPP",
    );

    expect(resolvido.isCustom).toBe(true);
    expect(resolvido.body).toBe("Oi {{primeiro_nome}}, tudo certo!");
  });

  it("renderiza interpolando as variáveis do contexto", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: null,
      body: "Oi {{primeiro_nome}}! {{servico}} em {{data}} às {{hora}}.",
      mediaUrl: null,
    } as never);

    const render = await customerMessageService.render(
      "tenant-1",
      "appointment_created",
      "WHATSAPP",
      {
        customerName: "Maria Silva",
        serviceName: "Escova",
        startsAt: new Date("2026-08-02T17:00:00.000Z"),
        tenant,
      },
    );

    expect(render.text).toBe("Oi Maria! Escova em 02/08/2026 às 14:00.");
    expect(render.subject).toBeNull();
  });

  it("variável desconhecida vira string vazia e não quebra o envio", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: null,
      body: "Oi {{cliente}}, {{variavel_inexistente}}fim",
      mediaUrl: null,
    } as never);

    const render = await customerMessageService.render(
      "tenant-1",
      "appointment_created",
      "WHATSAPP",
      { customerName: "Maria", tenant },
    );

    expect(render.text).toBe("Oi Maria, fim");
  });

  it("escapa HTML no canal EMAIL e não escapa no WHATSAPP", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: "Oi {{cliente}}",
      body: "Olá {{cliente}}",
      mediaUrl: null,
    } as never);

    const email = await customerMessageService.render("t", "appointment_created", "EMAIL", {
      customerName: "Maria <script>",
      tenant,
    });
    expect(email.text).toContain("&lt;script&gt;");
    expect(email.subject).toContain("&lt;script&gt;");

    const whats = await customerMessageService.render("t", "appointment_created", "WHATSAPP", {
      customerName: "Maria <script>",
      tenant,
    });
    expect(whats.text).toContain("<script>");
  });

  it("propaga a mediaUrl da personalização", async () => {
    repo.findByEvent.mockResolvedValue({
      subject: null,
      body: "Oi",
      mediaUrl: "https://cdn.exemplo/banner.png",
    } as never);

    const render = await customerMessageService.render("t", "birthday", "WHATSAPP", {
      customerName: "Maria",
      tenant,
    });

    expect(render.mediaUrl).toBe("https://cdn.exemplo/banner.png");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domains/notifications/customer-messages/customer-message.service.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
import { interpolateTemplate } from "../user-notifications/notification-template-engine";

import { getCatalogEntry } from "./customer-message-catalog";
import { buildCustomerMessageVariables, type CustomerMessageContext } from "./customer-message-variables";
import { customerMessageTemplateRepository } from "./customer-message-template.repository";
import type {
  CustomerMessageChannel,
  CustomerMessageEventKey,
  RenderedCustomerMessage,
} from "./types";

export type ResolvedCustomerTemplate = {
  subject: string | null;
  body: string;
  mediaUrl: string | null;
  /** true = o tenant personalizou; false = está usando a mensagem padrão do sistema. */
  isCustom: boolean;
};

export class CustomerMessageService {
  /**
   * Duas camadas: personalização do tenant sobrescreve o padrão do sistema. Ausência de
   * registro no banco significa "usa o padrão", nunca "sem mensagem".
   */
  async resolveTemplate(
    tenantId: string,
    event: CustomerMessageEventKey,
    channel: CustomerMessageChannel,
  ): Promise<ResolvedCustomerTemplate> {
    const personalizado = await customerMessageTemplateRepository.findByEvent(
      tenantId,
      event,
      channel,
    );

    if (personalizado) {
      return {
        subject: personalizado.subject,
        body: personalizado.body,
        mediaUrl: personalizado.mediaUrl,
        isCustom: true,
      };
    }

    const padrao = getCatalogEntry(event).defaults[channel];
    return { subject: padrao.subject, body: padrao.body, mediaUrl: null, isCustom: false };
  }

  async render(
    tenantId: string,
    event: CustomerMessageEventKey,
    channel: CustomerMessageChannel,
    ctx: CustomerMessageContext,
  ): Promise<RenderedCustomerMessage> {
    const template = await this.resolveTemplate(tenantId, event, channel);
    const variaveis = buildCustomerMessageVariables(ctx);
    const escapar = channel === "EMAIL";

    return {
      subject: template.subject ? interpolateTemplate(template.subject, variaveis, escapar) : null,
      text: interpolateTemplate(template.body, variaveis, escapar),
      mediaUrl: template.mediaUrl,
    };
  }
}

export const customerMessageService = new CustomerMessageService();
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domains/notifications/customer-messages/customer-message.service.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/customer-messages/customer-message.service.ts src/domains/notifications/customer-messages/customer-message.service.test.ts
git commit -m "feat(notifications): service de resolução e renderização de mensagem ao cliente"
```

---

## Task 6: Conversor do legado e teste de equivalência

Esta é a tarefa mais crítica da fase. Ela garante que nenhum tenant perceba a migração.

**Files:**
- Create: `src/domains/notifications/customer-messages/legacy-template-backfill.ts`
- Test: `src/domains/notifications/customer-messages/legacy-template-backfill.test.ts`

**Interfaces:**
- Consumes: `CUSTOMER_MESSAGE_CATALOG`, `LEGACY_TEMPLATE_TO_EVENT` (Task 1); `buildEvolutionMessage` (ainda existente, removido na Task 7).
- Produces:
  - `type LegacyWhatsAppConfig = Record<string, { mensagemPrincipal?: string; mensagemFinal?: string } | undefined>`
  - `function buildLegacyBody(event: CustomerMessageEventKey, legacy: LegacyWhatsAppConfig | null): string | null` — devolve `null` quando o evento não tem equivalente legado ou quando o tenant não personalizou aquele evento (nesse caso não se cria registro, e o catálogo assume).

- [ ] **Step 1: Escrever o teste de equivalência (falhando)**

```ts
import { describe, it, expect } from "vitest";
import { buildEvolutionMessage } from "../providers/evolution.provider";
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
  const templatesLegados = Object.keys(LEGACY_TEMPLATE_TO_EVENT);

  it.each(templatesLegados)(
    "%s sem customização: catálogo reproduz o texto atual byte a byte",
    (templateLegado) => {
      const antigo = buildEvolutionMessage(templateLegado, PAYLOAD_BASE, {
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

      const antigo = buildEvolutionMessage(templateLegado, PAYLOAD_BASE, {
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
```

> **Desvio consciente e documentado:** o código legado tem um ramo alternativo para payload
> sem `startsAt`, com texto diferente (`"… | {serviço} | {negócio}. {final}"` em vez do
> formato com data). Na interpolação, `{{data}}` e `{{hora}}` viram string vazia, produzindo
> `"… 📅  às  | …"`. Esse ramo é caminho defensivo — `appointment-created` e
> `appointment-reminder` sempre chegam com `startsAt` no fluxo real. A equivalência
> byte-a-byte é exigida no payload completo; o ramo degenerado é coberto pelo teste de
> não-regressão acima.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domains/notifications/customer-messages/legacy-template-backfill.test.ts`
Expected: FAIL — `buildLegacyBody` não encontrado.

- [ ] **Step 3: Implementar o conversor**

```ts
import { getCatalogEntry } from "./customer-message-catalog";
import type { CustomerMessageEventKey } from "./types";

export type LegacyWhatsAppConfig = Record<
  string,
  { mensagemPrincipal?: string; mensagemFinal?: string } | undefined
>;

/**
 * Converte a configuração legada (`Tenant.whatsappTemplateConfig`) no corpo completo do
 * template novo, injetando os fragmentos salvos pelo tenant no esqueleto que hoje é
 * hardcoded. O texto resultante renderiza igual ao que o tenant já envia.
 *
 * Devolve `null` quando não há nada a migrar — evento sem equivalente legado, config
 * ausente, ou tenant que nunca personalizou aquele evento. Nesses casos NÃO se cria
 * registro: a resolução cai no catálogo, e melhorias futuras no texto padrão chegam
 * automaticamente a quem nunca personalizou.
 */
export function buildLegacyBody(
  event: CustomerMessageEventKey,
  legacy: LegacyWhatsAppConfig | null,
): string | null {
  const entrada = getCatalogEntry(event);
  if (!entrada.legacy || !legacy) return null;

  const salvo = legacy[entrada.legacy.configKey];
  if (!salvo) return null;

  const principal = salvo.mensagemPrincipal;
  const final = salvo.mensagemFinal;
  if (principal === undefined && final === undefined) return null;

  return entrada.legacy.scaffold(
    principal ?? entrada.legacy.principal,
    final ?? entrada.legacy.final,
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domains/notifications/customer-messages/legacy-template-backfill.test.ts`
Expected: PASS. Se algum caso de equivalência falhar, **o esqueleto do catálogo está errado** —
corrija o scaffold na Task 1 até bater byte a byte. Nunca afrouxe a asserção.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/customer-messages/legacy-template-backfill.ts src/domains/notifications/customer-messages/legacy-template-backfill.test.ts
git commit -m "feat(notifications): conversor do template legado com teste de equivalência"
```

---

## Task 7: Provider Evolution passa a receber texto pronto

**Files:**
- Modify: `src/domains/notifications/providers/whatsapp-provider.interface.ts`
- Modify: `src/domains/notifications/providers/evolution.provider.ts:10-105` (remover), `:120-162` (send)
- Modify: `src/domains/notifications/providers/evolution.provider.test.ts`

**Interfaces:**
- Consumes: `RenderedCustomerMessage` (Task 1).
- Produces: `IWhatsAppProvider.send(draft: NotificationDraft, tenant: TenantWhatsAppConfig, rendered: RenderedCustomerMessage): Promise<SendResult>`

- [ ] **Step 1: Atualizar a interface**

Em `whatsapp-provider.interface.ts`:

```ts
import type { RenderedCustomerMessage } from "../customer-messages/types";
import type { NotificationDraft } from "../types";

export interface IWhatsAppProvider {
  send(
    draft: NotificationDraft,
    tenant: TenantWhatsAppConfig,
    rendered: RenderedCustomerMessage,
  ): Promise<SendResult>;
}
```

- [ ] **Step 2: Escrever o teste do provider (falhando)**

Substitua os testes de `buildEvolutionMessage` em `evolution.provider.test.ts` por:

```ts
it("envia o texto já renderizado, sem montar mensagem", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ key: { id: "MSG1" } }), { status: 200 }),
  );

  const resultado = await evolutionProvider.send(
    { tenantId: "t1", channel: "WHATSAPP", template: "appointment-created", recipient: "11999990000", payload: {} },
    { id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo", whatsappEnabled: true, whatsappTemplateConfig: null, evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null },
    { subject: null, text: "Texto pronto do template", mediaUrl: null },
  );

  expect(resultado.success).toBe(true);
  const corpo = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
  expect(corpo.text).toBe("Texto pronto do template");
  expect(corpo.number).toBe("5511999990000");
});

it("usa sendMedia com legenda quando há mediaUrl", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ key: { id: "MSG2" } }), { status: 200 }),
  );

  await evolutionProvider.send(
    { tenantId: "t1", channel: "WHATSAPP", template: "birthday", recipient: "11999990000", payload: {} },
    { id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo", whatsappEnabled: true, whatsappTemplateConfig: null, evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null },
    { subject: null, text: "Parabéns!", mediaUrl: "https://cdn.exemplo/banner.png" },
  );

  expect(String(fetchSpy.mock.calls[0][0])).toContain("/message/sendMedia/inst-1");
  const corpo = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
  expect(corpo.caption).toBe("Parabéns!");
  expect(corpo.media).toBe("https://cdn.exemplo/banner.png");
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run src/domains/notifications/providers/evolution.provider.test.ts`
Expected: FAIL — `send` ainda tem 2 parâmetros e monta o texto internamente.

- [ ] **Step 4: Reescrever o provider**

Apague de `evolution.provider.ts` as linhas 10-105 (`TEMPLATE_TO_CONFIG_KEY`, `TEMPLATE_DEFAULTS`,
`AppointmentPayload`, `TemplateConfig`, `fmt`, `buildEvolutionMessage`) e substitua o `send`:

```ts
  async send(
    draft: NotificationDraft,
    tenant: TenantWhatsAppConfig,
    rendered: RenderedCustomerMessage,
  ): Promise<SendResult> {
    if (!tenant.evolutionInstanceId) {
      return { success: false, errorMessage: "Instância Evolution não configurada.", provider: "evolution" };
    }

    let number: string;
    try {
      number = toE164Number(draft.recipient);
    } catch {
      return { success: false, errorMessage: `Telefone inválido: ${draft.recipient}`, provider: "evolution" };
    }

    const comMidia = Boolean(rendered.mediaUrl);
    const url = comMidia
      ? `${this.baseUrl}/message/sendMedia/${tenant.evolutionInstanceId}`
      : `${this.baseUrl}/message/sendText/${tenant.evolutionInstanceId}`;
    const body = comMidia
      ? { number, mediatype: "image", media: rendered.mediaUrl, caption: rendered.text }
      : { number, text: rendered.text };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const erro = await response.json().catch(() => ({}));
        return {
          success: false,
          errorMessage: `Evolution API error ${response.status}: ${JSON.stringify(erro)}`,
          provider: "evolution",
        };
      }

      const data = await response.json();
      return { success: true, externalId: data?.key?.id, provider: "evolution" };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Erro ao enviar via Evolution.",
        provider: "evolution",
      };
    }
  }
```

Mantenha `toE164Number` e todos os métodos de instância (`createInstance`, `getQrCode`,
`getStatus`, `getConnectedPhone`, `deleteInstance`, `getContacts`, `sendRawText`) intactos.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/domains/notifications/providers/evolution.provider.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/providers/evolution.provider.ts src/domains/notifications/providers/evolution.provider.test.ts src/domains/notifications/providers/whatsapp-provider.interface.ts
git commit -m "refactor(notifications): Evolution recebe texto renderizado e suporta mídia"
```

---

## Task 8: Provider Twilio passa a enviar texto livre

**Files:**
- Modify: `src/domains/notifications/providers/whatsapp.provider.ts` (remover 7-17, 27-162)
- Modify: `src/domains/notifications/providers/whatsapp.provider.test.ts`

**Interfaces:**
- Consumes: mesma assinatura de `IWhatsAppProvider` da Task 7.

- [ ] **Step 1: Escrever o teste (falhando)**

Substitua os testes de `buildTwilioTemplateParams` por:

```ts
it("envia o texto renderizado como body, sem contentSid", async () => {
  process.env.TWILIO_ACCOUNT_SID = "AC1";
  process.env.TWILIO_AUTH_TOKEN = "tok";
  process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
  process.env.APP_URL = "https://app.teste";

  const create = vi.fn().mockResolvedValue({ sid: "SM1" });
  vi.mocked(twilio).mockReturnValue({ messages: { create } } as never);

  const resultado = await twilioProvider.send(
    { tenantId: "t1", channel: "WHATSAPP", template: "appointment-created", recipient: "11999990000", payload: {} },
    { id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo", whatsappEnabled: true, whatsappTemplateConfig: null, evolutionInstanceId: null, evolutionConnected: false, evolutionStatus: "DISCONNECTED", evolutionPhone: null },
    { subject: null, text: "Texto pronto", mediaUrl: null },
  );

  expect(resultado.success).toBe(true);
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ body: "Texto pronto", to: "whatsapp:+5511999990000" }),
  );
  expect(create.mock.calls[0][0]).not.toHaveProperty("contentSid");
});

it("não exige mais as env vars TWILIO_TPL_*", async () => {
  delete process.env.TWILIO_TPL_CONFIRMATION;
  process.env.TWILIO_ACCOUNT_SID = "AC1";
  process.env.TWILIO_AUTH_TOKEN = "tok";
  process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
  process.env.APP_URL = "https://app.teste";

  const create = vi.fn().mockResolvedValue({ sid: "SM2" });
  vi.mocked(twilio).mockReturnValue({ messages: { create } } as never);

  const resultado = await twilioProvider.send(
    { tenantId: "t1", channel: "WHATSAPP", template: "birthday", recipient: "11999990000", payload: {} },
    { id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo", whatsappEnabled: true, whatsappTemplateConfig: null, evolutionInstanceId: null, evolutionConnected: false, evolutionStatus: "DISCONNECTED", evolutionPhone: null },
    { subject: null, text: "Parabéns!", mediaUrl: null },
  );

  expect(resultado.success).toBe(true);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domains/notifications/providers/whatsapp.provider.test.ts`
Expected: FAIL.

- [ ] **Step 3: Reescrever o provider**

Apague `TEMPLATE_SIDS`, `TEMPLATE_TO_CONFIG_KEY`, `TEMPLATE_DEFAULTS`,
`AppointmentNotificationPayload`, `TemplateConfig`, `fmt`, `TwilioParams` e
`buildTwilioTemplateParams`. Reduza `REQUIRED_TWILIO_VARS` e reescreva o `send`:

```ts
const REQUIRED_TWILIO_VARS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  "APP_URL",
] as const;
```

```ts
  /**
   * Fallback. Envia o texto já renderizado como `body`, o que só é aceito pelo WhatsApp
   * Business dentro da janela de 24 h de atendimento. Fora dela a Meta exige template
   * pré-aprovado — incompatível com texto livre escrito pelo tenant. Aceitável porque a
   * Evolution é o provedor primário; a alternativa (manter contentSid) faria a
   * personalização do tenant ser ignorada em silêncio.
   */
  async send(
    draft: NotificationDraft,
    _tenant: TenantWhatsAppConfig,
    rendered: RenderedCustomerMessage,
  ): Promise<SendResult> {
    try {
      assertTwilioConfigured();
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Twilio não configurado.",
        provider: "twilio",
      };
    }

    let to: string;
    try {
      to = toWhatsAppNumber(draft.recipient);
    } catch {
      return { success: false, errorMessage: `Telefone inválido: ${draft.recipient}`, provider: "twilio" };
    }

    try {
      const client = this.getClient();
      const message = await sendWithRetry(client, {
        from: process.env.TWILIO_WHATSAPP_FROM,
        to,
        body: rendered.text,
        ...(rendered.mediaUrl ? { mediaUrl: [rendered.mediaUrl] } : {}),
        statusCallback: `${process.env.APP_URL}/api/webhooks/twilio/status`,
      });
      return { success: true, externalId: message.sid, provider: "twilio" };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Erro ao enviar via Twilio.",
        provider: "twilio",
      };
    }
  }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domains/notifications/providers/whatsapp.provider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/providers/whatsapp.provider.ts src/domains/notifications/providers/whatsapp.provider.test.ts
git commit -m "refactor(notifications): Twilio envia texto renderizado como fallback"
```

---

## Task 9: Gateway renderiza antes de despachar

**Files:**
- Modify: `src/domains/notifications/providers/whatsapp.gateway.ts`
- Modify: `src/domains/notifications/providers/whatsapp.gateway.test.ts`

**Interfaces:**
- Consumes: `customerMessageService.render` (Task 5), `LEGACY_TEMPLATE_TO_EVENT` (Task 1).

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
it("renderiza pelo service e repassa o texto ao provider", async () => {
  prismaMock.tenant.findFirst.mockResolvedValue({
    id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo",
    phone: null, address: null, whatsappEnabled: true, whatsappTemplateConfig: null,
    evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null,
  } as never);

  const renderSpy = vi.spyOn(customerMessageService, "render").mockResolvedValue({
    subject: null, text: "Renderizado!", mediaUrl: null,
  });
  const sendSpy = vi.spyOn(evolutionProvider, "send").mockResolvedValue({ success: true, provider: "evolution" });

  await whatsAppGateway.send({
    tenantId: "t1", channel: "WHATSAPP", template: "appointment-created",
    recipient: "11999990000", payload: { customerName: "Maria", serviceName: "Escova", startsAt: "2026-08-02T17:00:00.000Z" },
  });

  expect(renderSpy).toHaveBeenCalledWith("t1", "appointment_created", "WHATSAPP", expect.objectContaining({ customerName: "Maria" }));
  expect(sendSpy.mock.calls[0][2]).toEqual({ subject: null, text: "Renderizado!", mediaUrl: null });
});

it("mensagem pontual do modal tem precedência sobre o template", async () => {
  prismaMock.tenant.findFirst.mockResolvedValue({
    id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo",
    phone: null, address: null, whatsappEnabled: true, whatsappTemplateConfig: null,
    evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null,
  } as never);

  const renderSpy = vi.spyOn(customerMessageService, "render");
  const sendSpy = vi.spyOn(evolutionProvider, "send").mockResolvedValue({ success: true, provider: "evolution" });

  await whatsAppGateway.send({
    tenantId: "t1", channel: "WHATSAPP", template: "appointment-cancelled",
    recipient: "11999990000", payload: { customerName: "Maria", serviceName: "Escova", message: "Texto escrito na hora" },
  });

  expect(renderSpy).not.toHaveBeenCalled();
  expect(sendSpy.mock.calls[0][2].text).toBe("Texto escrito na hora");
});

it("template desconhecido falha com erro claro em vez de enviar texto vazio", async () => {
  prismaMock.tenant.findFirst.mockResolvedValue({
    id: "t1", name: "Salão", slug: "salao", timezone: "America/Sao_Paulo",
    phone: null, address: null, whatsappEnabled: true, whatsappTemplateConfig: null,
    evolutionInstanceId: "inst-1", evolutionConnected: true, evolutionStatus: "CONNECTED", evolutionPhone: null,
  } as never);

  const resultado = await whatsAppGateway.send({
    tenantId: "t1", channel: "WHATSAPP", template: "template-que-nao-existe",
    recipient: "11999990000", payload: { customerName: "Maria" },
  });

  expect(resultado.status).toBe("FAILED");
  expect(resultado.errorMessage).toContain("template-que-nao-existe");
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domains/notifications/providers/whatsapp.gateway.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar no gateway**

Adicione `phone: true, address: true` ao `select` do `prisma.tenant.findFirst` e, logo após a
checagem de quota, antes de escolher o provider:

```ts
    const payload = draft.payload as {
      customerName?: string;
      serviceName?: string;
      professionalName?: string;
      startsAt?: string;
      newStartsAt?: string;
      message?: string;
    };

    let rendered: RenderedCustomerMessage;

    if (payload.message) {
      // Mensagem escrita na hora pelo profissional tem precedência sobre o template.
      rendered = { subject: null, text: payload.message, mediaUrl: null };
    } else {
      const event = LEGACY_TEMPLATE_TO_EVENT[draft.template];
      if (!event) {
        await whatsAppQuotaService.decrement(draft.tenantId);
        return {
          status: NotificationStatus.FAILED,
          errorMessage: `Template desconhecido: ${draft.template}`,
        };
      }

      const quando = payload.newStartsAt ?? payload.startsAt;
      rendered = await customerMessageService.render(draft.tenantId, event, "WHATSAPP", {
        customerName: payload.customerName ?? "Cliente",
        serviceName: payload.serviceName,
        professionalName: payload.professionalName,
        startsAt: quando ? new Date(quando) : undefined,
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          timezone: tenant.timezone,
          phone: tenant.phone,
          address: tenant.address,
        },
      });
    }
```

Passe `rendered` como terceiro argumento nas três chamadas de `send` (Evolution, fallback
Twilio, Twilio direto). Estenda `TenantWhatsAppConfig` com `phone: string | null` e
`address: string | null`.

- [ ] **Step 4: Rodar toda a suíte de notifications**

Run: `npx vitest run src/domains/notifications/ && npx tsc --noEmit`
Expected: PASS; zero erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/providers/
git commit -m "refactor(notifications): gateway renderiza a mensagem antes de despachar"
```

---

## Task 10: E-mail ao cliente sai do hardcode

**Files:**
- Modify: `src/domains/notifications/providers/email-templates.ts` (remover 41-80, adicionar layout)
- Modify: `src/domains/notifications/notification.service.ts:1-33`
- Modify: `src/domains/notifications/notification.service.test.ts`

**Interfaces:**
- Produces: `function customerEmailHtml(input: { body: string; tenantName: string }): string`

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
it("monta o HTML do e-mail com o corpo do template e preserva quebras de linha", () => {
  const html = customerEmailHtml({ body: "Linha 1\nLinha 2", tenantName: "Salão da Lu" });
  expect(html).toContain("Linha 1<br />Linha 2");
  expect(html).toContain("Salão da Lu");
  expect(html).toContain("<!DOCTYPE html>");
});

it("não re-escapa o corpo: o service já escapou ao interpolar", () => {
  const html = customerEmailHtml({ body: "Maria &lt;script&gt;", tenantName: "Salão" });
  expect(html).toContain("Maria &lt;script&gt;");
  expect(html).not.toContain("&amp;lt;");
});
```

E em `notification.service.test.ts`:

```ts
it("usa o template do banco para montar assunto e corpo do e-mail", async () => {
  const renderSpy = vi.spyOn(customerMessageService, "render").mockResolvedValue({
    subject: "Assunto do tenant", text: "Corpo do tenant", mediaUrl: null,
  });
  prismaMock.tenant.findFirst.mockResolvedValue({
    name: "Salão", slug: "salao", timezone: "America/Sao_Paulo", phone: null, address: null,
  } as never);
  prismaMock.notificationLog.count.mockResolvedValue(0);

  const sendSpy = vi.fn().mockResolvedValue({ status: "SENT" });
  vi.mocked(getEmailProvider).mockReturnValue({ send: sendSpy } as never);

  await notificationService.logAndDispatch({
    tenantId: "t1", channel: "EMAIL", template: "appointment-created",
    recipient: "maria@exemplo.com", payload: { customerName: "Maria", serviceName: "Escova" },
  });

  expect(renderSpy).toHaveBeenCalledWith("t1", "appointment_created", "EMAIL", expect.anything());
  expect(sendSpy).toHaveBeenCalledWith(
    expect.objectContaining({ to: "maria@exemplo.com", subject: "Assunto do tenant" }),
  );
  expect(sendSpy.mock.calls[0][0].html).toContain("Corpo do tenant");
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domains/notifications/`
Expected: FAIL.

- [ ] **Step 3: Adicionar o layout único e remover os 3 HTMLs de booking**

Em `email-templates.ts`, apague `bookingConfirmedHtml`, `bookingReminderHtml`,
`bookingCancelledHtml` e o tipo `EmailTemplateData`. Mantenha `baseLayout`, `escapeHtml` e as
duas funções `professional*` (usadas em outro contexto). Adicione:

```ts
/**
 * Layout único do e-mail ao cliente. O corpo vem do template (do banco ou do catálogo) já
 * interpolado e já escapado pelo service — por isso não escapamos de novo aqui, só
 * convertemos quebras de linha em <br />.
 */
export function customerEmailHtml(input: { body: string; tenantName: string }): string {
  const corpo = input.body.replace(/\n/g, "<br />");
  return baseLayout(
    `
    <div style="color:#334155;font-size:15px;line-height:1.6;">${corpo}</div>
    <p style="color:#64748b;font-size:14px;margin:24px 0 0;">— ${escapeHtml(input.tenantName)}</p>
  `,
    input.tenantName,
  );
}
```

- [ ] **Step 4: Reescrever o caminho de e-mail no notification.service**

Apague `EMAIL_SUBJECTS`, `buildEmailHtml` e os imports dos 3 `booking*Html`. No ramo `EMAIL`:

```ts
      const emailCount = await notificationRepository.countEmailsThisMonth(draft.tenantId);
      await featureGuard.assertWithinLimit(draft.tenantId, "email_month", emailCount);

      const event = LEGACY_TEMPLATE_TO_EVENT[draft.template];
      if (!event) {
        delivery = {
          status: NotificationStatus.FAILED,
          errorMessage: `Template desconhecido: ${draft.template}`,
        };
      } else {
        const tenant = await prisma.tenant.findFirst({
          where: { id: draft.tenantId },
          select: { name: true, slug: true, timezone: true, phone: true, address: true },
        });

        const payload = draft.payload as {
          customerName?: string;
          serviceName?: string;
          professionalName?: string;
          startsAt?: string;
        };

        const rendered = await customerMessageService.render(draft.tenantId, event, "EMAIL", {
          customerName: payload.customerName ?? "Cliente",
          serviceName: payload.serviceName,
          professionalName: payload.professionalName,
          startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
          tenant: {
            name: tenant?.name ?? "Estabelecimento",
            slug: tenant?.slug ?? "",
            timezone: tenant?.timezone ?? "America/Sao_Paulo",
            phone: tenant?.phone,
            address: tenant?.address,
          },
        });

        delivery = await getEmailProvider().send({
          to: draft.recipient,
          subject: rendered.subject ?? "Notificação",
          html: customerEmailHtml({
            body: rendered.text,
            tenantName: tenant?.name ?? "Estabelecimento",
          }),
        });
      }
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/domains/notifications/ && npx tsc --noEmit`
Expected: PASS; zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/
git commit -m "refactor(notifications): e-mail ao cliente usa template do banco"
```

---

## Task 11: API de templates

**Files:**
- Create: `src/domains/notifications/customer-messages/schemas.ts`
- Create: `src/app/api/notifications/customer-templates/route.ts`
- Create: `src/app/api/notifications/customer-templates/[event]/[channel]/route.ts`
- Delete: `src/app/api/whatsapp/templates/route.ts`
- Test: `src/app/api/notifications/customer-templates/route.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/notifications/customer-templates` → `{ items: Array<{ event, channel, subject, body, mediaUrl, isCustom, label, description, variables, nature }> }`
  - `PUT /api/notifications/customer-templates` — body `{ event, channel, subject, body, mediaUrl }`
  - `DELETE /api/notifications/customer-templates/[event]/[channel]` — restaura o padrão

> A permissão própria `mensagens` chega na Fase 3. Nesta fase, usar `PERMISSIONS.settings.view`
> no GET e `PERMISSIONS.settings.manage` no PUT/DELETE — exatamente o que a rota deletada já exigia.

- [ ] **Step 1: Criar o schema Zod**

```ts
import { z } from "zod";

export const customerMessageEventSchema = z.enum([
  "appointment_requested",
  "appointment_created",
  "appointment_confirmed",
  "appointment_rescheduled",
  "appointment_cancelled",
  "appointment_no_show",
  "appointment_reminder",
  "birthday",
  "return_due",
  "winback",
]);

export const customerMessageChannelSchema = z.enum(["WHATSAPP", "EMAIL"]);

export const updateCustomerMessageTemplateSchema = z.object({
  event: customerMessageEventSchema,
  channel: customerMessageChannelSchema,
  subject: z.string().trim().min(1).max(120).nullable(),
  body: z.string().trim().min(1).max(1500),
  mediaUrl: z.string().url().nullable(),
});

export type UpdateCustomerMessageTemplateInput = z.infer<
  typeof updateCustomerMessageTemplateSchema
>;
```

- [ ] **Step 2: Escrever o teste da rota (falhando)**

```ts
it("GET devolve o catálogo com a personalização aplicada", async () => {
  vi.mocked(getSessionContext).mockResolvedValue({ tenantId: "t1" } as never);
  prismaMock.customerMessageTemplate.findMany.mockResolvedValue([
    { event: "birthday", channel: "WHATSAPP", subject: null, body: "Meu texto", mediaUrl: null },
  ] as never);

  const res = await GET(new Request("http://localhost/api/notifications/customer-templates"));
  const json = await res.json();

  expect(res.status).toBe(200);
  const aniversario = json.items.find((i) => i.event === "birthday" && i.channel === "WHATSAPP");
  expect(aniversario.isCustom).toBe(true);
  expect(aniversario.body).toBe("Meu texto");

  const criado = json.items.find((i) => i.event === "appointment_created" && i.channel === "WHATSAPP");
  expect(criado.isCustom).toBe(false);
  expect(criado.variables).toContain("cliente");
});

it("PUT rejeita corpo vazio", async () => {
  vi.mocked(getSessionContext).mockResolvedValue({ tenantId: "t1" } as never);

  const res = await PUT(new Request("http://localhost/api/notifications/customer-templates", {
    method: "PUT",
    body: JSON.stringify({ event: "birthday", channel: "WHATSAPP", subject: null, body: "", mediaUrl: null }),
  }));

  expect(res.status).toBe(400);
});

it("PUT nunca aceita tenantId vindo do body", async () => {
  vi.mocked(getSessionContext).mockResolvedValue({ tenantId: "t1" } as never);
  prismaMock.customerMessageTemplate.upsert.mockResolvedValue({} as never);

  await PUT(new Request("http://localhost/api/notifications/customer-templates", {
    method: "PUT",
    body: JSON.stringify({
      tenantId: "tenant-invasor", event: "birthday", channel: "WHATSAPP",
      subject: null, body: "Oi", mediaUrl: null,
    }),
  }));

  expect(prismaMock.customerMessageTemplate.upsert.mock.calls[0][0].where.tenantId_event_channel.tenantId).toBe("t1");
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run src/app/api/notifications/customer-templates/route.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementar as rotas**

`src/app/api/notifications/customer-templates/route.ts`:

```ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { CUSTOMER_MESSAGE_CATALOG } from "@/domains/notifications/customer-messages/customer-message-catalog";
import { customerMessageTemplateRepository } from "@/domains/notifications/customer-messages/customer-message-template.repository";
import { updateCustomerMessageTemplateSchema } from "@/domains/notifications/customer-messages/schemas";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const personalizados = await customerMessageTemplateRepository.listByTenant(session.tenantId);
    const porChave = new Map(personalizados.map((t) => [`${t.event}:${t.channel}`, t]));

    const items = CUSTOMER_MESSAGE_CATALOG.flatMap((entrada) =>
      (["WHATSAPP", "EMAIL"] as const).map((channel) => {
        const personalizado = porChave.get(`${entrada.event}:${channel}`);
        const padrao = entrada.defaults[channel];
        return {
          event: entrada.event,
          channel,
          label: entrada.label,
          description: entrada.description,
          nature: entrada.nature,
          variables: entrada.variables,
          subject: personalizado?.subject ?? padrao.subject,
          body: personalizado?.body ?? padrao.body,
          mediaUrl: personalizado?.mediaUrl ?? null,
          isCustom: Boolean(personalizado),
          defaultBody: padrao.body,
          defaultSubject: padrao.subject,
        };
      }),
    );

    return Response.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const input = await validateInput(request, updateCustomerMessageTemplateSchema);

    // tenantId vem SEMPRE da sessão — nunca do body.
    const salvo = await customerMessageTemplateRepository.upsert(session.tenantId, {
      event: input.event,
      channel: input.channel,
      subject: input.channel === "EMAIL" ? input.subject : null,
      body: input.body,
      mediaUrl: input.mediaUrl,
    });

    return Response.json(salvo);
  } catch (error) {
    return handleApiError(error);
  }
}
```

`src/app/api/notifications/customer-templates/[event]/[channel]/route.ts`:

```ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { customerMessageTemplateRepository } from "@/domains/notifications/customer-messages/customer-message-template.repository";
import {
  customerMessageChannelSchema,
  customerMessageEventSchema,
} from "@/domains/notifications/customer-messages/schemas";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ event: string; channel: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const { event, channel } = await params;
    const eventoValidado = customerMessageEventSchema.parse(event);
    const canalValidado = customerMessageChannelSchema.parse(channel);

    // Apagar o registro devolve o evento à mensagem padrão do sistema.
    await customerMessageTemplateRepository.remove(session.tenantId, eventoValidado, canalValidado);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5: Deletar a rota antiga**

```bash
git rm src/app/api/whatsapp/templates/route.ts
```

Verifique que nada mais a chama: `npx grep -r "whatsapp/templates" src/` deve voltar apenas
referências no hook antigo, tratado na Task 12.

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npx vitest run src/app/api/notifications/customer-templates/ && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/notifications/customer-templates/ src/domains/notifications/customer-messages/schemas.ts
git commit -m "feat(notifications): API de templates de mensagem ao cliente"
```

---

## Task 12: UI — sub-aba, lista e editor

**Files:**
- Create: `src/hooks/settings/use-customer-message-templates.ts`
- Create: `src/components/domain/settings/customer-message-list.tsx`
- Create: `src/components/domain/settings/customer-message-editor.tsx`
- Modify: `src/app/(app)/configuracoes/notificacoes/page.tsx`
- Delete: `src/components/domain/settings/whatsapp-template-editor.tsx` e o trecho de
  `src/hooks/settings/use-notification-settings.ts` que consumia `/api/whatsapp/templates`

**Interfaces:**
- Consumes: as rotas da Task 11.
- Produces: `useCustomerMessageTemplates()`, `useUpdateCustomerMessageTemplate()`, `useResetCustomerMessageTemplate()`.

**Requisitos de UI (Global Constraints da spec, seção 11):**
- `DialogContent` com `max-h-[85vh]` e `overflow-y-auto` — obrigatório.
- Alvos de toque ≥ 44×44.
- Desktop: editor e prévia lado a lado. Mobile: coluna única, prévia abaixo, chips em faixa
  rolável horizontal **sem** `touch-pan-x`, ações em rodapé `sticky bottom-0`.
- Lista: tabela no desktop, cartões empilhados no mobile — nunca tabela com rolagem horizontal.
- Estados de carregando, erro e vazio explícitos.
- Botão "Restaurar padrão" visível sempre que `isCustom` for verdadeiro.

- [ ] **Step 1: Criar o hook**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CustomerMessageTemplateItem = {
  event: string;
  channel: "WHATSAPP" | "EMAIL";
  label: string;
  description: string;
  nature: "transactional" | "promotional";
  variables: string[];
  subject: string | null;
  body: string;
  mediaUrl: string | null;
  isCustom: boolean;
  defaultBody: string;
  defaultSubject: string | null;
};

const CHAVE = ["customer-message-templates"];

export function useCustomerMessageTemplates() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<CustomerMessageTemplateItem[]> => {
      const res = await fetch("/api/notifications/customer-templates");
      if (!res.ok) throw new Error("Falha ao carregar as mensagens");
      const json = await res.json();
      return json.items;
    },
    staleTime: 60_000,
  });
}

export function useUpdateCustomerMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      event: string;
      channel: "WHATSAPP" | "EMAIL";
      subject: string | null;
      body: string;
      mediaUrl: string | null;
    }) => {
      const res = await fetch("/api/notifications/customer-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Falha ao salvar a mensagem");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}

export function useResetCustomerMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { event: string; channel: "WHATSAPP" | "EMAIL" }) => {
      const res = await fetch(
        `/api/notifications/customer-templates/${input.event}/${input.channel}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Falha ao restaurar o padrão");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}
```

- [ ] **Step 2: Criar o editor**

`customer-message-editor.tsx` — espelhe [`team-notification-template-editor.tsx`](../../../src/components/domain/settings/team-notification-template-editor.tsx),
que já implementa chips que inserem no cursor e prévia ao vivo. Diferenças obrigatórias:

- Prévia renderizada como **balão de WhatsApp** (fundo verde-claro, cantos arredondados,
  `whitespace-pre-wrap` para respeitar as quebras de linha).
- Dados de exemplo do `PREVIEW_DATA` cobrindo TODAS as variáveis do catálogo:
  `cliente: "Maria Silva"`, `primeiro_nome: "Maria"`, `servico: "Escova"`,
  `profissional: "Ana"`, `data: "02/08/2026"`, `hora: "14:00"`, `dia_semana: "domingo"`,
  `duracao: "45 min"`, `valor: "R$ 80,00"`, `negocio: "Salão da Lu"`,
  `endereco: "Rua X, 123"`, `telefone_negocio: "(11) 99999-0000"`,
  `link_agendamento: "agende.app/salao-da-lu"`, `link_portal: "agende.app/salao-da-lu/portal"`,
  `dias_sem_vir: "92"`, `ultimo_servico: "Escova"`.
- Botão **"Restaurar padrão"** quando `isCustom`, com `AlertDialog` de confirmação.
- Contador de caracteres.
- `DialogContent` com `className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-2xl"`.
- No desktop (`md:`), `grid-cols-2` com editor à esquerda e prévia à direita; no mobile,
  coluna única com a prévia logo abaixo do textarea.

- [ ] **Step 3: Criar a lista**

`customer-message-list.tsx` — agrupa os itens por evento e mostra, para cada um: rótulo,
descrição, selo "Personalizada" quando `isCustom`, selo "Promocional" quando
`nature === "promotional"`, e botões para editar WhatsApp e e-mail.

Layout: `<table>` a partir de `md:`; abaixo disso, lista de `<div>` em cartão. Estados de
carregando (esqueleto), erro (mensagem + botão de tentar de novo) e vazio (não deve ocorrer,
mas trate).

- [ ] **Step 4: Adicionar a sub-aba**

Em `src/app/(app)/configuracoes/notificacoes/page.tsx`, mude `grid-cols-2` para `grid-cols-3`
e acrescente:

```tsx
{canManageBusiness && (
  <TabsTrigger value="cliente" className="min-h-11">Mensagens ao cliente</TabsTrigger>
)}
```

```tsx
{canManageBusiness && (
  <TabsContent value="cliente" className="mt-4">
    <CustomerMessageList />
  </TabsContent>
)}
```

Ajuste o `className` condicional do trigger "Minhas preferências" para o novo número de colunas
e atualize o subtítulo da página para mencionar as mensagens ao cliente.

- [ ] **Step 5: Remover o editor antigo**

```bash
git rm src/components/domain/settings/whatsapp-template-editor.tsx
```

Remova do `use-notification-settings.ts` o que consumia `/api/whatsapp/templates` e limpe
qualquer import órfão. `npx tsc --noEmit` acusa o que sobrou.

- [ ] **Step 6: Verificação manual em duas larguras**

Rode `npm run dev`, abra Configurações › Notificações › Mensagens ao cliente e confirme:

- 375 px: lista em cartões, sem rolagem horizontal da página; editor em coluna única; chips
  roláveis; ações alcançáveis sem rolar até o fim; prévia legível.
- 1440 px: lista em tabela; editor e prévia lado a lado.
- Editar, salvar, reabrir e confirmar que o texto persistiu.
- "Restaurar padrão" e confirmar que o texto volta ao do catálogo.

- [ ] **Step 7: Rodar tudo**

Run: `npx tsc --noEmit && npx vitest run`
Expected: zero erros; toda a suíte verde.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/settings/ src/components/domain/settings/ "src/app/(app)/configuracoes/notificacoes/page.tsx"
git commit -m "feat(notifications): aba de mensagens ao cliente com editor e prévia"
```

---

## Task 13: Script de backfill e runbook

**Files:**
- Create: `scripts/backfill-customer-message-templates.mjs`
- Modify: `package.json` (script `messages:backfill`)
- Modify: `docs/decisions.md` (ADR)

**Interfaces:**
- Consumes: `buildLegacyBody` (Task 6).

> **Atenção:** os scripts deste projeto precisam usar `PrismaPg` como adapter. `new PrismaClient()`
> puro quebra com `PrismaClientInitializationError` — já aconteceu antes. Copie a inicialização
> de um script existente em `scripts/`.

- [ ] **Step 1: Escrever o script**

```js
// Converte Tenant.whatsappTemplateConfig em CustomerMessageTemplate, preservando
// exatamente o texto que cada tenant já customizou. Idempotente: rodar duas vezes
// não duplica nem sobrescreve personalização feita depois da migração.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { buildLegacyBody } from "../src/domains/notifications/customer-messages/legacy-template-backfill.js";
import { CUSTOMER_MESSAGE_CATALOG } from "../src/domains/notifications/customer-messages/customer-message-catalog.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { whatsappTemplateConfig: { not: null } },
    select: { id: true, name: true, whatsappTemplateConfig: true },
  });

  console.log(`[backfill] ${tenants.length} tenants com configuração legada`);
  let criados = 0;
  let pulados = 0;

  for (const tenant of tenants) {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      const body = buildLegacyBody(entrada.event, tenant.whatsappTemplateConfig);
      if (!body) continue;

      const jaExiste = await prisma.customerMessageTemplate.findFirst({
        where: { tenantId: tenant.id, event: entrada.event, channel: "WHATSAPP" },
        select: { id: true },
      });

      if (jaExiste) {
        pulados++;
        continue;
      }

      await prisma.customerMessageTemplate.create({
        data: {
          tenantId: tenant.id,
          event: entrada.event,
          channel: "WHATSAPP",
          subject: null,
          body,
          mediaUrl: null,
        },
      });
      criados++;
    }
  }

  console.log(`[backfill] ${criados} templates criados, ${pulados} já existiam`);
}

main()
  .catch((err) => {
    console.error("[backfill] falhou:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Registrar o script no package.json**

```json
"messages:backfill": "node scripts/backfill-customer-message-templates.mjs"
```

- [ ] **Step 3: Executar contra o banco local e conferir**

```bash
npm run messages:backfill
npm run messages:backfill   # segunda execução: deve reportar 0 criados
```

Expected: a segunda execução reporta `0 templates criados` — prova de idempotência.

- [ ] **Step 4: Registrar o ADR**

Acrescente a `docs/decisions.md` um ADR novo cobrindo: as duas camadas (catálogo × personalização),
a decisão do Twilio enviar `body` em vez de `contentSid` e o que isso implica, e o runbook:

```
1. npx prisma migrate deploy
2. npm run messages:backfill      (mesma janela, logo em seguida)
3. Conferir uma mensagem real de um tenant que tinha customização
```

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-customer-message-templates.mjs package.json docs/decisions.md
git commit -m "feat(notifications): script de backfill dos templates legados + ADR"
```

---

## Task 14: Fechamento da fase

- [ ] **Step 1: Verificação completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: zero erros de tipo; toda a suíte verde.

- [ ] **Step 2: Confirmar que não sobrou hardcode**

```bash
grep -rn "mensagemPrincipal\|mensagemFinal\|TEMPLATE_DEFAULTS\|EMAIL_SUBJECTS\|buildEvolutionMessage\|buildTwilioTemplateParams" src/
```

Expected: apenas ocorrências dentro de `customer-messages/` (o conversor legado e seus testes).
Qualquer resultado em `providers/` ou em rota de API significa que sobrou hardcode.

- [ ] **Step 3: Atualizar a documentação de contexto**

- `CLAUDE.md`: atualizar a linha do domínio Notifications com o motor de mensagens ao cliente
  e acrescentar o aviso de migration pendente em produção, no formato dos avisos já existentes.
- `src/domains/notifications/DOMAIN.md`: está desatualizado (diz "🔴 Não iniciado"). Atualizar
  com a arquitetura de duas camadas.
- `AGENTS.md` (raiz e `.claude/`) e `CODEX.md`: atualizar conforme a convenção do projeto.

- [ ] **Step 4: Abrir a PR**

```bash
git push -u origin feat/motor-mensagens-cliente-fase-1
gh pr create --base main --title "feat(notifications): motor de mensagens ao cliente — fase 1 (fundação)" --body "..."
```

O corpo da PR deve conter: o que muda para o tenant, o aviso destacado de que a migration e o
backfill são manuais e vão na mesma janela, e a nota sobre a mudança de comportamento do Twilio.

---

## Auto-revisão do plano

**Cobertura da spec (seções 3, 4 e 5):**

| Requisito da spec | Task |
|---|---|
| §3.2 catálogo único, fim dos 3 `TEMPLATE_DEFAULTS` | 1, 7, 8 |
| §3.2 mensagens genéricas do sistema + duas camadas | 1, 5 |
| §3.3 transacional × promocional | 1 (campo `nature`) |
| §4.1 enum `CustomerMessageEvent` | 3 |
| §4.2 model `CustomerMessageTemplate` | 3, 4 |
| §4.4 migration aditiva + backfill sem perda | 3, 6, 13 |
| §5.1 resolução template → interpolação → provider | 5, 7, 8, 9, 10 |
| §5.1 `notificationMessage` mantém precedência | 9 |
| §5.2 variáveis no fuso do tenant | 2 |
| §5.3 formatação e mídia | 7 (sendMedia), 12 (editor) |
| §11 mobile + desktop, facilidade de configuração | 12 |
| §13 teste de equivalência do backfill | 6 |

**Fora do escopo desta fase, por desenho:** `CustomerMessageSetting` e os toggles por evento
(Fase 2), a permissão `mensagens` (Fase 3), e a remoção de `Tenant.whatsappTemplateConfig`
(limpeza posterior, após validação em produção).

**Consistência de tipos:** `CustomerMessageEventKey` (Task 1) é validado contra o enum do Prisma
(Task 3) pela asserção de compilação da Task 4. `RenderedCustomerMessage` (Task 1) é o retorno de
`render` (Task 5) e o terceiro parâmetro de `send` nas Tasks 7, 8 e 9.
