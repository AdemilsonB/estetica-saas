# Motor de mensagens — Etapa 2: Fase 5 (automações) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as duas automações da Fase 5 — confirmação de agendamento por resposta "1"/"2" no WhatsApp, e lembrete de retorno programado por serviço.

**Architecture:** O convite de confirmação é **anexado ao lembrete já renderizado** no gateway, nunca embutido no template — assim desligar a automação não deixa um pedido órfão num texto que o tenant editou. O casamento da resposta acontece no webhook, no espaço já reservado entre o opt-out e o chatbot, e usa o `NotificationLog` como memória (sem model novo). O retorno programado é um job diário no padrão pg-boss + `/api/cron/tick` já estabelecido.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma + Supabase, Zod, TanStack Query, Shadcn UI, Vitest, pg-boss.

**Spec:** [`docs/superpowers/specs/2026-08-02-motor-mensagens-consolidacao-fases-3-5-design.md`](../specs/2026-08-02-motor-mensagens-consolidacao-fases-3-5-design.md) §5

## Global Constraints

- **Todo output em Português do Brasil** — código, comentários, mensagens de commit, nomes de branch.
- **`tenantId` sempre do token ou do tenant resolvido, NUNCA do body ou da URL.** Todo repository filtra por `tenantId`.
- **TypeScript strict** — sem `any`, sem `as unknown as` em código de produção.
- **Erros de domínio tipados** de `src/shared/errors/`. Nunca `throw new Error('string')`.
- **NÃO há migration nesta etapa.** `Tenant.replyConfirmEnabled`, `Tenant.replyConfirmInvite` e `Service.returnIntervalDays` já existem no schema, criados pela migration da Etapa 1 (`20260802120000_motor_mensagens_fundacao`), **já aplicada em produção**. Se o TypeScript reclamar que não existem, rode `npx prisma generate` antes de investigar qualquer outra coisa.
- **Todo cálculo de "hoje" no fuso do tenant**, nunca no fuso do processo.
- **Todo `DialogContent` precisa de `max-h-[85dvh]` + `overflow-y-auto`.** Alvo de toque mínimo 44 px. Mobile-first: base → `md:` → `lg:`.
- **Gate antes de entregar:** `npx tsc --noEmit` com zero erros; `npx vitest run` sem regressão. **Há 3 falhas pré-existentes conhecidas na `main`** (ver a seção "Testes vermelhos conhecidos" no `CLAUDE.md`) — elas não contam como regressão, e **não devem ser "ajustadas para passar"**.
- **Sem banco de dados local.** Nunca tente conectar; os testes mockam o Prisma.
- Testes rodam com **Vitest** (`npx vitest run <caminho>`), não Jest.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/domains/notifications/reply-confirm/reply-confirm-keywords.ts` | **Novo.** Interpreta "1"/"2" e sinônimos. Puro |
| `src/domains/notifications/reply-confirm/reply-confirm-catalog.ts` | **Novo.** Textos padrão do convite e das respostas |
| `src/domains/notifications/reply-confirm/reply-confirm.repository.ts` | **Novo.** Lembrete recente no `NotificationLog` + agendamentos candidatos |
| `src/domains/notifications/reply-confirm/reply-confirm.service.ts` | **Novo.** Orquestra o casamento e a ação |
| `src/app/api/webhooks/evolution/messages/route.ts` | Pluga o passo 2 no espaço reservado |
| `src/domains/notifications/providers/whatsapp.gateway.ts` | Anexa o convite ao lembrete renderizado |
| `src/shared/queue/jobs/return-due.ts` | **Novo.** Job diário do retorno programado |
| `src/app/api/cron/tick/route.ts` | Registra e roda o job novo |
| `src/domains/scheduling/types.ts` | `returnIntervalDays` nos schemas de serviço |
| `src/components/domain/settings/whatsapp-settings-form.tsx` | Liga/desliga a confirmação por resposta + texto do convite |
| UI de serviço (localizar) | Campo "avisar retorno após N dias" |

---

## Task 1: Interpretação da resposta

Função pura. Traduz o texto recebido em intenção, ou `null` quando não é resposta de confirmação.

**Files:**
- Create: `src/domains/notifications/reply-confirm/reply-confirm-keywords.ts`
- Test: `src/domains/notifications/reply-confirm/reply-confirm-keywords.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type RespostaConfirmacao = "confirmar" | "cancelar"` e `function interpretarResposta(texto: string): RespostaConfirmacao | null`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { interpretarResposta } from "./reply-confirm-keywords";

describe("interpretarResposta", () => {
  it.each(["1", "sim", "SIM", "confirmar", " Confirmar "])(
    "reconhece %s como confirmação",
    (texto) => {
      expect(interpretarResposta(texto)).toBe("confirmar");
    },
  );

  it.each(["2", "nao", "não", "NÃO", "cancelar"])(
    "reconhece %s como cancelamento",
    (texto) => {
      expect(interpretarResposta(texto)).toBe("cancelar");
    },
  );

  it("ignora acento na normalização", () => {
    expect(interpretarResposta("Não")).toBe("cancelar");
  });

  it("não interpreta a palavra dentro de uma frase", () => {
    // "confirmar" solto é resposta; "vou confirmar depois" é conversa. Agir sobre
    // uma frase cancelaria o horário de alguém que só estava falando.
    expect(interpretarResposta("vou confirmar depois")).toBeNull();
    expect(interpretarResposta("pode cancelar o de sexta?")).toBeNull();
  });

  it("não interpreta número solto que não seja 1 ou 2", () => {
    expect(interpretarResposta("3")).toBeNull();
    expect(interpretarResposta("10")).toBeNull();
  });

  it("devolve null para texto vazio", () => {
    expect(interpretarResposta("   ")).toBeNull();
  });

  it("não confunde com a palavra de descadastro", () => {
    // "PARE" pertence ao opt-out, que roda ANTES no webhook. Se esta função
    // também o reconhecesse, uma mudança de ordem viraria bug silencioso.
    expect(interpretarResposta("PARE")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/reply-confirm/reply-confirm-keywords.test.ts
```

Esperado: FAIL — `Failed to resolve import "./reply-confirm-keywords"`.

- [ ] **Step 3: Implementar**

```ts
export type RespostaConfirmacao = "confirmar" | "cancelar";

/**
 * Casam apenas com a mensagem inteira, nunca dentro de uma frase: "vou confirmar
 * depois" é conversa, e agir sobre ela cancelaria ou confirmaria o horário de
 * alguém que não pediu nada.
 */
const CONFIRMAR = new Set(["1", "sim", "confirmar", "confirmo"]);
const CANCELAR = new Set(["2", "nao", "cancelar", "cancela"]);

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function interpretarResposta(texto: string): RespostaConfirmacao | null {
  const limpo = normalizar(texto);
  if (CONFIRMAR.has(limpo)) return "confirmar";
  if (CANCELAR.has(limpo)) return "cancelar";
  return null;
}
```

> O intervalo `̀-ͯ` é escrito com escapes Unicode de propósito: são marcas
> diacríticas combinantes, e caracteres invisíveis desse tipo se corrompem ao serem
> copiados entre sistemas.

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/reply-confirm/reply-confirm-keywords.test.ts
```

Esperado: PASS, 15 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/reply-confirm/
git commit -m "feat(notifications): interpretacao de resposta 1/2 de confirmacao"
```

