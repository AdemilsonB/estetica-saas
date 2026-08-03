# Motor de mensagens — Etapa 1: Fundação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os defeitos que a auditoria encontrou no motor de mensagens já entregue e construir a fundação de consentimento, opt-out e webhook que as Fases 5 e 3 vão consumir.

**Architecture:** O `customerMessageDispatcher` vira o guardião único do consentimento, decidindo por natureza do evento lida do catálogo — transacional sempre envia, promocional exige consentimento, ausência de opt-out e anti-fadiga. O webhook do Evolution é reordenado para que opt-out rode antes de qualquer gate. Todo texto restante no código migra para a arquitetura de duas camadas já usada nas Fases 1 e 2: catálogo em código é o padrão, o banco guarda só a personalização, ausência de registro significa "usa o padrão".

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma + Supabase, Zod, TanStack Query, Shadcn UI, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-02-motor-mensagens-consolidacao-fases-3-5-design.md`](../specs/2026-08-02-motor-mensagens-consolidacao-fases-3-5-design.md)

## Global Constraints

- **Todo output em Português do Brasil** — código, comentários, mensagens de commit, nomes de branch. Sem exceções.
- **`tenantId` sempre do token, nunca do body ou da URL.** Todo repository filtra por `tenantId` em todas as queries.
- **TypeScript strict** — sem `any`, sem `as unknown as`.
- **Erros de domínio tipados** de `src/shared/errors/`. Nunca `throw new Error('string')`.
- **Nenhum campo novo entra na query de sessão (`/me`)** — causa conhecida de dois incidentes de logout global neste projeto.
- **Migrations não rodam no build da Vercel.** São manuais, porta **5432** do Supabase (a 6543 trava em DDL).
- **Não há banco local disponível.** A migration é escrita à mão e conferida com `prisma migrate diff`, seguindo o precedente do ADR-017 e do ADR-019.
- **Todo `DialogContent` precisa de `max-h-[85dvh]` + `overflow-y-auto`.** Alvo de toque mínimo 44 px. Mobile-first: base → `md:` → `lg:`.
- **Gate antes de entregar:** `npx tsc --noEmit` com zero erros e `npx vitest run` com tudo passando.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` | Campos novos de `Customer`, `Tenant`, `Service`; índices do `NotificationLog`; models `Campaign`/`CampaignRecipient` |
| `prisma/migrations/20260802120000_motor_mensagens_fundacao/migration.sql` | A migration única do pacote |
| `src/domains/notifications/customer-messages/customer-message-consent.ts` | **Novo.** Decide se um evento pode ser enviado a um cliente. Puro, sem I/O |
| `src/domains/notifications/customer-messages/customer-message-consent.repository.ts` | **Novo.** Lê o cliente e conta promocionais recentes para a anti-fadiga |
| `src/domains/notifications/customer-messages/customer-message-dispatcher.service.ts` | Passa a chamar a guarda antes de despachar |
| `src/domains/notifications/auto-reply/auto-reply-catalog.ts` | **Novo.** Textos padrão do webhook (agendar, cancelar, preços, horários) |
| `src/domains/notifications/auto-reply/auto-reply-messages.ts` | **Novo.** Resolve texto do tenant ou padrão, e monta as respostas com dados |
| `src/domains/notifications/opt-out/opt-out-keywords.ts` | **Novo.** Normalização e reconhecimento de palavra de descadastro. Puro |
| `src/domains/crm/opt-out.service.ts` | **Novo.** Marca `marketingOptOut` com data e origem |
| `src/app/api/webhooks/evolution/messages/route.ts` | Reordenado: opt-out → (confirmação, na Etapa 2) → auto-resposta |
| `src/shared/queue/jobs/birthday-reminder.ts` | Perde o filtro de consentimento e a precedência do `birthdayMessage` |
| `src/app/api/notifications/bulk-reminder/route.ts` | Perde o filtro de consentimento |
| `src/app/api/cron/tick/route.ts` | Ganha `maxDuration` |
| `src/components/domain/crm/customer-form.tsx` | Chave de consentimento no painel |
| `src/app/api/public/[slug]/customers/route.ts` | Grava o consentimento escolhido em vez de `true` fixo |

---

## Task 1: Migration única e schema

Toda a mudança de banco do pacote inteiro numa migration só, para trocar três janelas manuais de produção por uma. As colunas das Etapas 2 e 3 nascem aqui, sem uso — coluna aditiva não usada não custa nada.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260802120000_motor_mensagens_fundacao/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `Customer.marketingOptOut/marketingOptOutAt/marketingOptOutOrigin`, `Tenant.replyConfirmEnabled/replyConfirmInvite/evolutionConnectedAt/autoReplyCancelMessage/autoReplyPriceIntro/autoReplyHoursIntro`, `Service.returnIntervalDays`, models `Campaign`/`CampaignRecipient`, enums `CampaignStatus`/`CampaignRecipientStatus`, dois índices em `NotificationLog`.

- [ ] **Step 1: Adicionar os campos ao `Customer`**

Em `prisma/schema.prisma`, no model `Customer`, logo abaixo de `consentOrigin`:

```prisma
  /// Pedido explícito de não receber mais mensagem promocional. Independente de
  /// `consentGiven`, que é consentimento de cadastro: "aceitei me cadastrar" e
  /// "não quero mais promoção" são coisas diferentes. Nunca bloqueia transacional.
  marketingOptOut       Boolean             @default(false)
  marketingOptOutAt     DateTime?
  /// Por onde o cliente pediu para sair: `whatsapp_reply`, `portal`, `panel`.
  marketingOptOutOrigin String?
```

- [ ] **Step 2: Adicionar os campos ao `Tenant`**

No model `Tenant`, junto dos demais campos de notificação:

```prisma
  /// Confirmação por resposta (1/2) ao lembrete — Etapa 2. Desligada por padrão.
  replyConfirmEnabled     Boolean   @default(false)
  /// Convite anexado ao lembrete renderizado. `null` = usa o padrão do catálogo.
  replyConfirmInvite      String?
  /// Quando a instância do Evolution foi conectada. Alimenta a curva de aquecimento
  /// da Etapa 3. `null` nos tenants existentes = conexão tratada como madura.
  evolutionConnectedAt    DateTime?
  /// Personalizações das respostas automáticas do webhook. `null` = usa o padrão
  /// do catálogo (`auto-reply-catalog.ts`), nunca "sem mensagem".
  autoReplyCancelMessage  String?
  autoReplyPriceIntro     String?
  autoReplyHoursIntro     String?
```

- [ ] **Step 3: Adicionar o campo ao `Service`**

```prisma
  /// Retorno programado — Etapa 2. Sem valor, o serviço não participa.
  returnIntervalDays Int?
```

- [ ] **Step 4: Adicionar os índices ao `NotificationLog`**

No bloco de índices do model `NotificationLog`:

```prisma
  /// Anti-fadiga: conta promocionais dos últimos 7 dias por cliente.
  @@index([tenantId, customerId, createdAt])
  /// Casamento da confirmação por resposta: lembrete enviado a este telefone nas
  /// últimas 48 h.
  @@index([tenantId, recipient, createdAt])
```

- [ ] **Step 5: Adicionar os models de campanha**

No fim do arquivo, junto dos demais models de notificação:

```prisma
/// Campanha segmentada — Etapa 3. Nasce nesta migration sem uso.
model Campaign {
  id             String             @id @default(cuid())
  tenantId       String
  name           String
  body           String             @db.Text
  /// Segmento resolvido (preset + refinos), validado por Zod na escrita.
  segment        Json
  status         CampaignStatus     @default(DRAFT)
  /// Disparo só habilita depois de um envio de teste. Editar o corpo zera isto.
  testSentAt     DateTime?
  startedAt      DateTime?
  finishedAt     DateTime?
  totalRecipients Int               @default(0)
  sentCount      Int                @default(0)
  failedCount    Int                @default(0)
  skippedCount   Int                @default(0)
  createdByUserId String
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  tenant        Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdByUser User                @relation("CampaignCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict)
  recipients    CampaignRecipient[]

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([createdByUserId])
}

/// Um registro por destinatário. É o que dá idempotência: reprocessar um lote
/// nunca envia duas vezes para a mesma pessoa.
model CampaignRecipient {
  id                String                  @id @default(cuid())
  tenantId          String
  campaignId        String
  customerId        String
  status            CampaignRecipientStatus @default(PENDING)
  /// Preenchido quando SKIPPED: `sem-telefone`, `sem-consentimento`, `opt-out`,
  /// `anti-fadiga`, `sem-atendimento`.
  skipReason        String?
  failureReason     String?
  notificationLogId String?
  sentAt            DateTime?
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt

  tenant   Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  /// Idempotência: uma pessoa entra uma vez só em cada campanha.
  @@unique([campaignId, customerId])
  @@index([tenantId])
  /// Índice da varredura do cron: sem tenantId de propósito, o tick processa
  /// todos os tenants numa passada só. Mesmo padrão de ScheduledMessage.
  @@index([status, campaignId])
  @@index([customerId])
}

enum CampaignStatus {
  DRAFT
  RUNNING
  PAUSED
  COMPLETED
  CANCELLED
}

enum CampaignRecipientStatus {
  PENDING
  SENT
  FAILED
  SKIPPED
}
```

- [ ] **Step 6: Declarar as relações inversas**

No model `Tenant`, adicionar:

```prisma
  campaigns          Campaign[]
  campaignRecipients CampaignRecipient[]
```

No model `Customer`, adicionar:

```prisma
  campaignRecipients CampaignRecipient[]
```

No model `User`, adicionar:

```prisma
  campaignsCreated Campaign[] @relation("CampaignCreatedBy")
```

- [ ] **Step 7: Validar o schema e regenerar o client**

```bash
npx prisma validate
npx prisma generate
```

Esperado: `The schema at prisma/schema.prisma is valid` e o client regenerado sem erro.

> Se `prisma generate` não rodar, nada abaixo compila. Este projeto já teve erro de `tsc` que parecia bug real e era só o client dessincronizado após troca de branch.

- [ ] **Step 8: Gerar o SQL da migration**

Não há banco local. Gerar o SQL comparando o schema com o estado migrado, sem tocar em banco nenhum:

```bash
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script > prisma/migrations/20260802120000_motor_mensagens_fundacao/migration.sql
```

Se não houver shadow database disponível, escrever o SQL à mão seguindo o precedente do ADR-019 e conferir depois (Step 9). O arquivo deve conter apenas `ALTER TABLE ... ADD COLUMN`, `CREATE TABLE`, `CREATE TYPE` e `CREATE INDEX` — **nenhum `DROP`**.

- [ ] **Step 9: Conferir que a migration é puramente aditiva**

```bash
grep -iE "drop|truncate|alter column|not null" prisma/migrations/20260802120000_motor_mensagens_fundacao/migration.sql
```

Esperado: nenhuma linha de `DROP`/`TRUNCATE`/`ALTER COLUMN`. Colunas `NOT NULL` só são aceitáveis quando acompanhadas de `DEFAULT` (caso de `marketingOptOut` e `replyConfirmEnabled`).

Se aparecer qualquer `DROP`, **pare e reporte** — significa que o schema divergiu do esperado e aplicar isso em produção destruiria dado.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260802120000_motor_mensagens_fundacao/
git commit -m "feat(db): migration unica do motor de mensagens (fundacao + fases 3 e 5)"
```

---

## Task 2: Guarda de consentimento — a decisão pura

O núcleo da §4.1. Função pura, sem I/O, para que a regra seja testável sozinha e o repositório entre só na Task 3.

**Files:**
- Create: `src/domains/notifications/customer-messages/customer-message-consent.ts`
- Test: `src/domains/notifications/customer-messages/customer-message-consent.test.ts`

**Interfaces:**
- Consumes: `getCatalogEntry(event)` e `CustomerMessageNature` de `./customer-message-catalog` e `./types`.
- Produces:
  - `type ConsentSnapshot = { consentGiven: boolean; marketingOptOut: boolean; promocionaisNaSemana: number }`
  - `type ConsentDecision = { permitido: true } | { permitido: false; motivo: MotivoBloqueio }`
  - `type MotivoBloqueio = "sem-consentimento" | "opt-out" | "anti-fadiga"`
  - `const PROMOCIONAIS_MAX_POR_SEMANA = 1`
  - `function avaliarConsentimento(event: CustomerMessageEventKey, snapshot: ConsentSnapshot): ConsentDecision`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/domains/notifications/customer-messages/customer-message-consent.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-consent.test.ts
```

Esperado: FAIL — `Failed to resolve import "./customer-message-consent"`.

- [ ] **Step 3: Implementar**

Criar `src/domains/notifications/customer-messages/customer-message-consent.ts`:

```ts
import { getCatalogEntry } from "./customer-message-catalog";
import type { CustomerMessageEventKey } from "./types";

/**
 * Teto de mensagens promocionais por cliente por semana. Heurística de proteção
 * contra fadiga, não limite documentado por ninguém — ajustável.
 */
export const PROMOCIONAIS_MAX_POR_SEMANA = 1;

export type MotivoBloqueio = "sem-consentimento" | "opt-out" | "anti-fadiga";

export type ConsentSnapshot = {
  consentGiven: boolean;
  marketingOptOut: boolean;
  /** Promocionais entregues a este cliente nos últimos 7 dias. */
  promocionaisNaSemana: number;
};

export type ConsentDecision =
  | { permitido: true }
  | { permitido: false; motivo: MotivoBloqueio };

/**
 * Decide se um evento pode ser enviado a um cliente, com base na natureza declarada
 * no catálogo.
 *
 * Transacional é comunicação sobre um horário que o cliente marcou: envia sempre,
 * não depende de consentimento e opt-out não bloqueia. Promocional é o oposto.
 *
 * Derivar a decisão da natureza do catálogo — em vez de uma lista de eventos aqui —
 * é o que torna impossível esquecer a regra ao acrescentar um evento novo.
 */
export function avaliarConsentimento(
  event: CustomerMessageEventKey,
  snapshot: ConsentSnapshot,
): ConsentDecision {
  if (getCatalogEntry(event).nature === "transactional") {
    return { permitido: true };
  }

  if (!snapshot.consentGiven) {
    return { permitido: false, motivo: "sem-consentimento" };
  }

  // Antes da anti-fadiga de propósito: "ele pediu para sair" é um motivo acionável
  // para o tenant ler na prévia da campanha, "atingiu o limite da semana" não é.
  if (snapshot.marketingOptOut) {
    return { permitido: false, motivo: "opt-out" };
  }

  if (snapshot.promocionaisNaSemana >= PROMOCIONAIS_MAX_POR_SEMANA) {
    return { permitido: false, motivo: "anti-fadiga" };
  }

  return { permitido: true };
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-consent.test.ts
```

Esperado: PASS, 8 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/customer-messages/customer-message-consent.ts src/domains/notifications/customer-messages/customer-message-consent.test.ts
git commit -m "feat(notifications): guarda de consentimento por natureza do evento"
```

---

## Task 3: Repositório da guarda

Lê o cliente e conta os promocionais recentes. Separado da Task 2 para que a regra continue testável sem banco.

**Files:**
- Create: `src/domains/notifications/customer-messages/customer-message-consent.repository.ts`
- Test: `src/domains/notifications/customer-messages/customer-message-consent.repository.test.ts`

**Interfaces:**
- Consumes: `ConsentSnapshot` da Task 2; `prisma` de `@/shared/database/prisma`.
- Produces: `customerMessageConsentRepository.carregarSnapshot(tenantId: string, customerId: string): Promise<ConsentSnapshot | null>` — `null` quando o cliente não existe naquele tenant.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { customerMessageConsentRepository } from "./customer-message-consent.repository";
import { PROMOCIONAIS_EVENT_TEMPLATES } from "./customer-message-consent.repository";

const prismaMock = prisma as unknown as {
  customer: { findFirst: ReturnType<typeof vi.fn> };
  notificationLog: { count: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  prismaMock.customer = { findFirst: vi.fn() };
  prismaMock.notificationLog = { count: vi.fn() };
});

describe("customerMessageConsentRepository.carregarSnapshot", () => {
  it("devolve null quando o cliente não existe no tenant", async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);

    const snapshot = await customerMessageConsentRepository.carregarSnapshot("t1", "c1");

    expect(snapshot).toBeNull();
    expect(prismaMock.notificationLog.count).not.toHaveBeenCalled();
  });

  it("filtra o cliente por tenantId", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      consentGiven: true,
      marketingOptOut: false,
    });
    prismaMock.notificationLog.count.mockResolvedValue(0);

    await customerMessageConsentRepository.carregarSnapshot("t1", "c1");

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1", tenantId: "t1" } }),
    );
  });

  it("conta apenas templates promocionais dos últimos 7 dias", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      consentGiven: true,
      marketingOptOut: false,
    });
    prismaMock.notificationLog.count.mockResolvedValue(2);

    const snapshot = await customerMessageConsentRepository.carregarSnapshot("t1", "c1");

    expect(snapshot).toEqual({
      consentGiven: true,
      marketingOptOut: false,
      promocionaisNaSemana: 2,
    });

    const where = prismaMock.notificationLog.count.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
    expect(where.customerId).toBe("c1");
    expect(where.template).toEqual({ in: PROMOCIONAIS_EVENT_TEMPLATES });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("a lista de templates promocionais vem do catálogo, não é hardcoded", () => {
    // Se alguém acrescentar um evento promocional ao catálogo, ele entra aqui
    // sozinho. Uma lista fixa sairia de sincronia em silêncio.
    expect(PROMOCIONAIS_EVENT_TEMPLATES).toContain("birthday");
    expect(PROMOCIONAIS_EVENT_TEMPLATES).not.toContain("appointment-reminder");
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-consent.repository.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
import { prisma } from "@/shared/database/prisma";

import {
  CUSTOMER_MESSAGE_CATALOG,
  CUSTOMER_MESSAGE_TEMPLATE_KEY,
} from "./customer-message-catalog";
import type { ConsentSnapshot } from "./customer-message-consent";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Chaves de template dos eventos promocionais, derivadas do catálogo. Uma lista
 * fixa aqui sairia de sincronia em silêncio quando alguém acrescentasse um evento.
 */
export const PROMOCIONAIS_EVENT_TEMPLATES: string[] = CUSTOMER_MESSAGE_CATALOG
  .filter((entrada) => entrada.nature === "promotional")
  .map((entrada) => CUSTOMER_MESSAGE_TEMPLATE_KEY[entrada.event]);

export class CustomerMessageConsentRepository {
  /**
   * Carrega o que a guarda precisa para decidir. Devolve `null` quando o cliente
   * não existe naquele tenant — nunca busca sem `tenantId`.
   */
  async carregarSnapshot(tenantId: string, customerId: string): Promise<ConsentSnapshot | null> {
    const cliente = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { consentGiven: true, marketingOptOut: true },
    });

    if (!cliente) return null;

    const promocionaisNaSemana = await prisma.notificationLog.count({
      where: {
        tenantId,
        customerId,
        template: { in: PROMOCIONAIS_EVENT_TEMPLATES },
        createdAt: { gte: new Date(Date.now() - SETE_DIAS_MS) },
      },
    });

    return {
      consentGiven: cliente.consentGiven,
      marketingOptOut: cliente.marketingOptOut,
      promocionaisNaSemana,
    };
  }
}

export const customerMessageConsentRepository = new CustomerMessageConsentRepository();
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-consent.repository.test.ts
```