---

## Task 2: Catálogo de textos da confirmação

Mesma arquitetura de duas camadas do resto do motor: catálogo em código é o padrão, o `Tenant` guarda só a personalização, ausência de registro significa "usa o padrão".

**Files:**
- Create: `src/domains/notifications/reply-confirm/reply-confirm-catalog.ts`
- Test: `src/domains/notifications/reply-confirm/reply-confirm-catalog.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `REPLY_CONFIRM_DEFAULTS: { convite: string; confirmado: string; cancelado: string; ambiguo: string }`
  - `function montarConvite(personalizado: string | null): string`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { REPLY_CONFIRM_DEFAULTS, montarConvite } from "./reply-confirm-catalog";

describe("montarConvite", () => {
  it("usa o padrão quando não há personalização", () => {
    expect(montarConvite(null)).toBe(REPLY_CONFIRM_DEFAULTS.convite);
  });

  it("usa o texto do tenant quando existe", () => {
    expect(montarConvite("Responda 1 ou 2")).toBe("Responda 1 ou 2");
  });

  it("trata string em branco como ausência de personalização", () => {
    // '' é falsy e já causou bug neste projeto — um switch mandava string vazia
    // e o gateway caía no template, enviando mesmo desligado.
    expect(montarConvite("   ")).toBe(REPLY_CONFIRM_DEFAULTS.convite);
  });

  it("o convite padrão menciona as duas opções", () => {
    expect(REPLY_CONFIRM_DEFAULTS.convite).toContain("1");
    expect(REPLY_CONFIRM_DEFAULTS.convite).toContain("2");
  });

  it("a resposta ambígua tem espaço para o horário escolhido", () => {
    // Com mais de um candidato o sistema age no mais próximo e diz qual foi —
    // nunca age em silêncio sobre horário ambíguo.
    expect(REPLY_CONFIRM_DEFAULTS.ambiguo).toContain("{{data_hora}}");
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/reply-confirm/reply-confirm-catalog.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
/**
 * Textos padrão da confirmação por resposta.
 *
 * O convite é ANEXADO ao lembrete renderizado, nunca embutido no template do
 * catálogo de mensagens: assim, desligar a automação não deixa um pedido órfão
 * num texto que o tenant editou, e ligar não exige que ele edite nada.
 */
export const REPLY_CONFIRM_DEFAULTS = {
  convite: "\n\nResponda *1* para confirmar ou *2* para cancelar.",
  confirmado: "Prontinho, seu horário está confirmado! Até logo. 😊",
  cancelado: "Seu horário foi cancelado. Quando quiser remarcar, é só chamar!",
  /** Usado quando há mais de um horário candidato. `{{data_hora}}` é obrigatório. */
  ambiguo: "Você tem mais de um horário marcado. Considerei o de {{data_hora}}.",
} as const;

/** Texto do tenant, ou o padrão. Só em branco conta como ausência. */
export function montarConvite(personalizado: string | null): string {
  const limpo = personalizado?.trim();
  return limpo ? limpo : REPLY_CONFIRM_DEFAULTS.convite;
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/reply-confirm/reply-confirm-catalog.test.ts
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/reply-confirm/reply-confirm-catalog.ts src/domains/notifications/reply-confirm/reply-confirm-catalog.test.ts
git commit -m "feat(notifications): catalogo de textos da confirmacao por resposta"
```

---

## Task 3: Repositório do casamento

Duas consultas: houve lembrete para este telefone nas últimas 48 h, e quais agendamentos são candidatos.

**Files:**
- Create: `src/domains/notifications/reply-confirm/reply-confirm.repository.ts`
- Test: `src/domains/notifications/reply-confirm/reply-confirm.repository.test.ts`

**Interfaces:**
- Consumes: `variantesDeTelefone` de `@/domains/crm/opt-out.service`; `prisma`.
- Produces:
  - `type AgendamentoCandidato = { id: string; startsAt: Date; customerId: string }`
  - `replyConfirmRepository.houveLembreteRecente(tenantId: string, telefone: string): Promise<boolean>`
  - `replyConfirmRepository.candidatos(tenantId: string, telefone: string): Promise<AgendamentoCandidato[]>` — ordenados do mais próximo para o mais distante

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { replyConfirmRepository } from "./reply-confirm.repository";

const prismaMock = prisma as unknown as {
  notificationLog: { count: ReturnType<typeof vi.fn> };
  appointment: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  prismaMock.notificationLog = { count: vi.fn().mockResolvedValue(0) };
  prismaMock.appointment = { findMany: vi.fn().mockResolvedValue([]) };
});