Esperado: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/customer-messages/customer-message-consent.repository.ts src/domains/notifications/customer-messages/customer-message-consent.repository.test.ts
git commit -m "feat(notifications): repositorio da guarda de consentimento"
```

---

## Task 4: Plugar a guarda no dispatcher

**Files:**
- Modify: `src/domains/notifications/customer-messages/customer-message-dispatcher.service.ts`
- Modify: `src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts`

**Interfaces:**
- Consumes: `avaliarConsentimento` (Task 2), `customerMessageConsentRepository.carregarSnapshot` (Task 3).
- Produces: `CustomerMessageDispatchResult.skipReason` passa a aceitar também `"sem-consentimento" | "opt-out" | "anti-fadiga"`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao arquivo de teste existente, dentro do `describe("customerMessageDispatcher")`:

```ts
  describe("guarda de consentimento", () => {
    it("bloqueia promocional sem consentimento e não chama o transporte", async () => {
      ligadoPara("birthday");
      snapshot.mockResolvedValue({
        consentGiven: false,
        marketingOptOut: false,
        promocionaisNaSemana: 0,
      });

      const resultado = await customerMessageDispatcher.dispatch({
        tenantId: "t1",
        event: "birthday",
        customerId: "c1",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(resultado.skipReason).toBe("sem-consentimento");
      expect(resultado.dispatched).toEqual([]);
      expect(logAndDispatch).not.toHaveBeenCalled();
    });

    it("envia transacional mesmo com opt-out ativo", async () => {
      ligadoPara("appointment_reminder");
      snapshot.mockResolvedValue({
        consentGiven: false,
        marketingOptOut: true,
        promocionaisNaSemana: 99,
      });

      const resultado = await customerMessageDispatcher.dispatch({
        tenantId: "t1",
        event: "appointment_reminder",
        customerId: "c1",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(resultado.dispatched).toEqual(["WHATSAPP"]);
      expect(logAndDispatch).toHaveBeenCalledTimes(1);
    });

    it("não consulta a guarda quando o envio é `direct`", async () => {
      // Mensagem agendada um-a-um (ADR-019): quem escreveu o texto e marcou a hora
      // já decidiu enviar, e é individual, não disparo em massa.
      const resultado = await customerMessageDispatcher.dispatch({
        kind: "direct",
        tenantId: "t1",
        customerId: "c1",
        channels: ["WHATSAPP"],
        message: "Oi!",
        templateKey: "scheduled-message",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(resultado.dispatched).toEqual(["WHATSAPP"]);
      expect(snapshot).not.toHaveBeenCalled();
    });

    it("envia promocional quando o cliente não pôde ser carregado", async () => {
      // Falha de leitura não pode virar silêncio. O evento já passou pelo
      // liga/desliga do tenant; bloquear aqui perderia a mensagem sem rastro.
      snapshot.mockResolvedValue(null);
      ligadoPara("birthday");

      const resultado = await customerMessageDispatcher.dispatch({
        tenantId: "t1",
        event: "birthday",
        customerId: "c1",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(resultado.dispatched).toEqual(["WHATSAPP"]);
    });

    it("não consulta a guarda quando não há customerId", async () => {
      ligadoPara("appointment_created");

      await customerMessageDispatcher.dispatch({
        tenantId: "t1",
        event: "appointment_created",
        recipient: { phone: "11999990000" },
        payload: {},
      });

      expect(snapshot).not.toHaveBeenCalled();
    });
  });
```

E, no topo do arquivo, junto dos mocks existentes:

```ts
vi.mock("./customer-message-consent.repository", () => ({
  customerMessageConsentRepository: { carregarSnapshot: vi.fn() },
}));
```

Junto das demais constantes de topo:

```ts
import { customerMessageConsentRepository } from "./customer-message-consent.repository";

const snapshot = vi.mocked(customerMessageConsentRepository).carregarSnapshot;

/** Igual ao helper `ligado()`, mas com o evento certo — a guarda lê a natureza dele. */
function ligadoPara(event: string, channels: ("WHATSAPP" | "EMAIL")[] = ["WHATSAPP"]) {
  settings.shouldNotify.mockResolvedValue(true);
  settings.resolve.mockResolvedValue({
    event,
    label: "",
    description: "",
    nature: "transactional",
    enabled: true,
    channels,
    isCustom: false,
  });
}
```

E, no `beforeEach` existente, acrescentar o padrão permissivo:

```ts
    snapshot.mockResolvedValue({
      consentGiven: true,
      marketingOptOut: false,
      promocionaisNaSemana: 0,
    });
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts
```

Esperado: FAIL nos testes novos — `skipReason` volta `null` em vez de `"sem-consentimento"`, e `logAndDispatch` é chamado quando não deveria.

- [ ] **Step 3: Implementar**

Em `customer-message-dispatcher.service.ts`, ampliar o tipo do resultado:

```ts
export type CustomerMessageDispatchResult = {
  dispatched: CustomerMessageChannel[];
  skipReason:
    | "desligado"
    | "sem-destinatario"
    | "sem-consentimento"
    | "opt-out"
    | "anti-fadiga"
    | null;
  logs: CustomerMessageDispatchLog[];
};
```

E, dentro de `dispatch()`, no bloco `else` (o do `kind: "catalog"`), logo depois de resolver `channels` e antes de `template = ...`:

```ts
      // Guarda de consentimento. Só no caminho do catálogo: `kind: "direct"` é
      // mensagem individual escrita e agendada por uma pessoa, que já decidiu enviar.
      // Sem `customerId` não há a quem consultar — casos legados de envio avulso.
      if (input.customerId) {
        try {
          const snapshot = await customerMessageConsentRepository.carregarSnapshot(
            input.tenantId,
            input.customerId,
          );

          // Cliente não encontrado não vira bloqueio: o evento já passou pelo
          // liga/desliga do tenant, e engolir a mensagem aqui a faria sumir sem
          // rastro — o mesmo tipo de bug histórico do reagendamento.
          if (snapshot) {
            const decisao = avaliarConsentimento(input.event, snapshot);
            if (!decisao.permitido) {
              return { dispatched: [], skipReason: decisao.motivo, logs: [] };
            }
          }
        } catch (err) {
          console.error(
            "[customer-messages] Falha ao avaliar consentimento",
            input.event,
            err instanceof Error ? err.message : err,
          );
        }
      }
```

Com os imports no topo:

```ts
import { avaliarConsentimento } from "./customer-message-consent";
import { customerMessageConsentRepository } from "./customer-message-consent.repository";
```

- [ ] **Step 4: Rodar toda a suíte do dispatcher**

```bash
npx vitest run src/domains/notifications/customer-messages/
```

Esperado: PASS, incluindo os testes que já existiam. Nenhum pode regredir.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/customer-messages/customer-message-dispatcher.service.ts src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts
git commit -m "feat(notifications): dispatcher vira guardiao unico do consentimento"
```

---

## Task 5: Remover os filtros duplicados e a mensagem fantasma

Fecha os achados §2.3 e §2.4. Com a guarda centralizada, os filtros espalhados viram código morto — e um deles bloqueia mensagem transacional indevidamente.

**Files:**
- Modify: `src/shared/queue/jobs/birthday-reminder.ts`
- Modify: `src/app/api/notifications/bulk-reminder/route.ts`
- Test: `src/shared/queue/jobs/birthday-reminder.test.ts`

**Interfaces:**
- Consumes: a guarda plugada na Task 4.
- Produces: nada novo.

> **Mudança de comportamento visível, intencional:** o `bulk-reminder` filtra hoje por `consentGiven` para enviar `appointment_reminder`, que é **transacional**. Clientes sem consentimento de marketing nunca receberam lembrete do próprio horário. Depois desta task, passam a receber. Isso é a correção, não um efeito colateral — mas precisa estar na mensagem de commit e no PR.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/shared/queue/jobs/birthday-reminder.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { handleBirthdayReminder } from "./birthday-reminder";

const dispatch = vi.fn();

vi.mock("@/domains/notifications/customer-messages/customer-message-dispatcher.service", () => ({
  customerMessageDispatcher: { dispatch: (...args: unknown[]) => dispatch(...args) },
}));

const prismaMock = prisma as unknown as { $queryRaw: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$queryRaw = vi.fn().mockResolvedValue([
    {
      id: "c1",
      tenantId: "t1",
      name: "Maria",
      phone: "11999990000",
      birthdayMessage: "Texto legado que não deve mais vencer o template",
    },
  ]);
});

describe("handleBirthdayReminder", () => {
  it("usa o template do catálogo, ignorando o birthdayMessage legado", async () => {
    // O campo saiu da UI mas continuava com efeito: quem salvou um texto antes da
    // limpeza tinha esse texto vencendo o catálogo, sem nenhuma tela onde editar.
    await handleBirthdayReminder([]);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).not.toHaveProperty("message");
  });

  it("não filtra consentimento no SQL — quem decide é a guarda do dispatcher", async () => {
    await handleBirthdayReminder([]);

    const sql = prismaMock.$queryRaw.mock.calls[0][0].join("");
    expect(sql).not.toContain("consentGiven");
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/shared/queue/jobs/birthday-reminder.test.ts
```

Esperado: FAIL — o dispatch recebe `message`, e o SQL contém `consentGiven`.

- [ ] **Step 3: Corrigir o job de aniversário**

Em `src/shared/queue/jobs/birthday-reminder.ts`, remover `c."consentGiven" = true` do `WHERE`, remover `t."birthdayMessage"` do `SELECT` e do tipo do `$queryRaw`, e remover a linha `message:` do `dispatch`:

```ts
  const customers = await prisma.$queryRaw<
    { id: string; tenantId: string; name: string; phone: string }[]
  >`
    SELECT c.id, c."tenantId", c.name, c.phone
    FROM "Customer" c
    INNER JOIN "Tenant" t ON t.id = c."tenantId"
    WHERE c."birthDate" IS NOT NULL
      AND EXTRACT(MONTH FROM c."birthDate") = ${month}
      AND EXTRACT(DAY FROM c."birthDate") = ${day}
      AND c.phone IS NOT NULL
      AND t."birthdayEnabled" = true
      AND t."evolutionConnected" = true
  `
```

E o dispatch, sem `message`:

```ts
    await customerMessageDispatcher.dispatch({
      tenantId: customer.tenantId,
      event: "birthday",
      customerId: customer.id,
      recipient: { phone: customer.phone, email: null },
      payload: { customerName: customer.name },
    });
```

> `consentGiven` sai do SQL porque a guarda do dispatcher já bloqueia promocional sem consentimento — e agora também aplica opt-out e anti-fadiga, que o SQL nunca checou.

- [ ] **Step 4: Corrigir o bulk-reminder**

Em `src/app/api/notifications/bulk-reminder/route.ts`, trocar o filtro:

```ts
    // Só telefone: `appointment_reminder` é transacional, e consentimento de
    // marketing não pode bloquear aviso sobre um horário que o cliente marcou.
    // Quem decide o envio é a guarda do dispatcher.
    const eligible = appointments.filter((a) => a.customer.phone);
```

E remover `consentGiven: true` do `select` do `customer`.

- [ ] **Step 5: Rodar os testes**

```bash
npx vitest run src/shared/queue/jobs/birthday-reminder.test.ts
npx vitest run src/domains/notifications/
```

Esperado: PASS em ambos.

- [ ] **Step 6: Commit**

```bash
git add src/shared/queue/jobs/birthday-reminder.ts src/shared/queue/jobs/birthday-reminder.test.ts src/app/api/notifications/bulk-reminder/route.ts
git commit -m "fix(notifications): centraliza consentimento e remove birthdayMessage fantasma

O filtro de consentGiven sai do SQL do aniversario e do JS do bulk-reminder:
quem decide agora e a guarda do dispatcher, que tambem aplica opt-out e
anti-fadiga (que nenhum dos dois checava).

MUDANCA DE COMPORTAMENTO: o bulk-reminder filtrava consentGiven para enviar
appointment_reminder, que e transacional. Cliente sem consentimento de
marketing nunca recebia lembrete do proprio horario. Passa a receber."
```

---

## Task 6: Reconhecimento de palavra de descadastro

Função pura, testável sem webhook.

**Files:**
- Create: `src/domains/notifications/opt-out/opt-out-keywords.ts`
- Test: `src/domains/notifications/opt-out/opt-out-keywords.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `function ehPedidoDeDescadastro(texto: string): boolean`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { ehPedidoDeDescadastro } from "./opt-out-keywords";

describe("ehPedidoDeDescadastro", () => {
  it.each(["PARE", "parar", "Sair", "descadastrar", "CANCELAR INSCRICAO"])(
    "reconhece %s",
    (texto) => {
      expect(ehPedidoDeDescadastro(texto)).toBe(true);
    },
  );

  it("ignora acento e espaço em volta", () => {
    expect(ehPedidoDeDescadastro("  Cancelar Inscrição  ")).toBe(true);
  });

  it("não reconhece a palavra dentro de uma frase", () => {
    // "Pode parar de mandar às 7h?" é conversa, não descadastro. Marcar opt-out
    // por conta disso silenciaria o canal do tenant sem o cliente ter pedido.
    expect(ehPedidoDeDescadastro("pode parar de mandar às 7h?")).toBe(false);
  });

  it("não reconhece texto vazio", () => {
    expect(ehPedidoDeDescadastro("   ")).toBe(false);
  });

  it("não confunde com o 2 da confirmação por resposta", () => {
    expect(ehPedidoDeDescadastro("2")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/opt-out/opt-out-keywords.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
/**
 * Palavras que significam "não quero mais receber". Casam apenas com a mensagem
 * inteira, nunca dentro de uma frase: "pode parar de mandar às 7h?" é conversa,
 * e marcar opt-out por causa dela silenciaria o canal sem o cliente ter pedido.
 */
const PALAVRAS_DE_DESCADASTRO = new Set([
  "pare",
  "parar",
  "sair",
  "descadastrar",
  "cancelar inscricao",
]);

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function ehPedidoDeDescadastro(texto: string): boolean {
  return PALAVRAS_DE_DESCADASTRO.has(normalizar(texto));
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/opt-out/opt-out-keywords.test.ts
```

Esperado: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/opt-out/
git commit -m "feat(notifications): reconhecimento de palavra de descadastro"
```

---

## Task 7: Service de opt-out

**Files:**
- Create: `src/domains/crm/opt-out.service.ts`
- Test: `src/domains/crm/opt-out.service.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `optOutService.marcarPorTelefone(tenantId: string, telefone: string, origem: OptOutOrigem): Promise<{ marcados: number }>` e `type OptOutOrigem = "whatsapp_reply" | "portal" | "panel"`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { optOutService } from "./opt-out.service";

const prismaMock = prisma as unknown as {
  customer: { updateMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  prismaMock.customer = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
});

describe("optOutService.marcarPorTelefone", () => {
  it("marca o opt-out com data e origem", async () => {
    await optOutService.marcarPorTelefone("t1", "11999990000", "whatsapp_reply");

    const data = prismaMock.customer.updateMany.mock.calls[0][0].data;
    expect(data.marketingOptOut).toBe(true);
    expect(data.marketingOptOutOrigin).toBe("whatsapp_reply");
    expect(data.marketingOptOutAt).toBeInstanceOf(Date);
  });

  it("filtra sempre por tenantId", async () => {
    await optOutService.marcarPorTelefone("t1", "11999990000", "whatsapp_reply");

    const where = prismaMock.customer.updateMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
  });

  it("casa o telefone com e sem o DDI 55", async () => {
    // O import de contatos grava sem DDI, mas o WhatsApp entrega o remoteJid com.
    // Sem as duas variantes, o descadastro simplesmente não acha a pessoa.
    await optOutService.marcarPorTelefone("t1", "5511999990000", "whatsapp_reply");

    const where = prismaMock.customer.updateMany.mock.calls[0][0].where;
    expect(where.phone.in).toEqual(
      expect.arrayContaining(["5511999990000", "11999990000"]),
    );
  });

  it("devolve a contagem de clientes marcados", async () => {
    prismaMock.customer.updateMany.mockResolvedValue({ count: 2 });

    const resultado = await optOutService.marcarPorTelefone("t1", "11999990000", "portal");

    expect(resultado).toEqual({ marcados: 2 });
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/crm/opt-out.service.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
import { prisma } from "@/shared/database/prisma";

export type OptOutOrigem = "whatsapp_reply" | "portal" | "panel";

/**
 * Gera as variantes com e sem DDI 55. O import de contatos grava o telefone sem
 * o prefixo, mas o WhatsApp entrega o `remoteJid` com ele — sem as duas variantes,
 * o descadastro não encontra a pessoa.
 */
function variantesDeTelefone(telefone: string): string[] {
  const digitos = telefone.replace(/\D/g, "");
  const variantes = new Set([digitos]);

  if (digitos.startsWith("55") && digitos.length > 12) {
    variantes.add(digitos.slice(2));
  } else {
    variantes.add(`55${digitos}`);
  }

  return [...variantes];
}

export class OptOutService {
  /**
   * Marca o descadastro de marketing de todos os clientes daquele tenant com o
   * telefone informado. `updateMany` porque a mesma pessoa pode ter mais de um
   * cadastro no tenant — marcar todos é o comportamento correto: ela pediu para sair.
   */
  async marcarPorTelefone(
    tenantId: string,
    telefone: string,
    origem: OptOutOrigem,
  ): Promise<{ marcados: number }> {
    const { count } = await prisma.customer.updateMany({
      where: { tenantId, phone: { in: variantesDeTelefone(telefone) } },
      data: {
        marketingOptOut: true,
        marketingOptOutAt: new Date(),
        marketingOptOutOrigin: origem,
      },
    });

    return { marcados: count };
  }
}

export const optOutService = new OptOutService();
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/domains/crm/opt-out.service.test.ts
```

Esperado: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domains/crm/opt-out.service.ts src/domains/crm/opt-out.service.test.ts
git commit -m "feat(crm): service de opt-out de marketing com trilha de origem"
```

---

## Task 8: Reordenar o webhook e plugar o opt-out

O achado mais grave da auditoria (§2.1). O opt-out passa a rodar **antes** do gate de `autoReplyEnabled` e **antes** do throttle de intervalo.

**Files:**
- Modify: `src/app/api/webhooks/evolution/messages/route.ts`
- Test: `src/app/api/webhooks/evolution/messages/route.test.ts`

**Interfaces:**
- Consumes: `ehPedidoDeDescadastro` (Task 6), `optOutService.marcarPorTelefone` (Task 7).
- Produces: nada consumido por outra task desta etapa. A Etapa 2 insere a confirmação por resposta entre o opt-out e o chatbot.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/app/api/webhooks/evolution/messages/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { POST } from "./route";

const marcarPorTelefone = vi.fn().mockResolvedValue({ marcados: 1 });
const sendRawText = vi.fn().mockResolvedValue(undefined);

vi.mock("@/domains/crm/opt-out.service", () => ({
  optOutService: { marcarPorTelefone: (...a: unknown[]) => marcarPorTelefone(...a) },
}));

vi.mock("@/domains/notifications/providers/evolution.provider", () => ({
  evolutionProvider: { sendRawText: (...a: unknown[]) => sendRawText(...a) },
}));

vi.mock("@/shared/auth/evolution-webhook-token", () => ({
  isValidEvolutionWebhookToken: () => true,
}));

const prismaMock = prisma as unknown as {
  tenant: { findFirst: ReturnType<typeof vi.fn> };
  whatsAppAutoReplyLog: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function requisicao(texto: string) {
  return new Request("https://app.test/api/webhooks/evolution/messages?token=x", {
    method: "POST",
    body: JSON.stringify({
      event: "messages.upsert",
      instance: "inst-1",
      data: {
        key: { remoteJid: "5511999990000@s.whatsapp.net", fromMe: false, id: "m1" },
        message: { conversation: texto },
      },
    }),
  });
}

function tenant(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    slug: "salao",
    timezone: "America/Sao_Paulo",
    businessHours: null,
    autoReplyEnabled: true,
    autoReplyIntervalHours: 6,
    autoReplyMessage: null,
    offHoursEnabled: false,
    offHoursMessage: null,
    evolutionInstanceId: "inst-1",
    autoReplyCancelMessage: null,
    autoReplyPriceIntro: null,
    autoReplyHoursIntro: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.tenant = { findFirst: vi.fn().mockResolvedValue(tenant()) };
  prismaMock.whatsAppAutoReplyLog = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  };
});

describe("webhook do Evolution — opt-out", () => {
  it("processa PARE mesmo com autoReplyEnabled desligado", async () => {
    // REGRESSÃO: o gate de autoReplyEnabled ficava antes de tudo, então tenant
    // com auto-resposta desligada nunca processava descadastro. Falha de LGPD.
    prismaMock.tenant.findFirst.mockResolvedValue(tenant({ autoReplyEnabled: false }));

    await POST(requisicao("PARE"));

    expect(marcarPorTelefone).toHaveBeenCalledWith("t1", "5511999990000", "whatsapp_reply");
  });

  it("processa PARE mesmo dentro da janela de anti-flood", async () => {
    // REGRESSÃO: o throttle de autoReplyIntervalHours rodava antes da
    // classificação. Quem respondeu algo há 2 h tinha o descadastro engolido.
    prismaMock.whatsAppAutoReplyLog.findFirst.mockResolvedValue({ id: "log-recente" });

    await POST(requisicao("PARE"));

    expect(marcarPorTelefone).toHaveBeenCalledTimes(1);
  });

  it("confirma o descadastro ao cliente", async () => {
    await POST(requisicao("PARE"));

    expect(sendRawText).toHaveBeenCalledTimes(1);
    expect(sendRawText.mock.calls[0][2]).toMatch(/não receberá|nao recebera/i);
  });

  it("não deixa o opt-out cair no chatbot depois", async () => {
    await POST(requisicao("PARE"));

    // Uma resposta só: a confirmação do descadastro. Nunca também a de agendar.
    expect(sendRawText).toHaveBeenCalledTimes(1);
    expect(prismaMock.whatsAppAutoReplyLog.create).not.toHaveBeenCalled();
  });

  it("mensagem comum segue para o chatbot normalmente", async () => {
    await POST(requisicao("quero agendar"));

    expect(marcarPorTelefone).not.toHaveBeenCalled();
    expect(prismaMock.whatsAppAutoReplyLog.create).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/app/api/webhooks/evolution/messages/route.test.ts
```

Esperado: FAIL nos quatro primeiros testes — `marcarPorTelefone` nunca é chamado.

- [ ] **Step 3: Reordenar o handler**

Em `src/app/api/webhooks/evolution/messages/route.ts`, mover a checagem de `autoReplyEnabled` para **depois** do bloco de opt-out.

Substituir:

```ts
  if (!tenant || !tenant.autoReplyEnabled) return new Response(null, { status: 200 })

  const phone = event.data.key.remoteJid.replace('@s.whatsapp.net', '')
  const instanceName = tenant.evolutionInstanceId!
```

por:

```ts
  if (!tenant) return new Response(null, { status: 200 })

  const phone = event.data.key.remoteJid.replace('@s.whatsapp.net', '')
  const instanceName = tenant.evolutionInstanceId!

  // ── 1. Opt-out ───────────────────────────────────────────────────────────
  // Roda antes do gate de `autoReplyEnabled` e antes do throttle de anti-flood,
  // de propósito: descadastro não pode ser engolido por uma janela desenhada
  // para outra finalidade, nem depender de o tenant ter chatbot ligado.
  // A confirmação enviada aqui também não conta para o throttle do passo 3.
  if (ehPedidoDeDescadastro(text)) {
    await optOutService.marcarPorTelefone(tenant.id, phone, 'whatsapp_reply')
    await evolutionProvider
      .sendRawText(instanceName, phone, OPT_OUT_CONFIRMACAO)
      .catch(() => {})
    return new Response(null, { status: 200 })
  }

  // ── 2. Confirmação por resposta (1/2) ────────────────────────────────────
  // Entra aqui na Etapa 2, entre o opt-out e o chatbot.

  // ── 3. Auto-resposta / chatbot ───────────────────────────────────────────
  if (!tenant.autoReplyEnabled) return new Response(null, { status: 200 })
```

Acrescentar aos imports do topo:

```ts
import { ehPedidoDeDescadastro } from '@/domains/notifications/opt-out/opt-out-keywords'
import { optOutService } from '@/domains/crm/opt-out.service'
```

E a constante, logo abaixo dos imports:

```ts
const OPT_OUT_CONFIRMACAO =
  'Pronto! Você não receberá mais nossas promoções. ' +
  'Avisos sobre os seus horários agendados continuam chegando normalmente.'
```

> A segunda frase é importante: sem ela, o cliente acredita ter desligado também os lembretes do próprio horário e reclama quando eles continuam chegando.

- [ ] **Step 4: Rodar para ver passar**

```bash
npx vitest run src/app/api/webhooks/evolution/messages/route.test.ts
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/evolution/messages/route.ts src/app/api/webhooks/evolution/messages/route.test.ts
git commit -m "fix(notifications): opt-out roda antes do gate e do throttle no webhook

O gate de autoReplyEnabled ficava antes de tudo, entao tenant com
auto-resposta desligada nunca processaria PARE. E o throttle de
autoReplyIntervalHours rodava antes da classificacao, engolindo o
descadastro de quem tivesse respondido algo nas horas anteriores.

Nova ordem: opt-out -> (confirmacao 1/2, Etapa 2) -> chatbot."
```

---

## Task 9: Textos do webhook para a arquitetura de duas camadas

Fecha o achado §2.2 e o requisito de remover todo hardcode.

**Files:**
- Create: `src/domains/notifications/auto-reply/auto-reply-catalog.ts`
- Create: `src/domains/notifications/auto-reply/auto-reply-messages.ts`
- Test: `src/domains/notifications/auto-reply/auto-reply-messages.test.ts`
- Modify: `src/app/api/webhooks/evolution/messages/route.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `AUTO_REPLY_DEFAULTS: { book: string; cancel: string; priceIntro: string; priceEmpty: string; hoursIntro: string; hoursEmpty: string }`
  - `type AutoReplyOverrides = { autoReplyMessage: string | null; autoReplyCancelMessage: string | null; autoReplyPriceIntro: string | null; autoReplyHoursIntro: string | null }`
  - `function montarRespostaBook(o: AutoReplyOverrides, bookingLink: string): string`
  - `function montarRespostaCancel(o: AutoReplyOverrides, bookingLink: string): string`
  - `function montarRespostaPrecos(o: AutoReplyOverrides, servicos: ServicoResumo[]): string`
  - `function montarRespostaHorarios(o: AutoReplyOverrides, businessHours: Record<string, { open: string; close: string; enabled: boolean }> | null): string`
  - `type ServicoResumo = { name: string; price: unknown; priceType: string }`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, it, expect } from "vitest";
import {
  AUTO_REPLY_DEFAULTS,
  montarRespostaBook,
  montarRespostaCancel,
  montarRespostaPrecos,
  montarRespostaHorarios,
} from "./auto-reply-messages";

const semPersonalizacao = {
  autoReplyMessage: null,
  autoReplyCancelMessage: null,
  autoReplyPriceIntro: null,
  autoReplyHoursIntro: null,
};

describe("respostas automáticas — duas camadas", () => {
  it("usa o padrão do catálogo quando não há personalização", () => {
    const texto = montarRespostaCancel(semPersonalizacao, "https://app.test/agendar/salao");
    expect(texto).toContain(AUTO_REPLY_DEFAULTS.cancel.split("{{link_agendamento}}")[0].trim());
  });

  it("usa o texto do tenant quando existe", () => {
    const texto = montarRespostaCancel(
      { ...semPersonalizacao, autoReplyCancelMessage: "Ligue pra gente: {{link_agendamento}}" },
      "https://app.test/agendar/salao",
    );
    expect(texto).toBe("Ligue pra gente: https://app.test/agendar/salao");
  });

  it("string vazia conta como ausência de personalização", () => {
    // '' é falsy e já causou bug neste projeto: um switch mandava string vazia
    // e o gateway caía no template, enviando mesmo desligado.
    const texto = montarRespostaCancel(
      { ...semPersonalizacao, autoReplyCancelMessage: "   " },
      "https://app.test/agendar/salao",
    );
    expect(texto).toContain("https://app.test/agendar/salao");
  });

  it("interpola o link no texto de agendar", () => {
    const texto = montarRespostaBook(semPersonalizacao, "https://app.test/agendar/salao");
    expect(texto).toContain("https://app.test/agendar/salao");
    expect(texto).not.toContain("{{");
  });

  it("monta a lista de preços sob a moldura do tenant", () => {
    const texto = montarRespostaPrecos(
      { ...semPersonalizacao, autoReplyPriceIntro: "Olha nossos preços:" },
      [
        { name: "Escova", price: 80, priceType: "FIXED" },
        { name: "Coloração", price: null, priceType: "ON_CONSULTATION" },
      ],
    );
    expect(texto).toContain("Olha nossos preços:");
    expect(texto).toContain("• Escova: R$ 80,00");
    expect(texto).toContain("• Coloração: Sob consulta");
  });

  it("usa o texto de lista vazia quando não há serviço", () => {
    const texto = montarRespostaPrecos(semPersonalizacao, []);
    expect(texto).toBe(AUTO_REPLY_DEFAULTS.priceEmpty);
  });

  it("monta o horário só com os dias habilitados", () => {
    const texto = montarRespostaHorarios(semPersonalizacao, {
      mon: { open: "09:00", close: "18:00", enabled: true },
      sun: { open: "09:00", close: "18:00", enabled: false },
    });
    expect(texto).toContain("Seg: 09:00–18:00");
    expect(texto).not.toContain("Dom");
  });

  it("usa o texto de vazio quando não há horário configurado", () => {
    expect(montarRespostaHorarios(semPersonalizacao, null)).toBe(AUTO_REPLY_DEFAULTS.hoursEmpty);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/domains/notifications/auto-reply/auto-reply-messages.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Criar o catálogo**

`src/domains/notifications/auto-reply/auto-reply-catalog.ts`:

```ts
/**
 * Textos padrão do sistema para as respostas automáticas do webhook.
 *
 * Mesma arquitetura de duas camadas do catálogo de mensagens ao cliente: isto é o
 * padrão, o `Tenant` guarda só a personalização, e ausência de registro significa
 * "usa o padrão", nunca "sem mensagem". Melhorar estes textos depois não exige
 * migration nem backfill.
 */
export const AUTO_REPLY_DEFAULTS = {
  book: "Olá! Para agendar seu horário, acesse: {{link_agendamento}}",
  cancel:
    "Para cancelar ou remarcar seu agendamento, acesse: {{link_agendamento}} " +
    "ou fale com a gente por aqui.",
  priceIntro: "Nossos serviços:",
  priceEmpty: "Entre em contato para conhecer nossos serviços.",
  hoursIntro: "Nosso horário de funcionamento:",
  hoursEmpty: "Entre em contato para saber nosso horário de funcionamento.",
} as const;

export const DIAS_ABREVIADOS: Record<string, string> = {
  sun: "Dom",
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
};
```

- [ ] **Step 4: Criar o montador**

`src/domains/notifications/auto-reply/auto-reply-messages.ts`:

```ts
import { AUTO_REPLY_DEFAULTS, DIAS_ABREVIADOS } from "./auto-reply-catalog";

export { AUTO_REPLY_DEFAULTS };

export type AutoReplyOverrides = {
  autoReplyMessage: string | null;
  autoReplyCancelMessage: string | null;
  autoReplyPriceIntro: string | null;
  autoReplyHoursIntro: string | null;
};

export type ServicoResumo = { name: string; price: unknown; priceType: string };

type BusinessHours = Record<string, { open: string; close: string; enabled: boolean }>;

/**
 * Texto personalizado do tenant, ou o padrão. Só em branco conta como ausência:
 * `''` é falsy e já causou bug neste projeto — um switch mandava string vazia e o
 * gateway caía no template, enviando mesmo desligado.
 */
function ouPadrao(personalizado: string | null, padrao: string): string {
  const limpo = personalizado?.trim();
  return limpo ? limpo : padrao;
}

function comLink(texto: string, bookingLink: string): string {
  // Aceita as duas grafias: `{{link_agendamento}}` é o padrão novo, `{booking_link}`
  // é o que os tenants que já personalizaram têm gravado.
  return texto
    .replaceAll("{{link_agendamento}}", bookingLink)
    .replaceAll("{booking_link}", bookingLink);
}

export function montarRespostaBook(o: AutoReplyOverrides, bookingLink: string): string {
  return comLink(ouPadrao(o.autoReplyMessage, AUTO_REPLY_DEFAULTS.book), bookingLink);
}

export function montarRespostaCancel(o: AutoReplyOverrides, bookingLink: string): string {
  return comLink(ouPadrao(o.autoReplyCancelMessage, AUTO_REPLY_DEFAULTS.cancel), bookingLink);
}

export function montarRespostaPrecos(o: AutoReplyOverrides, servicos: ServicoResumo[]): string {
  if (servicos.length === 0) return AUTO_REPLY_DEFAULTS.priceEmpty;

  const linhas = servicos.map((s) =>
    s.priceType === "ON_CONSULTATION"
      ? `• ${s.name}: Sob consulta`
      : `• ${s.name}: R$ ${Number(s.price).toFixed(2).replace(".", ",")}`,
  );

  return `${ouPadrao(o.autoReplyPriceIntro, AUTO_REPLY_DEFAULTS.priceIntro)}\n${linhas.join("\n")}`;
}

export function montarRespostaHorarios(
  o: AutoReplyOverrides,
  businessHours: BusinessHours | null,
): string {
  if (!businessHours) return AUTO_REPLY_DEFAULTS.hoursEmpty;

  const linhas = Object.entries(businessHours)
    .filter(([, v]) => v.enabled)
    .map(([k, v]) => `${DIAS_ABREVIADOS[k] ?? k}: ${v.open}–${v.close}`);

  if (linhas.length === 0) return AUTO_REPLY_DEFAULTS.hoursEmpty;

  return `${ouPadrao(o.autoReplyHoursIntro, AUTO_REPLY_DEFAULTS.hoursIntro)}\n${linhas.join("\n")}`;
}
```

- [ ] **Step 5: Rodar para ver passar**

```bash
npx vitest run src/domains/notifications/auto-reply/auto-reply-messages.test.ts
```

Esperado: PASS, 8 testes.

- [ ] **Step 6: Trocar os textos fixos no webhook**

Em `src/app/api/webhooks/evolution/messages/route.ts`, acrescentar os três campos novos ao `select` do `prisma.tenant.findFirst`:

```ts
      autoReplyCancelMessage: true,
      autoReplyPriceIntro: true,
      autoReplyHoursIntro: true,
```

E substituir os quatro blocos de texto fixo (`intent === 'BOOK' || 'FALLBACK'`, `'CANCEL'`, `'PRICE'`, `'HOURS'`) por:

```ts
  if (intent === 'BOOK' || intent === 'FALLBACK') {
    response = montarRespostaBook(tenant, bookingLink)
  }

  if (intent === 'CANCEL') {
    response = montarRespostaCancel(tenant, bookingLink)
  }

  if (intent === 'PRICE') {
    const svcs = await prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { name: true, price: true, priceType: true },
      orderBy: { name: 'asc' },
      take: 10,
    })
    response = montarRespostaPrecos(tenant, svcs)
  }

  if (intent === 'HOURS') {
    response = montarRespostaHorarios(tenant, businessHours)
  }
```

Com o import:

```ts
import {
  montarRespostaBook,
  montarRespostaCancel,
  montarRespostaPrecos,
  montarRespostaHorarios,
} from '@/domains/notifications/auto-reply/auto-reply-messages'
```

E remover o `dayNames` local, que agora vive em `DIAS_ABREVIADOS`.

- [ ] **Step 7: Rodar a suíte do webhook**

```bash
npx vitest run src/app/api/webhooks/evolution/messages/route.test.ts
npx vitest run src/domains/notifications/
```

Esperado: PASS em ambos — os testes da Task 8 não podem regredir.

- [ ] **Step 8: Commit**

```bash
git add src/domains/notifications/auto-reply/ src/app/api/webhooks/evolution/messages/route.ts
git commit -m "refactor(notifications): tira os 4 textos fixos do webhook para o catalogo"
```

---

## Task 10: `maxDuration` no tick

**Files:**
- Modify: `src/app/api/cron/tick/route.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Declarar o teto**

No topo de `src/app/api/cron/tick/route.ts`, logo abaixo dos imports:

```ts
/**
 * Teto explícito de duração. O tick já roda doze jobs do pg-boss mais a varredura
 * de mensagens agendadas; a Etapa 3 acrescenta o lote de campanha, que envia com
 * jitter e por isso leva ~70 s. Sem teto declarado, o limite implícito da
 * plataforma derruba a função no meio e mata os jobs que ainda não rodaram.
 */
export const maxDuration = 300;
```

- [ ] **Step 2: Conferir que compila**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/tick/route.ts
git commit -m "fix(cron): declara maxDuration explicito no tick"
```

---

## Task 11: Consentimento no formulário de cliente do painel

Primeiro dos três pontos de coleta da §3.3. É o mais importante: no salão, a pessoa está ali na cadeira.

**Files:**
- Modify: `src/components/domain/crm/customer-form.tsx`
- Modify: `src/domains/crm/schemas.ts`
- Test: `src/components/domain/crm/customer-form.test.tsx`

**Interfaces:**
- Consumes: os campos da Task 1.
- Produces: `consentGiven` e `marketingOptOut` passam a trafegar no formulário de cliente do painel.

> **Antes de escrever:** ler `src/components/domain/crm/customer-form.tsx` e `src/domains/crm/schemas.ts` inteiros. O formulário já existe e tem seções; a chave entra na seção de contato, não numa seção nova. Seguir o `Switch` do Shadcn já usado no projeto, com alvo de toque de 44 px.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerForm } from "./customer-form";

describe("CustomerForm — consentimento", () => {
  it("mostra a chave de consentimento de marketing", () => {
    render(<CustomerForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/receber promoções e novidades/i)).toBeInTheDocument();
  });

  it("nasce desmarcada num cliente novo", () => {
    render(<CustomerForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/receber promoções e novidades/i)).not.toBeChecked();
  });

  it("envia consentGiven quando marcada", async () => {
    const onSubmit = vi.fn();
    render(<CustomerForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/nome/i), "Maria Silva");
    await userEvent.click(screen.getByLabelText(/receber promoções e novidades/i));
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ consentGiven: true }),
    );
  });

  it("mostra o pedido de descadastro quando o cliente já pediu para sair", () => {
    // Quando marketingOptOut está ativo, o profissional precisa ver que foi o
    // cliente que pediu — e não simplesmente religar por cima sem saber.
    render(
      <CustomerForm
        onSubmit={vi.fn()}
        defaultValues={{ name: "Maria", consentGiven: true, marketingOptOut: true }}
      />,
    );
    expect(screen.getByText(/pediu para não receber/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/components/domain/crm/customer-form.test.tsx
```

Esperado: FAIL — o label não existe.

- [ ] **Step 3: Estender o schema Zod**

Em `src/domains/crm/schemas.ts`, no schema de cliente, acrescentar:

```ts
  consentGiven: z.boolean().optional(),
```

> `marketingOptOut` **não** entra no schema de escrita do painel: o descadastro é um pedido do cliente, e o profissional não deve conseguir desfazê-lo por um formulário. Ele é exibido como informação, não como campo editável.

- [ ] **Step 4: Adicionar a chave ao formulário**

Na seção de contato do `customer-form.tsx`, depois do campo de telefone:

```tsx
<div className="flex items-start justify-between gap-3 rounded-lg border p-3">
  <div className="space-y-0.5">
    <Label htmlFor="consent-given" className="text-sm font-medium">
      Receber promoções e novidades
    </Label>
    <p className="text-xs text-muted-foreground">
      Avisos sobre horários agendados são enviados de qualquer forma.
    </p>
    {defaultValues?.marketingOptOut && (
      <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
        Este cliente pediu para não receber promoções.
      </p>
    )}
  </div>
  <Switch
    id="consent-given"
    className="mt-0.5"
    checked={form.watch("consentGiven") ?? false}
    onCheckedChange={(v) => form.setValue("consentGiven", v)}
    disabled={defaultValues?.marketingOptOut}
  />
</div>
```

> A chave fica **desabilitada** quando há opt-out: o cliente pediu para sair, e religar por um formulário do painel desfaria o pedido dele sem que ele soubesse. Reverter exige o cliente refazer pelo Portal ou pelo WhatsApp.

- [ ] **Step 5: Rodar para ver passar**

```bash
npx vitest run src/components/domain/crm/customer-form.test.tsx
```

Esperado: PASS, 4 testes.

- [ ] **Step 6: Verificar no mobile**

Conferir a 375 px que a linha não estoura e que a chave tem alvo de toque de pelo menos 44 px. Ajustar `gap`/`flex-wrap` se necessário.

- [ ] **Step 7: Commit**

```bash
git add src/components/domain/crm/customer-form.tsx src/components/domain/crm/customer-form.test.tsx src/domains/crm/schemas.ts
git commit -m "feat(crm): chave de consentimento de marketing no cadastro de cliente"
```

---

## Task 12: Consentimento na vitrine pública

Substitui o `consentGiven: true` fixo (§3.1) por um checkbox visível e pré-marcado (§3.2, decisão do usuário).

**Files:**
- Modify: `src/app/api/public/[slug]/customers/route.ts`
- Modify: o formulário de cadastro da vitrine (localizar com `grep -rn "CreateCustomerSchema" src/components src/app --include=*.tsx`)
- Modify: `src/domains/crm/schemas.ts`
- Test: `src/app/api/public/[slug]/customers/route.test.ts`

**Interfaces:**
- Consumes: `CreateCustomerSchema`.
- Produces: `consentGiven` passa a vir do corpo da requisição pública.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { CreateCustomerSchema } from "@/domains/crm/schemas";

describe("CreateCustomerSchema — consentimento na vitrine", () => {
  it("aceita consentGiven do corpo", () => {
    const r = CreateCustomerSchema.safeParse({
      name: "Maria Silva",
      phone: "11999990000",
      cpf: "11144477735",
      birthDate: "1990-01-01",
      consentGiven: false,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.consentGiven).toBe(false);
  });

  it("assume true quando o campo não vem", () => {
    // Compatibilidade: clientes antigos do formulário não mandam o campo, e a
    // caixa é pré-marcada por decisão de produto.
    const r = CreateCustomerSchema.safeParse({
      name: "Maria Silva",
      phone: "11999990000",
      cpf: "11144477735",
      birthDate: "1990-01-01",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.consentGiven).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run src/app/api/public/[slug]/customers/route.test.ts
```

Esperado: FAIL — `consentGiven` não existe no schema.

- [ ] **Step 3: Estender o schema**

Em `src/domains/crm/schemas.ts`, no `CreateCustomerSchema`:

```ts
  /**
   * Caixa pré-marcada na vitrine (decisão de produto registrada na §3.2 da spec).
   * `default(true)` mantém compatível o cliente antigo do formulário, que não
   * manda o campo.
   */
  consentGiven: z.boolean().default(true),
```

- [ ] **Step 4: Usar o valor na rota**

Em `src/app/api/public/[slug]/customers/route.ts`, no `updateData`:

```ts
      consentGiven: parsed.data.consentGiven,
      consentDate: parsed.data.consentGiven ? new Date() : null,
      consentOrigin: 'public_booking',
```

- [ ] **Step 5: Adicionar o checkbox ao formulário da vitrine**

Localizar o formulário e acrescentar, antes do botão de envio:

```tsx
<label className="flex min-h-11 items-start gap-2.5 text-sm">
  <Checkbox
    checked={aceitaPromocoes}
    onCheckedChange={(v) => setAceitaPromocoes(v === true)}
    className="mt-0.5"
  />
  <span className="text-muted-foreground">
    Quero receber promoções e novidades no WhatsApp. Avisos sobre os meus
    horários chegam de qualquer forma.
  </span>
</label>
```

Com `const [aceitaPromocoes, setAceitaPromocoes] = useState(true)` e o valor incluído no corpo do envio.

- [ ] **Step 6: Rodar para ver passar**

```bash
npx vitest run src/app/api/public/[slug]/customers/route.test.ts
npx vitest run src/domains/crm/
```

Esperado: PASS em ambos.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/public/[slug]/customers/route.ts src/domains/crm/schemas.ts src/app/api/public/[slug]/customers/route.test.ts
git add -u
git commit -m "feat(vitrine): checkbox de consentimento substitui o consentGiven fixo

A rota gravava consentGiven: true, consentDate e consentOrigin sem nunca
perguntar nada ao cliente — um registro de consentimento que nao existiu.
Passa a gravar o que ele escolheu. Caixa pre-marcada por decisao de produto
(ressalva de LGPD registrada na secao 3.2 da spec)."
```

---

## Task 13: Consentimento no Portal do cliente

Terceiro ponto de coleta. É onde o cliente **administra**, não só assina.

**Files:**
- Modify: `src/app/api/public/[slug]/me/route.ts`
- Modify: o bloco "Meus Dados" do Portal (localizar com `grep -rn "Meus Dados" src/components src/app --include=*.tsx`)
- Test: `src/app/api/public/[slug]/me/route.test.ts`

**Interfaces:**
- Consumes: `optOutService.marcarPorTelefone` (Task 7) — desligar pelo portal é opt-out com origem `portal`.
- Produces: `GET /api/public/[slug]/me` passa a devolver `aceitaPromocoes: boolean`; `PATCH` passa a aceitar `aceitaPromocoes`.

> ### ⚠️ Risco de deploy que muda o runbook
>
> Esta task acrescenta `marketingOptOut` ao `select` do **`GET /me` do portal**. Se o
> código subir antes da migration, o Prisma lança **P2022 (coluna inexistente)** e a
> tela de perfil do portal quebra para todo cliente de todo tenant.
>
> Este projeto já sofreu logout global por exatamente isso, duas vezes.
>
> **Por isso a migration da Task 1 é aplicada em produção ANTES do merge desta PR**, não
> depois. Migration puramente aditiva é segura de aplicar com o código antigo rodando — ele
> simplesmente ignora as colunas novas. O inverso não é seguro. O Step 3 da Task 14 depende
> desta ordem.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/app/api/public/[slug]/me/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/shared/database/prisma";
import { PATCH } from "./route";

const marcarPorTelefone = vi.fn().mockResolvedValue({ marcados: 1 });

vi.mock("@/domains/crm/opt-out.service", () => ({
  optOutService: { marcarPorTelefone: (...a: unknown[]) => marcarPorTelefone(...a) },
}));

vi.mock("@/shared/auth/public-session", () => ({
  COOKIE_NAME: "sessao",
  verifyPublicSession: () => ({ tenantId: "t1", customerId: "c1" }),
}));

vi.mock("@/domains/scheduling/public-booking.repository", () => ({
  publicBookingRepository: { findTenantBySlug: async () => ({ id: "t1" }) },
}));

const prismaMock = prisma as unknown as {
  customer: { update: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
};

function requisicao(body: Record<string, unknown>) {
  return new Request("https://app.test/api/public/salao/me", {
    method: "PATCH",
    headers: { cookie: "sessao=x" },
    body: JSON.stringify(body),
  });
}

const contexto = { params: Promise.resolve({ slug: "salao" }) };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.customer = {
    update: vi.fn().mockResolvedValue({ id: "c1", name: "Maria", phone: null, email: null }),
    findFirst: vi.fn().mockResolvedValue({ phone: "11999990000" }),
  };
});

describe("PATCH /me — preferência de marketing", () => {
  it("aceita uma requisição que só muda a preferência", async () => {
    // O `.refine` original exigia phone ou email. Sem ampliá-lo, mexer só na
    // chave devolveria 422.
    const res = await PATCH(requisicao({ aceitaPromocoes: false }), contexto);
    expect(res.status).toBe(200);
  });

  it("ligar grava consentimento e limpa o opt-out", async () => {
    await PATCH(requisicao({ aceitaPromocoes: true }), contexto);

    const data = prismaMock.customer.update.mock.calls[0][0].data;
    expect(data.consentGiven).toBe(true);
    expect(data.marketingOptOut).toBe(false);
    expect(data.marketingOptOutAt).toBeNull();
  });

  it("desligar registra opt-out com origem portal", async () => {
    // A origem é a trilha que mostra que foi o próprio cliente que pediu.
    await PATCH(requisicao({ aceitaPromocoes: false }), contexto);

    const data = prismaMock.customer.update.mock.calls[0][0].data;
    expect(data.marketingOptOut).toBe(true);
    expect(data.marketingOptOutOrigin).toBe("portal");
    expect(data.marketingOptOutAt).toBeInstanceOf(Date);
  });

  it("filtra o update pelo tenant da sessão, nunca do corpo", async () => {
    await PATCH(requisicao({ aceitaPromocoes: true, tenantId: "OUTRO" }), contexto);

    const where = prismaMock.customer.update.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
  });

  it("continua aceitando telefone e e-mail como antes", async () => {
    const res = await PATCH(requisicao({ phone: "11988887777" }), contexto);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npx vitest run "src/app/api/public/[slug]/me/route.test.ts"
```

Esperado: FAIL — o primeiro teste devolve 422, porque o `.refine` exige `phone` ou `email`.

- [ ] **Step 3: Estender o schema e o PATCH**

Em `src/app/api/public/[slug]/me/route.ts`, trocar o `UpdateMeSchema`:

```ts
const UpdateMeSchema = z
  .object({
    phone: z.string().min(10).max(20).optional(),
    email: z.string().email().max(100).optional(),
    aceitaPromocoes: z.boolean().optional(),
  })
  // Checagem explícita por `undefined`: com `??`, um `aceitaPromocoes: false`
  // seria falsy e a requisição legítima de DESLIGAR a preferência cairia em 422.
  .refine(
    (d) =>
      d.phone !== undefined || d.email !== undefined || d.aceitaPromocoes !== undefined,
    { message: 'Pelo menos um campo.' },
  )
```

E, no corpo do `PATCH`, montar o `data` traduzindo a preferência:

```ts
    const { aceitaPromocoes, ...contato } = parsed.data

    const data = {
      ...contato,
      ...(aceitaPromocoes === undefined
        ? {}
        : aceitaPromocoes
          ? {
              consentGiven: true,
              marketingOptOut: false,
              marketingOptOutAt: null,
              marketingOptOutOrigin: null,
            }
          : {
              marketingOptOut: true,
              marketingOptOutAt: new Date(),
              marketingOptOutOrigin: 'portal',
            }),
    }

    const updated = await prisma.customer.update({
      where: { id: session.customerId, tenantId: tenant.id },
      data,
      select: { id: true, name: true, phone: true, email: true },
    })
```

> Desligar **não** zera `consentGiven`. São coisas diferentes: o consentimento de cadastro
> continua registrado, e o opt-out é o pedido posterior de não receber. Zerar os dois
> apagaria a trilha de que houve consentimento antes.

- [ ] **Step 4: Expor a preferência no GET**

No `select` do `prisma.customer.findFirst` do `GET`, acrescentar:

```ts
        consentGiven: true,
        marketingOptOut: true,
```

E no corpo da resposta:

```ts
      // Uma chave só para o cliente: ele não precisa entender a diferença entre
      // consentimento de cadastro e opt-out posterior.
      aceitaPromocoes: customer.consentGiven && !customer.marketingOptOut,
```

- [ ] **Step 5: Rodar para ver passar**

```bash
npx vitest run "src/app/api/public/[slug]/me/route.test.ts"
```

Esperado: PASS, 5 testes.

- [ ] **Step 6: Adicionar a chave ao componente**

A chave no Portal, dentro do bloco Meus Dados:

```tsx
<div className="flex items-start justify-between gap-3 rounded-xl border p-4">
  <div className="space-y-0.5">
    <p className="text-sm font-medium">Receber promoções e novidades</p>
    <p className="text-xs text-muted-foreground">
      Avisos sobre os seus horários chegam de qualquer forma.
    </p>
  </div>
  <Switch
    checked={aceitaPromocoes}
    onCheckedChange={salvarPreferencia}
    disabled={salvando}
    className="mt-0.5"
  />
</div>
```

- [ ] **Step 7: Rodar os testes**

```bash
npx vitest run src/app/api/public/
```

Esperado: PASS.

- [ ] **Step 8: Verificar no mobile**

375 px: a linha não estoura, a chave tem 44 px de alvo, o texto não fica órfão numa linha só.

- [ ] **Step 9: Commit**

```bash
git add "src/app/api/public/[slug]/me/route.ts" "src/app/api/public/[slug]/me/route.test.ts"
git add -u
git commit -m "feat(portal): cliente administra a propria preferencia de marketing"
```

---

## Task 14: Gate final e PR

**Files:** nenhum novo.

- [ ] **Step 1: Rodar o gate completo**

```bash
npx tsc --noEmit
npx vitest run
```

Esperado: zero erros de tipo e toda a suíte passando. **Nenhum teste pré-existente pode ter regredido** — se algum quebrou, é regressão desta etapa, não teste "flaky".

- [ ] **Step 2: Conferir a migration uma última vez**

```bash
grep -iE "drop|truncate" prisma/migrations/20260802120000_motor_mensagens_fundacao/migration.sql
```

Esperado: nenhuma linha. Se houver, **pare** — aplicar isso em produção destruiria dado.

- [ ] **Step 3: Aplicar a migration em produção — ANTES do merge**

A migration é puramente aditiva, então aplicá-la com o código antigo rodando é seguro: ele
ignora as colunas novas. O inverso **não** é seguro — o `GET /me` do portal passa a
selecionar `marketingOptOut` (Task 13), e sem a coluna o Prisma lança P2022 e quebra a tela
de perfil para todo cliente de todo tenant.

Este projeto já sofreu logout global por essa exata inversão, duas vezes.

```bash
npx prisma migrate deploy
npx prisma migrate status
```

Porta **5432** do Supabase — a 6543 trava em DDL. Esperado: `Database schema is up to date!`

> Este passo depende de credenciais de produção e **deve ser executado pelo usuário**, não
> pelo agente. Pedir a confirmação de que rodou antes de seguir para o Step 4.

- [ ] **Step 4: Abrir a PR**

```bash
git push -u origin feat/motor-mensagens-consolidacao-fases-3-5
gh pr create --base main --title "feat(notifications): fundacao do motor de mensagens (etapa 1 de 3)" --body "$(cat <<'CORPO'
Etapa 1 de 3 do pacote de consolidação + Fases 3 e 5.
Spec: `docs/superpowers/specs/2026-08-02-motor-mensagens-consolidacao-fases-3-5-design.md`

## Bugs corrigidos

- **Opt-out nunca funcionaria.** O gate de `autoReplyEnabled` ficava antes de tudo no
  webhook, e o throttle de anti-flood rodava antes da classificação. Tenant com chatbot
  desligado, ou cliente que tivesse respondido algo nas horas anteriores, teria o pedido
  de descadastro engolido em silêncio.
- **Mensagem fantasma de aniversário.** `Tenant.birthdayMessage` saiu da UI mas continuava
  vencendo o template do catálogo — quem salvou um texto antes da limpeza estava preso a
  ele, sem nenhuma tela onde editar.
- **Consentimento espalhado em três lugares**, nenhum deles no dispatcher, que se declara
  o único caminho de envio.
- **Registro de consentimento inexistente.** A vitrine gravava `consentGiven: true`,
  `consentDate` e `consentOrigin` sem nunca perguntar nada ao cliente.
- **4 textos ainda hardcoded** no webhook.

## Mudança de comportamento

O `bulk-reminder` filtrava `consentGiven` para enviar `appointment_reminder`, que é
**transacional**. Clientes sem consentimento de marketing nunca receberam lembrete do
próprio horário. **Passam a receber.** Isso é a correção, não efeito colateral.

## Aplicar em produção — ANTES do merge

⚠️ **A migration vai antes do merge, não depois.** O `GET /me` do portal passa a selecionar
`marketingOptOut`; sem a coluna, o Prisma lança P2022 e a tela de perfil quebra para todo
cliente de todo tenant. Migration aditiva com código antigo rodando é segura; o inverso não é.

```
npx prisma migrate deploy    # porta 5432 do Supabase — a 6543 trava em DDL
npx prisma migrate status
```

**Sem backfill.** `marketingOptOut` nasce `false` para todos, que é o comportamento correto,
e todas as camadas novas tratam ausência de registro como "usa o padrão".

## Ressalvas registradas, não resolvidas

Decisões de produto do usuário, documentadas na §3.2 da spec: o motor confia no
`consentGiven` atual, o histórico de consentimento não é tocado, e a caixa da vitrine é
pré-marcada — o que não é manifestação afirmativa pela LGPD.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
CORPO
)"
```

- [ ] **Step 4: Confirmar que a PR foi criada**

```bash
gh pr view --json number,title,state
```

> `gh pr merge` já "falhou" neste projeto tendo mergeado de verdade. Sempre confirmar o estado real com `gh pr view` antes de concluir que algo deu errado.

---

## Autorrevisão do plano

**Cobertura da spec (Etapa 1):**

| Seção da spec | Task |
|---|---|
| §4.1 dispatcher como guardião único | 2, 3, 4 |
| §4.2 opt-out com trilha própria | 1, 7 |
| §4.3 webhook reordenado | 8 |
| §4.4 textos fixos do webhook | 9 |
| §4.5 `birthdayMessage` perde precedência | 5 |
| §4.6 três pontos de coleta de consentimento | 11, 12, 13 |
| §4.7 índices do `NotificationLog` | 1 |
| §4.8 `maxDuration` no tick | 10 |
| §11.2 migration única | 1 |
| §2.4 filtros duplicados removidos | 5 |

Sem lacuna. Os campos das Etapas 2 e 3 entram na migration da Task 1 sem uso, por decisão explícita da §11.2.

**Testes obrigatórios da §10 cobertos nesta etapa:** `PARE` com `autoReplyEnabled` desligado (Task 8), `PARE` dentro da janela de throttle (Task 8), transacional com opt-out ativo (Task 4), promocional sem consentimento (Task 4), `kind: "direct"` não bloqueado (Task 4), aniversário ignorando `birthdayMessage` (Task 5). Os três restantes pertencem às Etapas 2 e 3.

**Varredura de placeholder:** nenhum "TBD", nenhum "similar à Task N", nenhum passo de código sem bloco de código. A Task 13 tinha um teste esqueleto na primeira versão deste plano; foi reescrita com o código real depois da leitura de `src/app/api/public/[slug]/me/route.ts`.

**Consistência de tipos:** `ConsentSnapshot` (Task 2) é o que `carregarSnapshot` devolve (Task 3) e o que `avaliarConsentimento` consome (Task 4). `MotivoBloqueio` (Task 2) alimenta os valores novos de `skipReason` (Task 4). `AutoReplyOverrides` (Task 9) tem exatamente os quatro campos que a Task 1 cria no `Tenant` mais o `autoReplyMessage` que já existia. `OptOutOrigem` (Task 7) cobre as três origens usadas: `whatsapp_reply` (Task 8), `portal` (Task 13) e `panel` (reservada).

**Dois achados que só apareceram ao escrever o plano**, ambos incorporados:

1. **O `.refine` do `UpdateMeSchema` do portal** usa `d.phone ?? d.email`. Acrescentar um booleano sem ampliar a checagem faria `aceitaPromocoes: false` — a requisição legítima de *desligar* — cair em 422, porque `false` é falsy. A Task 13 troca por checagem explícita de `undefined` e tem um teste dedicado.
2. **A ordem migration × merge está invertida em relação ao hábito do projeto.** Como o `GET /me` do portal passa a ler uma coluna nova, a migration precisa ir **antes** do merge. Isso está na Task 13, no Step 3 da Task 14 e no corpo da PR.