describe("houveLembreteRecente", () => {
  it("devolve true quando existe lembrete nas últimas 48h", async () => {
    prismaMock.notificationLog.count.mockResolvedValue(1);
    expect(await replyConfirmRepository.houveLembreteRecente("t1", "5511999990000")).toBe(true);
  });

  it("devolve false quando não existe", async () => {
    expect(await replyConfirmRepository.houveLembreteRecente("t1", "5511999990000")).toBe(false);
  });

  it("filtra por tenantId, pelo template do lembrete e pela janela de 48h", async () => {
    await replyConfirmRepository.houveLembreteRecente("t1", "5511999990000");

    const where = prismaMock.notificationLog.count.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
    expect(where.template).toBe("appointment-reminder");
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("casa o telefone com e sem o DDI 55", async () => {
    // O NotificationLog grava o destinatário como o telefone do cliente (sem DDI,
    // formato do cadastro), mas o WhatsApp entrega o remoteJid COM o DDI. Sem as
    // duas variantes, o "1" do cliente nunca casaria com o lembrete que ele recebeu.
    await replyConfirmRepository.houveLembreteRecente("t1", "5511999990000");

    const where = prismaMock.notificationLog.count.mock.calls[0][0].where;
    expect(where.recipient.in).toEqual(
      expect.arrayContaining(["5511999990000", "11999990000"]),
    );
  });
});

describe("candidatos", () => {
  it("busca SCHEDULED nas próximas 48h, do mais próximo para o mais distante", async () => {
    await replyConfirmRepository.candidatos("t1", "5511999990000");

    const args = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe("t1");
    expect(args.where.status).toBe("SCHEDULED");
    expect(args.where.startsAt.gte).toBeInstanceOf(Date);
    expect(args.where.startsAt.lte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ startsAt: "asc" });
  });

  it("localiza o cliente pelo telefone dentro do tenant, com as duas variantes", async () => {
    await replyConfirmRepository.candidatos("t1", "5511999990000");

    const where = prismaMock.appointment.findMany.mock.calls[0][0].where;
    expect(where.customer.phone.in).toEqual(
      expect.arrayContaining(["5511999990000", "11999990000"]),
    );
    // Cliente arquivado não deve gerar candidato.
    expect(where.customer.deletedAt).toBeNull();
  });

  it("devolve os campos que o service precisa", async () => {
    const agora = new Date();
    prismaMock.appointment.findMany.mockResolvedValue([
      { id: "a1", startsAt: agora, customerId: "c1" },
    ]);

    const lista = await replyConfirmRepository.candidatos("t1", "5511999990000");

    expect(lista).toEqual([{ id: "a1", startsAt: agora, customerId: "c1" }]);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/reply-confirm/reply-confirm.repository.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
import { prisma } from "@/shared/database/prisma";

import { variantesDeTelefone } from "@/domains/crm/opt-out.service";

/** Chave de template do lembrete no `NotificationLog`. */
const TEMPLATE_LEMBRETE = "appointment-reminder";

const JANELA_MS = 48 * 60 * 60 * 1000;

export type AgendamentoCandidato = {
  id: string;
  startsAt: Date;
  customerId: string;
};

export class ReplyConfirmRepository {
  /**
   * Houve lembrete enviado a este telefone nas últimas 48 h?
   *
   * É o que evita interpretar um "1" solto de conversa como confirmação. Sem model
   * novo: o `NotificationLog` já é a memória de tudo que saiu.
   */
  async houveLembreteRecente(tenantId: string, telefone: string): Promise<boolean> {
    const total = await prisma.notificationLog.count({
      where: {
        tenantId,
        template: TEMPLATE_LEMBRETE,
        recipient: { in: variantesDeTelefone(telefone) },
        createdAt: { gte: new Date(Date.now() - JANELA_MS) },
      },
    });
    return total > 0;
  }

  /**
   * Agendamentos que a resposta pode estar endereçando: `SCHEDULED` nas próximas
   * 48 h, do cliente daquele telefone, **dentro do tenant**. Ordenados do mais
   * próximo para o mais distante — o service age no primeiro.
   */
  async candidatos(tenantId: string, telefone: string): Promise<AgendamentoCandidato[]> {
    const agora = new Date();
    return prisma.appointment.findMany({
      where: {
        tenantId,
        status: "SCHEDULED",
        startsAt: { gte: agora, lte: new Date(agora.getTime() + JANELA_MS) },
        customer: {
          phone: { in: variantesDeTelefone(telefone) },
          deletedAt: null,
        },
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, customerId: true },
    });
  }
}

export const replyConfirmRepository = new ReplyConfirmRepository();
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/reply-confirm/reply-confirm.repository.test.ts
```

Esperado: PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/reply-confirm/reply-confirm.repository.ts src/domains/notifications/reply-confirm/reply-confirm.repository.test.ts
git commit -m "feat(notifications): repositorio do casamento da confirmacao por resposta"
```

---

## Task 4: Service da confirmação por resposta

Orquestra: interpreta, checa a janela, escolhe o candidato, age e devolve o texto de resposta.

**Files:**
- Create: `src/domains/notifications/reply-confirm/reply-confirm.service.ts`
- Test: `src/domains/notifications/reply-confirm/reply-confirm.service.test.ts`

**Interfaces:**
- Consumes: `interpretarResposta` (Task 1), `REPLY_CONFIRM_DEFAULTS` (Task 2), `replyConfirmRepository` (Task 3), `schedulingService.updateAppointmentStatus` de `@/domains/scheduling/scheduling.service`.
- Produces: `replyConfirmService.processar(input: { tenantId: string; telefone: string; texto: string; timezone: string }): Promise<{ resposta: string } | null>` — `null` significa "não era resposta de confirmação, siga para o chatbot".

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { replyConfirmService } from "./reply-confirm.service";
import { replyConfirmRepository } from "./reply-confirm.repository";
import { schedulingService } from "@/domains/scheduling/scheduling.service";

vi.mock("./reply-confirm.repository", () => ({
  replyConfirmRepository: { houveLembreteRecente: vi.fn(), candidatos: vi.fn() },
}));

vi.mock("@/domains/scheduling/scheduling.service", () => ({
  schedulingService: { updateAppointmentStatus: vi.fn() },
}));

const repo = vi.mocked(replyConfirmRepository);
const scheduling = vi.mocked(schedulingService);

const base = {
  tenantId: "t1",
  telefone: "5511999990000",
  timezone: "America/Sao_Paulo",
};

/** 2026-08-10 14:00 no fuso de São Paulo (UTC-3). */
const AMANHA = new Date("2026-08-10T17:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  repo.houveLembreteRecente.mockResolvedValue(true);
  repo.candidatos.mockResolvedValue([{ id: "a1", startsAt: AMANHA, customerId: "c1" }]);
  scheduling.updateAppointmentStatus.mockResolvedValue({} as never);
});

describe("replyConfirmService.processar", () => {
  it("devolve null quando o texto não é resposta de confirmação", async () => {
    const r = await replyConfirmService.processar({ ...base, texto: "quero agendar" });

    expect(r).toBeNull();
    expect(repo.houveLembreteRecente).not.toHaveBeenCalled();
    expect(scheduling.updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it("devolve null quando não houve lembrete nas últimas 48h", async () => {
    // Sem essa checagem, um "1" solto de conversa confirmaria um horário sozinho.
    repo.houveLembreteRecente.mockResolvedValue(false);

    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(r).toBeNull();
    expect(scheduling.updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it("devolve null quando não há candidato", async () => {
    repo.candidatos.mockResolvedValue([]);

    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(r).toBeNull();
    expect(scheduling.updateAppointmentStatus).not.toHaveBeenCalled();
  });

  it("confirma o agendamento com 1", async () => {
    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(scheduling.updateAppointmentStatus).toHaveBeenCalledWith("t1", "a1", {
      status: "CONFIRMED",
      notify: false,
    });
    expect(r?.resposta).toContain("confirmado");
  });

  it("cancela o agendamento com 2", async () => {
    const r = await replyConfirmService.processar({ ...base, texto: "2" });

    expect(scheduling.updateAppointmentStatus).toHaveBeenCalledWith("t1", "a1", {
      status: "CANCELLED",
      notify: false,
    });
    expect(r?.resposta).toContain("cancelado");
  });

  it("age no mais próximo e DIZ QUAL FOI quando há mais de um candidato", async () => {
    // Nunca agir em silêncio sobre horário ambíguo: o cliente precisa saber em
    // qual dos horários dele a ação caiu.
    const DEPOIS = new Date("2026-08-11T17:00:00.000Z");
    repo.candidatos.mockResolvedValue([
      { id: "a1", startsAt: AMANHA, customerId: "c1" },
      { id: "a2", startsAt: DEPOIS, customerId: "c1" },
    ]);

    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(scheduling.updateAppointmentStatus).toHaveBeenCalledWith(
      "t1",
      "a1",
      expect.anything(),
    );
    expect(r?.resposta).toContain("mais de um horário");
    expect(r?.resposta).toContain("10/08");
    expect(r?.resposta).not.toContain("{{data_hora}}");
  });

  it("não avisa de ambiguidade quando há um candidato só", async () => {
    const r = await replyConfirmService.processar({ ...base, texto: "1" });
    expect(r?.resposta).not.toContain("mais de um horário");
  });

  it("passa notify: false — o cliente já sabe, ele que pediu", async () => {
    // A ação nasce de uma mensagem do próprio cliente. Reenviar a ele o aviso de
    // "seu horário foi confirmado" pelo motor seria mensagem duplicada.
    await replyConfirmService.processar({ ...base, texto: "1" });

    expect(scheduling.updateAppointmentStatus.mock.calls[0][2]).toEqual(
      expect.objectContaining({ notify: false }),
    );
  });

  it("devolve null e não propaga quando a ação falha", async () => {
    // Roda dentro do webhook; deixar escapar derrubaria o handler e o WhatsApp
    // reentregaria o evento, podendo agir duas vezes.
    scheduling.updateAppointmentStatus.mockRejectedValue(new Error("boom"));

    const r = await replyConfirmService.processar({ ...base, texto: "1" });

    expect(r).toBeNull();
  });

  it("formata a data no fuso do tenant, não no do processo", async () => {
    const DEPOIS = new Date("2026-08-11T17:00:00.000Z");
    repo.candidatos.mockResolvedValue([
      { id: "a1", startsAt: AMANHA, customerId: "c1" },
      { id: "a2", startsAt: DEPOIS, customerId: "c1" },
    ]);

    const r = await replyConfirmService.processar({
      ...base,
      texto: "1",
      timezone: "America/Sao_Paulo",
    });

    // 2026-08-10T17:00Z = 14:00 em São Paulo.
    expect(r?.resposta).toContain("14:00");
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/reply-confirm/reply-confirm.service.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
import { AppointmentStatus } from "@prisma/client";

import { schedulingService } from "@/domains/scheduling/scheduling.service";

import { REPLY_CONFIRM_DEFAULTS } from "./reply-confirm-catalog";
import { interpretarResposta } from "./reply-confirm-keywords";
import { replyConfirmRepository } from "./reply-confirm.repository";

export type ProcessarInput = {
  tenantId: string;
  telefone: string;
  texto: string;
  timezone: string;
};

/** Formata no fuso do TENANT, nunca no fuso do processo. */
function formatarDataHora(data: Date, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(data);
}

export class ReplyConfirmService {
  /**
   * Interpreta a resposta do cliente e age no agendamento.
   *
   * Devolve `null` sempre que a mensagem NÃO é uma resposta de confirmação —
   * incluindo os casos em que parece uma mas não há lembrete recente ou candidato.
   * O webhook usa esse `null` para seguir ao chatbot sem alteração de comportamento.
   */
  async processar(input: ProcessarInput): Promise<{ resposta: string } | null> {
    const intencao = interpretarResposta(input.texto);
    if (!intencao) return null;

    const houveLembrete = await replyConfirmRepository.houveLembreteRecente(
      input.tenantId,
      input.telefone,
    );
    if (!houveLembrete) return null;

    const candidatos = await replyConfirmRepository.candidatos(
      input.tenantId,
      input.telefone,
    );
    if (candidatos.length === 0) return null;

    const alvo = candidatos[0];

    try {
      await schedulingService.updateAppointmentStatus(input.tenantId, alvo.id, {
        status:
          intencao === "confirmar"
            ? AppointmentStatus.CONFIRMED
            : AppointmentStatus.CANCELLED,
        // A ação nasceu de uma mensagem do próprio cliente: reenviar a ele o aviso
        // do motor seria mensagem duplicada. A equipe continua sendo notificada
        // pelos eventos de domínio que o service publica.
        notify: false,
      });
    } catch (err) {
      // Roda dentro do webhook. Deixar escapar derruba o handler, e o WhatsApp
      // reentrega o evento — podendo agir duas vezes sobre o mesmo horário.
      console.error(
        "[reply-confirm] Falha ao aplicar a resposta do cliente",
        alvo.id,
        err instanceof Error ? err.message : err,
      );
      return null;
    }

    const base =
      intencao === "confirmar"
        ? REPLY_CONFIRM_DEFAULTS.confirmado
        : REPLY_CONFIRM_DEFAULTS.cancelado;

    // Mais de um candidato: age no mais próximo e DIZ qual foi. Nunca agir em
    // silêncio sobre horário ambíguo.
    if (candidatos.length > 1) {
      const aviso = REPLY_CONFIRM_DEFAULTS.ambiguo.replace(
        "{{data_hora}}",
        formatarDataHora(alvo.startsAt, input.timezone),
      );
      return { resposta: `${aviso}\n\n${base}` };
    }

    return { resposta: base };
  }
}

export const replyConfirmService = new ReplyConfirmService();
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/reply-confirm/
```

Esperado: PASS, todos os arquivos do diretório.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/reply-confirm/reply-confirm.service.ts src/domains/notifications/reply-confirm/reply-confirm.service.test.ts
git commit -m "feat(notifications): service da confirmacao por resposta"
```

---

## Task 5: Plugar no webhook

O espaço já está reservado, com comentário, entre o opt-out e o chatbot.

**Files:**
- Modify: `src/app/api/webhooks/evolution/messages/route.ts`
- Modify: `src/app/api/webhooks/evolution/messages/route.test.ts`

**Interfaces:**
- Consumes: `replyConfirmService.processar` (Task 4).
- Produces: nada consumido por outra task.

> **Este arquivo usa aspas simples e sem ponto e vírgula.** Siga o estilo do arquivo que
> está editando, não o dos arquivos novos.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao `route.test.ts` existente (que já tem 5 testes de opt-out passando):

```ts
describe("webhook do Evolution — confirmação por resposta", () => {
  it("confirma o horário mesmo com autoReplyEnabled desligado", async () => {
    // Mesma razão do opt-out: cancelar ou confirmar um horário não pode depender
    // de o tenant ter chatbot ligado.
    prismaMock.tenant.findFirst.mockResolvedValue(
      tenant({ autoReplyEnabled: false, replyConfirmEnabled: true }),
    );
    processar.mockResolvedValue({ resposta: "Prontinho!" });

    await POST(requisicao("1"));

    expect(processar).toHaveBeenCalledTimes(1);
    expect(sendRawText).toHaveBeenCalledTimes(1);
    expect(sendRawText.mock.calls[0][2]).toBe("Prontinho!");
  });

  it("processa a resposta mesmo dentro da janela de anti-flood", async () => {
    prismaMock.whatsAppAutoReplyLog.findFirst.mockResolvedValue({ id: "recente" });
    prismaMock.tenant.findFirst.mockResolvedValue(tenant({ replyConfirmEnabled: true }));
    processar.mockResolvedValue({ resposta: "Prontinho!" });

    await POST(requisicao("1"));

    expect(processar).toHaveBeenCalledTimes(1);
  });

  it("não chama o service quando a automação está desligada no tenant", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(tenant({ replyConfirmEnabled: false }));

    await POST(requisicao("1"));

    expect(processar).not.toHaveBeenCalled();
  });

  it("segue para o chatbot quando o service devolve null", async () => {
    // "1" sem lembrete recente ou sem candidato não é resposta de confirmação —
    // o comportamento antigo do chatbot precisa ficar intacto.
    prismaMock.tenant.findFirst.mockResolvedValue(tenant({ replyConfirmEnabled: true }));
    processar.mockResolvedValue(null);

    await POST(requisicao("1"));

    expect(processar).toHaveBeenCalledTimes(1);
    expect(prismaMock.whatsAppAutoReplyLog.create).toHaveBeenCalledTimes(1);
  });

  it("não grava no log de anti-flood ao responder a confirmação", async () => {
    // A resposta da confirmação não pode consumir a janela do chatbot.
    prismaMock.tenant.findFirst.mockResolvedValue(tenant({ replyConfirmEnabled: true }));
    processar.mockResolvedValue({ resposta: "Prontinho!" });

    await POST(requisicao("1"));

    expect(prismaMock.whatsAppAutoReplyLog.create).not.toHaveBeenCalled();
  });

  it("o opt-out continua tendo precedência sobre a confirmação", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(tenant({ replyConfirmEnabled: true }));

    await POST(requisicao("PARE"));

    expect(marcarPorTelefone).toHaveBeenCalledTimes(1);
    expect(processar).not.toHaveBeenCalled();
  });
});
```

No topo do arquivo, junto dos mocks existentes:

```ts
const processar = vi.fn().mockResolvedValue(null);

vi.mock("@/domains/notifications/reply-confirm/reply-confirm.service", () => ({
  replyConfirmService: { processar: (...a: unknown[]) => processar(...a) },
}));
```

E acrescentar `replyConfirmEnabled: false` ao objeto devolvido pelo helper `tenant()`.

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/app/api/webhooks/evolution/messages/route.test.ts
```

Esperado: FAIL nos testes novos — `processar` nunca é chamado.

- [ ] **Step 3: Implementar**

No `select` do `prisma.tenant.findFirst`, acrescentar:

```ts
      replyConfirmEnabled: true,
```

E substituir o bloco-marcador pelo código real:

```ts
  // ── 2. Confirmação por resposta (1/2) ────────────────────────────────────
  // Também fora do gate de `autoReplyEnabled` e antes do throttle: confirmar ou
  // cancelar um horário não pode depender de o tenant ter chatbot ligado, nem ser
  // engolido pela janela de anti-flood. A resposta enviada aqui não grava no
  // WhatsAppAutoReplyLog — ela não é auto-resposta.
  if (tenant.replyConfirmEnabled) {
    const resultado = await replyConfirmService.processar({
      tenantId: tenant.id,
      telefone: phone,
      texto: text,
      timezone: tenant.timezone,
    })

    if (resultado) {
      await evolutionProvider
        .sendRawText(instanceName, phone, resultado.resposta)
        .catch(() => {})
      return new Response(null, { status: 200 })
    }
  }
```

Com o import no topo:

```ts
import { replyConfirmService } from '@/domains/notifications/reply-confirm/reply-confirm.service'
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/app/api/webhooks/ src/domains/notifications/
```

Esperado: PASS. Os 5 testes de opt-out não podem regredir.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/evolution/messages/route.ts src/app/api/webhooks/evolution/messages/route.test.ts
git commit -m "feat(notifications): confirmacao por resposta plugada no webhook"
```

---

## Task 6: Anexar o convite ao lembrete

O convite entra **depois** da renderização, no gateway — nunca dentro do template.

**Files:**
- Modify: `src/domains/notifications/providers/whatsapp.gateway.ts`
- Modify: `src/domains/notifications/providers/whatsapp.gateway.test.ts`

**Interfaces:**
- Consumes: `montarConvite` (Task 2).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao `whatsapp.gateway.test.ts` existente. **Leia o arquivo inteiro antes** — ele já tem um padrão de mock do tenant que você deve reusar, acrescentando `replyConfirmEnabled` e `replyConfirmInvite` ao objeto.

```ts
describe("convite de confirmação por resposta", () => {
  it("anexa o convite ao lembrete quando a automação está ligada", async () => {
    // ... montar tenant com replyConfirmEnabled: true, replyConfirmInvite: null
    // ... despachar template "appointment-reminder"
    // O texto enviado termina com o convite padrão do catálogo.
    expect(textoEnviado).toContain("Responda *1* para confirmar");
  });

  it("NÃO anexa o convite quando a automação está desligada", async () => {
    expect(textoEnviado).not.toContain("Responda *1*");
  });

  it("NÃO anexa o convite em eventos que não são o lembrete", async () => {
    // Convite em mensagem de cancelamento não faz sentido nenhum.
    // ... despachar template "appointment-cancelled" com replyConfirmEnabled: true
    expect(textoEnviado).not.toContain("Responda *1*");
  });

  it("usa o convite personalizado do tenant quando existe", async () => {
    // ... replyConfirmInvite: "\n\nResponda 1 (sim) ou 2 (nao)"
    expect(textoEnviado).toContain("Responda 1 (sim) ou 2 (nao)");
    expect(textoEnviado).not.toContain("Responda *1* para confirmar");
  });

  it("não anexa o convite quando o profissional escreveu a mensagem na hora", async () => {
    // `payload.message` tem precedência e é texto livre de quem escreveu — anexar
    // um convite a ele seria alterar a mensagem de alguém sem avisar.
    expect(textoEnviado).not.toContain("Responda *1*");
  });
});
```

> Os comentários `// ...` acima marcam onde montar as fixtures **seguindo o padrão que já
> existe no arquivo**. Não invente um novo esquema de mock: leia o teste vizinho mais
> próximo e copie a estrutura dele, trocando só o que este caso precisa.

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/providers/whatsapp.gateway.test.ts
```

Esperado: FAIL — o convite nunca aparece.

- [ ] **Step 3: Implementar**

No `select` do `prisma.tenant.findFirst` do gateway, acrescentar:

```ts
        replyConfirmEnabled: true,
        replyConfirmInvite: true,
```

E, logo **depois** do bloco que preenche `rendered` (tanto pelo caminho de `payload.message`
quanto pelo de `customerMessageService.render`), antes do envio:

```ts
    // O convite de confirmação é ANEXADO ao texto já renderizado, nunca embutido no
    // template: assim, desligar a automação não deixa um pedido órfão num texto que o
    // tenant editou, e ligar não exige que ele edite nada.
    //
    // Só no lembrete, e só quando o texto veio do template — mensagem escrita na hora
    // pelo profissional é dele, e anexar algo a ela seria alterá-la sem avisar.
    if (
      tenant.replyConfirmEnabled &&
      draft.template === "appointment-reminder" &&
      !payload.message
    ) {
      rendered = {
        ...rendered,
        text: `${rendered.text}${montarConvite(tenant.replyConfirmInvite)}`,
      };
    }
```

Com o import no topo:

```ts
import { montarConvite } from "../reply-confirm/reply-confirm-catalog";
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/
```

Esperado: PASS, sem regressão.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/providers/whatsapp.gateway.ts src/domains/notifications/providers/whatsapp.gateway.test.ts
git commit -m "feat(notifications): convite de confirmacao anexado ao lembrete renderizado"
```

---

## Task 7: UI da confirmação por resposta

Liga/desliga e texto do convite, na aba de WhatsApp das Configurações.

**Files:**
- Modify: `src/components/domain/settings/whatsapp-settings-form.tsx`
- Modify: `src/app/api/notifications/settings/route.ts`
- Modify: `src/hooks/settings/use-notification-settings.ts`

**Interfaces:**
- Consumes: os campos `Tenant.replyConfirmEnabled` / `replyConfirmInvite`.
- Produces: nada consumido por outra task.

> **Antes de escrever:** leia os três arquivos inteiros. O formulário já tem um padrão de
> `Switch` + `Select` que salva por `PATCH` a cada alteração — siga-o, não invente outro.
> O `PATCH` já valida com Zod; acrescente os dois campos ao schema existente.

- [ ] **Step 1: Estender o schema da rota**

Em `src/app/api/notifications/settings/route.ts`, no schema de `PATCH`:

```ts
  replyConfirmEnabled: z.boolean().optional(),
  replyConfirmInvite: z.string().trim().max(300).nullable().optional(),
```

E acrescentar os dois campos ao `select` e ao corpo da resposta do `GET`, junto dos demais.

- [ ] **Step 2: Estender o hook**

Em `src/hooks/settings/use-notification-settings.ts`, acrescentar aos dois tipos (o de
leitura e o de escrita):

```ts
  replyConfirmEnabled: boolean;
  replyConfirmInvite: string | null;
```

- [ ] **Step 3: Adicionar o bloco ao formulário**

Seguindo o padrão dos blocos vizinhos do arquivo:

```tsx
<div className="space-y-3 rounded-lg border p-4">
  <div className="flex items-start justify-between gap-3">
    <div className="space-y-0.5">
      <Label htmlFor="reply-confirm" className="text-sm font-medium">
        Confirmação pelo WhatsApp
      </Label>
      <p className="text-xs text-muted-foreground">
        O cliente responde <strong>1</strong> para confirmar ou <strong>2</strong> para
        cancelar, direto na conversa. O horário cancelado fica livre na hora.
      </p>
    </div>
    <Switch
      id="reply-confirm"
      className="mt-0.5"
      checked={data?.replyConfirmEnabled ?? false}
      onCheckedChange={(v) => update({ replyConfirmEnabled: v })}
    />
  </div>

  {data?.replyConfirmEnabled && (
    <div className="space-y-1.5">
      <Label htmlFor="reply-confirm-invite" className="text-xs">
        Texto do convite, anexado ao final do lembrete
      </Label>
      <Textarea
        id="reply-confirm-invite"
        rows={2}
        className="resize-none"
        defaultValue={data.replyConfirmInvite ?? ''}
        placeholder="Responda 1 para confirmar ou 2 para cancelar."
        onBlur={(e) => update({ replyConfirmInvite: e.target.value || null })}
      />
      <p className="text-xs text-muted-foreground">
        Deixe em branco para usar o texto padrão.
      </p>
    </div>
  )}
</div>
```

- [ ] **Step 4: Verificar tipos e rodar os testes**

```bash
npx tsc --noEmit
npx vitest run src/app/api/notifications/ src/components/domain/settings/
```

Esperado: zero erros de tipo, sem regressão.

- [ ] **Step 5: Conferir no mobile**

A 375 px: a linha do switch não estoura, o `Textarea` cabe, o alvo de toque tem 44 px.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/settings/whatsapp-settings-form.tsx src/app/api/notifications/settings/route.ts src/hooks/settings/use-notification-settings.ts
git commit -m "feat(settings): liga/desliga e texto do convite da confirmacao por resposta"
```

---

## Task 8: Campo de retorno programado no serviço

**Files:**
- Modify: `src/domains/scheduling/types.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts` (métodos de criar/atualizar serviço)
- Modify: a UI de formulário de serviço (localizar com `grep -rln "createServiceSchema\|duration" src/components/domain --include=*.tsx`)

**Interfaces:**
- Consumes: `Service.returnIntervalDays` (já no schema).
- Produces: `returnIntervalDays` passa a trafegar nos schemas de serviço.

- [ ] **Step 1: Escrever o teste que falha**

```ts
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
```

Salvar em `src/domains/scheduling/service-return-interval.test.ts`.

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/scheduling/service-return-interval.test.ts
```

Esperado: FAIL — o campo não existe no schema.

- [ ] **Step 3: Estender os schemas**

Em `src/domains/scheduling/types.ts`, acrescentar ao `createServiceSchema` e ao
`updateServiceSchema`:

```ts
  /**
   * Retorno programado: dias após o atendimento em que o cliente é lembrado de
   * voltar. Sem valor, o serviço não participa da automação.
   */
  returnIntervalDays: z.number().int().min(1).max(730).optional().nullable(),
```

- [ ] **Step 4: Repassar no service**

Encontre os métodos que criam e atualizam serviço em `scheduling.service.ts` e acrescente
`returnIntervalDays: input.returnIntervalDays` ao objeto passado ao repositório.

> **Não pule este passo.** Na Etapa 1, `birthDate` estava no schema e no formulário e nunca
> chegava ao repositório — o dado era descartado em silêncio. Rode o teste da Task 9 depois
> e confirme que o valor chega.

- [ ] **Step 5: Adicionar o campo ao formulário de serviço**

Ao lado do campo de duração:

```tsx
<div className="space-y-1.5">
  <Label htmlFor="return-interval">Lembrar de voltar após (dias)</Label>
  <NumberInput
    id="return-interval"
    value={returnIntervalDays}
    onChange={setReturnIntervalDays}
    placeholder="Ex.: 30"
  />
  <p className="text-xs text-muted-foreground">
    Deixe vazio para não enviar lembrete de retorno deste serviço.
  </p>
</div>
```

> Use o `NumberInput` do projeto (`src/components/ui/`), não `<Input type="number">` —
> `Number("")` é `0`, e um campo vazio viraria "retornar em 0 dias". Confira o nome e a
> assinatura reais do componente antes de usar.

- [ ] **Step 6: Rodar para ver passar**

```bash
npx vitest run src/domains/scheduling/
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/domains/scheduling/ src/components/domain/
git commit -m "feat(servicos): intervalo de retorno programado por servico"
```

---

## Task 9: Job diário do retorno programado

**Files:**
- Create: `src/shared/queue/jobs/return-due.ts`
- Test: `src/shared/queue/jobs/return-due.test.ts`
- Modify: `src/app/api/cron/tick/route.ts`

**Interfaces:**
- Consumes: `customerMessageDispatcher.dispatch` de `@/domains/notifications/customer-messages/customer-message-dispatcher.service`.
- Produces: `RETURN_DUE_JOB = "return-due"` e `handleReturnDue(jobs): Promise<void>`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { handleReturnDue } from "./return-due";

const dispatch = vi.fn();

vi.mock("@/domains/notifications/customer-messages/customer-message-dispatcher.service", () => ({
  customerMessageDispatcher: { dispatch: (...a: unknown[]) => dispatch(...a) },
}));

const prismaMock = prisma as unknown as { $queryRaw: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$queryRaw = vi.fn().mockResolvedValue([
    {
      customerId: "c1",
      tenantId: "t1",
      customerName: "Maria",
      phone: "11999990000",
      serviceName: "Escova",
    },
  ]);
});

describe("handleReturnDue", () => {
  it("dispara o evento return_due para cada cliente elegível", async () => {
    await handleReturnDue([]);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toEqual(
      expect.objectContaining({ tenantId: "t1", event: "return_due", customerId: "c1" }),
    );
  });

  it("não filtra consentimento na consulta — quem decide é a guarda do dispatcher", async () => {
    // A guarda central já aplica consentimento, opt-out e anti-fadiga. Repetir o
    // filtro aqui recria o problema que a Etapa 1 resolveu.
    await handleReturnDue([]);

    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).not.toContain("consentGiven");
  });

  it("exige serviço com intervalo configurado", async () => {
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain("returnIntervalDays");
  });

  it("exclui cliente com agendamento futuro", async () => {
    // Quem já tem horário marcado não precisa ser lembrado de voltar.
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain("NOT EXISTS");
  });

  it("considera apenas atendimentos concluídos", async () => {
    await handleReturnDue([]);
    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain("COMPLETED");
  });

  it("não explode quando não há ninguém elegível", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(handleReturnDue([])).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("segue para o próximo cliente quando um envio falha", async () => {
    // Um telefone inválido não pode impedir os demais lembretes do dia.
    prismaMock.$queryRaw.mockResolvedValue([
      { customerId: "c1", tenantId: "t1", customerName: "A", phone: "1", serviceName: "X" },
      { customerId: "c2", tenantId: "t1", customerName: "B", phone: "2", serviceName: "Y" },
    ]);
    dispatch.mockRejectedValueOnce(new Error("boom"));

    await handleReturnDue([]);

    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/shared/queue/jobs/return-due.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
import type { PgBoss, Job } from "pg-boss";

import { prisma } from "@/shared/database/prisma";

export const RETURN_DUE_JOB = "return-due";

/**
 * Retorno programado: avisa o cliente que já é hora de voltar.
 *
 * Elegível quem teve um atendimento CONCLUÍDO cujo serviço tem `returnIntervalDays`
 * configurado, cuja data + intervalo cai HOJE no fuso do tenant, e que **não** tem
 * agendamento futuro.
 *
 * O filtro de consentimento NÃO entra aqui: a guarda do `customerMessageDispatcher`
 * já aplica consentimento, opt-out e anti-fadiga para eventos promocionais. Repetir
 * o filtro no SQL recria exatamente o problema que a Etapa 1 resolveu.
 */
export async function handleReturnDue(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const elegiveis = await prisma.$queryRaw<
    {
      customerId: string;
      tenantId: string;
      customerName: string;
      phone: string;
      serviceName: string;
    }[]
  >`
    SELECT DISTINCT ON (c.id)
      c.id            AS "customerId",
      c."tenantId"    AS "tenantId",
      c.name          AS "customerName",
      c.phone         AS "phone",
      s.name          AS "serviceName"
    FROM "Appointment" a
    INNER JOIN "Service"  s ON s.id = a."serviceId"
    INNER JOIN "Customer" c ON c.id = a."customerId"
    INNER JOIN "Tenant"   t ON t.id = a."tenantId"
    WHERE a.status = 'COMPLETED'
      AND s."returnIntervalDays" IS NOT NULL
      AND c.phone IS NOT NULL
      AND c."deletedAt" IS NULL
      AND t."evolutionConnected" = true
      -- "Hoje" no fuso do tenant, nunca no fuso do processo.
      AND (
        (a."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE t.timezone)::date
        + (s."returnIntervalDays" * INTERVAL '1 day')
      )::date
      = (NOW() AT TIME ZONE 'UTC' AT TIME ZONE t.timezone)::date
      -- Quem já tem horário marcado não precisa ser lembrado de voltar.
      AND NOT EXISTS (
        SELECT 1 FROM "Appointment" fut
        WHERE fut."customerId" = c.id
          AND fut."tenantId" = c."tenantId"
          AND fut."startsAt" > NOW()
          AND fut.status IN ('SCHEDULED', 'CONFIRMED')
      )
    ORDER BY c.id, a."startsAt" DESC
  `;

  if (elegiveis.length === 0) return;

  const { customerMessageDispatcher } = await import(
    "@/domains/notifications/customer-messages/customer-message-dispatcher.service"
  );

  for (const item of elegiveis) {
    try {
      await customerMessageDispatcher.dispatch({
        tenantId: item.tenantId,
        event: "return_due",
        customerId: item.customerId,
        recipient: { phone: item.phone, email: null },
        payload: { customerName: item.customerName, serviceName: item.serviceName },
      });
    } catch (err) {
      // Um telefone inválido não pode impedir os demais lembretes do dia.
      console.error(
        "[return-due] Falha ao despachar",
        item.customerId,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export async function registerReturnDue(boss: PgBoss): Promise<void> {
  await boss.schedule(RETURN_DUE_JOB, "0 12 * * *", {});
  boss.work(RETURN_DUE_JOB, handleReturnDue);
}
```

- [ ] **Step 4: Registrar no tick**

Em `src/app/api/cron/tick/route.ts`, seguindo exatamente o padrão dos jobs vizinhos:

- import de `RETURN_DUE_JOB` e `handleReturnDue`;
- `boss.createQueue(RETURN_DUE_JOB)` no `Promise.all` de criação de filas;
- `boss.schedule(RETURN_DUE_JOB, "0 12 * * *", {})` no `Promise.all` de agendamento;
- `runBatch(boss, RETURN_DUE_JOB, handleReturnDue)` no `Promise.all` de execução, com a
  variável correspondente adicionada ao destructuring e ao objeto `processed` da resposta.

> Os três `Promise.all` precisam ser atualizados juntos. Esquecer o `createQueue` faz o
> pg-boss v12 lançar erro de foreign key ("Queue X not found").

- [ ] **Step 5: Rodar para ver passar**

```bash
npx vitest run src/shared/queue/
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/queue/jobs/return-due.ts src/shared/queue/jobs/return-due.test.ts src/app/api/cron/tick/route.ts
git commit -m "feat(notifications): job diario de retorno programado"
```

---

## Task 10: Marcar a reconquista como indisponível

O evento `winback` está no catálogo e aparece na matriz de Mensagens ao cliente com toggle,
mas **nada o dispara** — e continuará assim, porque a reconquista saiu de escopo por decisão
do usuário. Um toggle que o profissional liga e nada acontece é pior que a ausência do
recurso.

**Files:**
- Modify: `src/domains/notifications/customer-messages/types.ts` (campo novo na entrada do catálogo)
- Modify: `src/domains/notifications/customer-messages/customer-message-catalog.ts`
- Modify: `src/components/domain/settings/customer-message-list.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `CustomerMessageCatalogEntry.status?: "ga" | "soon"` — ausente significa `"ga"`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { getCatalogEntry, CUSTOMER_MESSAGE_CATALOG } from "./customer-message-catalog";

describe("status de disponibilidade no catálogo", () => {
  it("marca winback como indisponível", () => {
    // A reconquista saiu de escopo. O evento continua no catálogo (remover exigiria
    // mexer no enum do Prisma), mas a UI não pode oferecer um toggle que não faz nada.
    expect(getCatalogEntry("winback").status).toBe("soon");
  });

  it("return_due está disponível — o job existe a partir da Etapa 2", () => {
    expect(getCatalogEntry("return_due").status ?? "ga").toBe("ga");
  });

  it("todos os demais eventos estão disponíveis", () => {
    const indisponiveis = CUSTOMER_MESSAGE_CATALOG
      .filter((e) => e.status === "soon")
      .map((e) => e.event);

    expect(indisponiveis).toEqual(["winback"]);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-catalog.test.ts
```

Esperado: FAIL — `status` não existe.

- [ ] **Step 3: Implementar**

Em `types.ts`, acrescentar ao `CustomerMessageCatalogEntry`:

```ts
  /**
   * `"soon"` quando o evento existe no catálogo mas nada o dispara ainda. A UI
   * mostra o texto e desabilita o liga/desliga, em vez de oferecer um controle
   * que não faz nada. Ausente = `"ga"`.
   */
  status?: "ga" | "soon";
```

Na entrada de `winback` do catálogo, acrescentar `status: "soon",`.

- [ ] **Step 4: Refletir na UI**

Em `customer-message-list.tsx`, na linha de cada evento: quando `status === "soon"`,
desabilitar o toggle e exibir um selo. Siga o padrão de badge já usado no projeto:

```tsx
{item.status === 'soon' && (
  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
    Em breve
  </span>
)}
```

E `disabled={item.status === 'soon'}` no `Switch` correspondente.

> O campo `status` precisa ser propagado pela rota `GET /api/notifications/customer-templates`
> até o item que a lista consome. Confira o caminho inteiro — se parar no meio, a UI recebe
> `undefined` e o selo nunca aparece.

- [ ] **Step 5: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/ src/components/domain/settings/
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/customer-messages/ src/components/domain/settings/ src/app/api/notifications/
git commit -m "feat(notifications): winback marcado como indisponivel na matriz"
```

---

## Task 11: Gate final e PR

- [ ] **Step 1: Rodar o gate completo**

```bash
npx tsc --noEmit
npx vitest run
```

Esperado: zero erros de tipo. **As 3 falhas pré-existentes documentadas no `CLAUDE.md`
continuam vermelhas e não contam** — qualquer outra é regressão desta etapa.

- [ ] **Step 2: Conferir que não há migration nova**

```bash
git diff --name-only main..HEAD -- prisma/
```

Esperado: vazio. Esta etapa não altera o banco; se aparecer algo em `prisma/`, alguém
acrescentou um campo sem necessidade — investigue antes de seguir.

- [ ] **Step 3: Abrir a PR**

```bash
git push -u origin feat/motor-mensagens-etapa-2-fase-5
gh pr create --base main --title "feat(notifications): confirmacao por resposta e retorno programado (etapa 2 de 3)" --body "$(cat <<'CORPO'
Etapa 2 de 3 do pacote de consolidação + Fases 3 e 5.
Spec: `docs/superpowers/specs/2026-08-02-motor-mensagens-consolidacao-fases-3-5-design.md` §5

## O que entra

**Confirmação por resposta (1/2).** O cliente responde `1` para confirmar ou `2` para
cancelar direto no WhatsApp; o horário cancelado libera na hora. O convite é **anexado ao
lembrete já renderizado**, nunca embutido no template — desligar a automação não deixa um
pedido órfão num texto que o tenant editou, e ligar não exige que ele edite nada.

Regras de casamento: só interpreta `1`/`2` se houve lembrete àquele telefone nas últimas
48 h (consultado no `NotificationLog`, sem model novo); cliente localizado pelo telefone
**dentro do tenant**, com as duas variantes de DDI; candidatos são `SCHEDULED` nas próximas
48 h. Com mais de um candidato, age no mais próximo **e responde dizendo qual foi** — nunca
age em silêncio sobre horário ambíguo. Sem candidato, cai no chatbot sem alteração.

Roda **fora** do gate de `autoReplyEnabled` e **antes** do throttle de anti-flood, pelo
mesmo motivo do opt-out: cancelar um horário não pode depender de o tenant ter chatbot
ligado.

**Retorno programado.** `Service.returnIntervalDays` por serviço; job diário dispara
`return_due` para quem concluiu um atendimento cuja data + intervalo cai hoje **no fuso do
tenant** e que não tem agendamento futuro. Promocional, então passa pela guarda de
consentimento da Etapa 1 — o SQL **não** repete o filtro.

**Reconquista marcada como indisponível.** O evento `winback` continua no catálogo mas
ganha selo "Em breve" e toggle desabilitado: nada o dispara, e um controle que o
profissional liga sem efeito é pior que a ausência do recurso.

## Aplicar em produção

**Nenhuma migration.** Os campos já entraram na migration da Etapa 1, aplicada em 2026-08-03.

Depois do deploy, o job novo (`return-due`) é registrado sozinho no primeiro `/api/cron/tick`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
CORPO
)"
```

- [ ] **Step 4: Confirmar que a PR foi criada**

```bash
gh pr view --json number,title,state
```

> `gh pr merge` já "falhou" neste projeto tendo mergeado de verdade. Sempre confirme o
> estado real com `gh pr view` antes de concluir que algo deu errado.

---

## Autorrevisão do plano

**Cobertura da §5 da spec:**

| Requisito | Task |
|---|---|
| §5.1 convite anexado ao lembrete renderizado, editável | 2, 6, 7 |
| §5.1 gate `Tenant.replyConfirmEnabled` | 5, 7 |
| §5.1 só interpreta com lembrete nas últimas 48 h | 3, 4 |
| §5.1 telefone dentro do tenant, variantes de DDI | 3 |
| §5.1 candidatos `SCHEDULED` nas próximas 48 h | 3 |
| §5.1 mais de um → age no mais próximo e diz qual | 4 |
| §5.1 zero candidatos → cai no chatbot | 4, 5 |
| §5.1 `1`→`CONFIRMED`, `2`→`CANCELLED`, com eventos de domínio | 4 |
| §5.2 `Service.returnIntervalDays` | 8 |
| §5.2 job diário, fuso do tenant, sem agendamento futuro | 9 |
| §5.2 promocional passa pela guarda | 9 |
| §5.3 winback visivelmente indisponível | 10 |

Sem lacuna.

**Varredura de placeholder:** as Tasks 6, 7 e 8 têm passos que mandam ler o arquivo antes e
seguir o padrão vizinho, em vez de trazer o código completo — porque o padrão real desses
três arquivos (mocks do gateway, formulário de configurações, formulário de serviço) não foi
lido ao escrever este plano. **É a dívida conhecida deste documento.** O implementador deve
ler o arquivo inteiro antes de editar, e o revisor deve conferir que o padrão existente foi
seguido, não reinventado.

**Consistência de tipos:** `RespostaConfirmacao` (Task 1) é consumido em Task 4.
`AgendamentoCandidato` (Task 3) é o que `candidatos()` devolve e o que o service consome.
`REPLY_CONFIRM_DEFAULTS` (Task 2) é usado em Tasks 4 e 6. `montarConvite` (Task 2) é usado
na Task 6. `RETURN_DUE_JOB`/`handleReturnDue` (Task 9) são registrados no tick na mesma task.

**Dois riscos que valem atenção na revisão:**

1. **`notify: false` na confirmação por resposta.** A ação nasce de uma mensagem do próprio
   cliente; reenviar a ele o aviso do motor seria mensagem duplicada. Mas a equipe **precisa**
   continuar sendo notificada — isso vem dos eventos de domínio que `updateAppointmentStatus`
   publica, e não do `notify`. Confirmar que o motor de notificações da equipe continua
   disparando.
2. **O convite anexado muda o tamanho do lembrete.** Se algum ponto do sistema truncar a
   mensagem por comprimento, o convite é o primeiro a sumir — e a automação viraria um
   mistério. Confirmar que não há truncamento no caminho de envio.
