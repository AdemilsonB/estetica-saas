# Mensagem agendada um-a-um — Plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` para executar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para rastreio.

**Objetivo:** o profissional escolhe uma cliente, escreve (ou parte de) uma mensagem, define data e hora, e o sistema entrega no momento marcado — pelo cron que já existe.

**Arquitetura:** model novo `ScheduledMessage` (uma mensagem, uma cliente, uma data/hora) — **não** `Campaign`, que pertence à Fase 3 e não existe. O `scheduledAt` é gravado em UTC, convertido a partir de data+hora locais **no service**, usando o fuso do tenant. A varredura roda dentro de `/api/cron/tick` (a cada ~10 min), reivindica cada linha com um update atômico condicionado ao status (idempotência) e delega o envio a `customerMessageDispatcherService.dispatch()` num modo novo `kind: "direct"` — texto livre, canal explícito, sem passar pelo liga/desliga por evento. Quando a Fase 3 chegar, as campanhas reusam essa mesma máquina de claim + entrega.

**Stack:** Next.js 15 App Router · Prisma · PostgreSQL (Supabase) · Zod · TanStack Query · Shadcn UI · Vitest.

## Constraints globais

Valem para **todas** as tarefas, sem repetição em cada uma:

- **Português do Brasil em tudo:** código, comentários, nomes de variável, mensagens de commit, textos de UI, mensagens de erro.
- `tenantId` **sempre** da sessão (`getSessionContext`), **nunca** do body ou da URL.
- Todo método de repository filtra `tenantId`. **Única exceção autorizada:** os métodos de varredura do cron (`findDue`, `claim`, `expireStuck`), que são cross-tenant por natureza — cada um leva um comentário explicando por quê, e nenhum deles é alcançável a partir de uma rota HTTP.
- Camadas: API Route fina → Service (regras) → Repository (dados) → Prisma. Sem query direta ao Prisma em rota.
- Erros de domínio tipados de `src/shared/errors/`. Nunca `throw new Error('string')`.
- TypeScript strict. **Sem `any`, sem `as unknown as`** em código de produção (nos testes, o cast da sessão segue o padrão já usado em `settings/route.test.ts`).
- Canal da v1: **somente `WHATSAPP`**. O campo `channel` existe no model para o e-mail plugar depois sem migration, mas nenhuma rota aceita outro valor.
- Permissão: `clientes:view` para ler, `clientes:edit` para criar/editar/cancelar — via `ensurePermission(session, 'clientes', 'view' | 'edit')`. A permissão `mensagens` da §10 da spec fica para a Fase 3.
- Todo `DialogContent` novo: `max-h-[85vh]` + `overflow-y-auto`. Alvos de toque ≥ 44×44. Loading, erro e vazio explícitos.
- **Nunca** abrir Dialog dentro de Dialog nesta entrega. Confirmação de cancelamento é inline, no próprio item da lista (evita a armadilha do `AlertDialog` do Radix, que não aceita `modal={false}`).
- **Não** mexer em quota de WhatsApp. O incremento/decremento já acontece dentro de `whatsapp.gateway.ts`, que o dispatcher usa. Adicionar um `decrement` aqui devolveria cota duas vezes.
- Antes de cada commit: `npx tsc --noEmit` (zero erros) e `npx vitest run <arquivos tocados>` (verde).

### Falhas de teste pré-existentes

Estas 4 já falhavam antes desta entrega e **não** são regressão: `scheduling.service.update.test.ts`, `appointment-reminder.test.ts`, `customer-history-client.test.tsx` (×2). Não tente consertá-las; se aparecerem, ignore.

### Banco: o `DIRECT_URL` aponta para PRODUÇÃO

Em 2026-07-31 foi criado um `.env.local` (fora do git) com `DIRECT_URL` apontando para o
pooler do Supabase na porta **5432** (modo *session*, o único que suporta DDL). Antes disso
a variável não existia e o CLI caía num túnel local morto (`P1001`).

**Consequência que você precisa levar a sério:** todo comando do Prisma CLI nesta máquina
fala com **o banco de produção**.

- ❌ **NUNCA** rode `prisma migrate dev`, `prisma migrate reset` ou `prisma db push`. O
  primeiro pode reescrever o histórico de migrations e os outros dois destroem dados. Não
  existe banco local para absorver o erro.
- ✅ `prisma migrate status`, `prisma migrate diff`, `prisma validate` e `prisma generate`
  são seguros: leem, não escrevem.
- A migration desta entrega é **escrita à mão** (mesmo estilo das Fases 1 e 2) e depois
  **conferida** contra o schema real com `migrate diff`. `prisma migrate deploy` só na
  janela de produção, depois do merge.

**Estado verificado em 2026-07-31:** `prisma migrate status` limpo — 62 migrations locais,
62 aplicadas, incluindo `20260727120000_add_customer_message_setting` (Fase 2). O aviso de
"pendente de aplicação manual" no `CLAUDE.md` e no handoff está **desatualizado**; corrigir
isso faz parte da Task 12.

### Drift pré-existente que você vai ver e deve ignorar

Qualquer `migrate diff` contra produção devolve esta linha, que **não** tem relação com esta
entrega:

```sql
ALTER INDEX "UserNotificationPreference_tenantId_userId_eventType_channel_ke" RENAME TO "UserNotificationPreference_tenantId_userId_eventType_channe_key";
```

É uma diferença de truncamento de nome de índice herdada da migration de notificações da
equipe. **Não a inclua na migration nova** e não tente consertá-la aqui — é escopo de outra
PR. Ela serve de linha de base: o diff da nossa migration é tudo o que aparecer **além**
dela.

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `prisma/migrations/20260731120000_add_scheduled_message/migration.sql` | Enum + tabela + índices + FKs |
| `src/domains/notifications/scheduled-messages/types.ts` | Tipos do domínio e a chave de log `scheduled-message` |
| `src/domains/notifications/scheduled-messages/scheduled-message.schemas.ts` | Zod de criar/editar/prévia |
| `src/domains/notifications/scheduled-messages/scheduled-message.repository.ts` | Acesso a dados, incluindo o claim atômico |
| `src/domains/notifications/scheduled-messages/scheduled-message.service.ts` | Regras: fuso, passado, edição só antes do envio, motor de entrega |
| `src/domains/notifications/customer-messages/customer-message-delivery.ts` | `whatsAppBlockedReason()` extraído da rota de prévia |
| `src/app/api/notifications/scheduled-messages/route.ts` | `GET` (lista por cliente) e `POST` (criar) |
| `src/app/api/notifications/scheduled-messages/[id]/route.ts` | `PATCH` (editar) e `DELETE` (cancelar) |
| `src/app/api/notifications/scheduled-messages/preview/route.ts` | `POST` — texto interpolado + motivo de bloqueio |
| `src/app/api/notifications/scheduled-messages/options/route.ts` | `GET` — templates do catálogo e variáveis disponíveis |
| `src/hooks/notifications/use-scheduled-messages.ts` | TanStack Query: listar, criar, editar, cancelar, opções, prévia |
| `src/components/domain/notifications/scheduled-messages-dialog.tsx` | Dialog único: lista + formulário |

**Modificar:**

| Arquivo | O quê |
|---|---|
| `prisma/schema.prisma` | Enum `ScheduledMessageStatus`, model `ScheduledMessage`, back-relations em `Tenant`, `Customer`, `User` |
| `src/shared/errors/domain-error.ts` | 3 erros tipados novos |
| `src/domains/notifications/customer-messages/customer-message-dispatcher.service.ts` | Modo `kind: "direct"` e `logs` no resultado |
| `src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts` | Ajustar as asserções `toEqual` do resultado inteiro |
| `src/app/api/notifications/customer-messages/preview/route.ts` | Passa a importar `whatsAppBlockedReason` em vez de ter cópia local |
| `src/app/api/cron/tick/route.ts` | Chama a varredura de mensagens agendadas |
| `src/components/domain/crm/customer-profile-header.tsx` | Botão de lembrete à direita do nome |
| `src/app/(app)/clientes/[id]/page.tsx` | Estado do dialog e ligação com o header |
| `docs/superpowers/specs/2026-07-26-motor-mensagens-cliente-design.md` | §8 e §14 reescritas |
| `docs/decisions.md` | ADR-019 |
| `src/domains/notifications/DOMAIN.md` | Seção da máquina de agendamento |
| `docs/handoff-motor-mensagens-fases-2-5.md` | Estado das fases |
| `CLAUDE.md` | Linha do domínio Notifications |

---

## Task 0: Branch

O `main` local está atrás do remoto (a PR #315 já entrou). Ramifique do remoto, não do local.

- [ ] **Passo 1: Criar a branch a partir de `origin/main`**

```bash
git fetch origin
git checkout -b feat/mensagem-agendada-um-a-um origin/main
git branch --show-current
```

Esperado: `feat/mensagem-agendada-um-a-um`.

- [ ] **Passo 2: Regenerar o Prisma Client**

Trocar de branch deixa `node_modules/@prisma/client` refletindo o schema de outro checkout,
o que produz erros de `tsc` que parecem bug real.

Rode: `npx prisma generate`

- [ ] **Passo 3: Confirmar que o CLI fala com produção — e lembrar do que isso proíbe**

Rode: `npx prisma migrate status`
Esperado: `Database schema is up to date!` com 62 migrations (63 depois da Task 1, e aí a
saída passa a acusar 1 pendente — o que é o correto até o deploy).

Se der `P1001`, o `.env.local` com `DIRECT_URL` sumiu; recrie antes de seguir.

Releia a seção "Banco: o `DIRECT_URL` aponta para PRODUÇÃO" nas Constraints globais.
`migrate dev`, `migrate reset` e `db push` estão **proibidos** nesta máquina.

- [ ] **Passo 4: Registrar a linha de base dos testes**

Rode: `npx vitest run 2>&1 | tail -30`

Anote quantos testes falham **antes** de qualquer mudança. Devem ser as 4 já conhecidas. Se
forem outras, é a linha de base que está diferente do esperado — reporte antes de seguir, em
vez de assumir que foram sempre assim.

- [ ] **Passo 5: Commitar o plano**

```bash
git add docs/superpowers/plans/2026-07-31-mensagem-agendada-um-a-um.md
git commit -m "docs: plano de mensagem agendada um-a-um"
```

---

## Task 1: Model e migration

**Arquivos:**
- Modificar: `prisma/schema.prisma`
- Criar: `prisma/migrations/20260731120000_add_scheduled_message/migration.sql`

**Interfaces:**
- Produz: enum `ScheduledMessageStatus` (`PENDING`/`SENDING`/`SENT`/`FAILED`/`CANCELLED`) e model `ScheduledMessage` no `@prisma/client`. Todas as tarefas seguintes dependem desses tipos gerados.

- [ ] **Passo 1: Adicionar o enum e o model ao schema**

No fim de `prisma/schema.prisma`, junto dos demais models de notificação (logo após `model CustomerMessageSetting`):

```prisma
/// Mensagem avulsa que o profissional agenda para uma cliente específica: um texto,
/// uma pessoa, uma data/hora. Não é campanha — quando a Fase 3 chegar, a campanha
/// reusa esta máquina de agendamento (claim atômico + entrega pelo tick), não o
/// contrário. `scheduledAt` é SEMPRE UTC; a conversão a partir da data/hora local
/// acontece no service, com o fuso do tenant.
model ScheduledMessage {
  id                String                 @id @default(cuid())
  tenantId          String
  customerId        String
  channel           NotificationChannel    @default(WHATSAPP)
  body              String                 @db.Text
  scheduledAt       DateTime
  status            ScheduledMessageStatus @default(PENDING)
  sentAt            DateTime?
  failureReason     String?
  notificationLogId String?
  createdByUserId   String
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer      Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  createdByUser User     @relation("ScheduledMessageCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict)

  @@index([tenantId])
  @@index([tenantId, customerId, scheduledAt])
  /// Índice da varredura do cron: sem tenantId de propósito, porque o tick processa
  /// todos os tenants numa passada só.
  @@index([status, scheduledAt])
  @@index([createdByUserId])
}

enum ScheduledMessageStatus {
  PENDING
  SENDING
  SENT
  FAILED
  CANCELLED
}
```

- [ ] **Passo 2: Adicionar as back-relations**

Em `model Tenant`, logo após a linha `customerMessageSettings     CustomerMessageSetting[]`:

```prisma
  scheduledMessages           ScheduledMessage[]
```

Em `model Customer`, logo após a linha `reviews            AppointmentReview[]`:

```prisma
  scheduledMessages  ScheduledMessage[]
```

Em `model User`, logo após a linha `notificationPreferences  UserNotificationPreference[]`:

```prisma
  scheduledMessages        ScheduledMessage[]           @relation("ScheduledMessageCreatedBy")
```

- [ ] **Passo 3: Validar o schema antes de escrever a migration**

Rode: `npx prisma validate`
Esperado: `The schema at prisma\schema.prisma is valid`

Se reclamar de relação faltando, é back-relation esquecida — o erro nomeia o model.

- [ ] **Passo 4: Escrever a migration à mão**

Crie `prisma/migrations/20260731120000_add_scheduled_message/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ScheduledMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "body" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "notificationLogId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledMessage_tenantId_idx" ON "ScheduledMessage"("tenantId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_tenantId_customerId_scheduledAt_idx" ON "ScheduledMessage"("tenantId", "customerId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledMessage_status_scheduledAt_idx" ON "ScheduledMessage"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledMessage_createdByUserId_idx" ON "ScheduledMessage"("createdByUserId");

-- AddForeignKey
ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Passo 5: Gerar o client e conferir que o tipo existe**

Rode: `npx prisma generate`
Depois: `node -e "const {ScheduledMessageStatus}=require('@prisma/client');console.log(Object.keys(ScheduledMessageStatus).join(','))"`
Esperado: `PENDING,SENDING,SENT,FAILED,CANCELLED`

- [ ] **Passo 6: Conferir a migration contra o schema REAL de produção**

Este é o passo que substitui "escrevi com cuidado" por prova. O comando é **somente
leitura**: compara o banco de produção com o datamodel e imprime o que falta.

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Esperado: **exatamente** o conteúdo da sua `migration.sql` (o `CREATE TYPE`, o
`CREATE TABLE`, os 4 índices e as 3 foreign keys), **mais** a linha de drift pré-existente
do `UserNotificationPreference` descrita nas Constraints globais.

Compare linha a linha. Divergências e o que fazer:

- **O diff traz algo que sua migration não tem** → sua migration está incompleta; o
  `migrate deploy` deixaria o banco fora de sincronia com o schema. Acrescente.
- **Sua migration tem algo que o diff não pede** → você escreveu SQL a mais. Remova.
- **Aparece qualquer coisa sobre outra tabela** que não seja o `ALTER INDEX` conhecido do
  `UserNotificationPreference` → **pare e reporte**. É drift novo em produção, não é desta
  entrega e não pode entrar nesta migration.

Copie a saída do comando para o corpo da PR: é a evidência de que a migration confere.

- [ ] **Passo 6b: Teste negativo — provar que o enum está mesmo na migration**

Rode: `grep -c "ScheduledMessageStatus" prisma/migrations/20260731120000_add_scheduled_message/migration.sql`
Esperado: `2` (o `CREATE TYPE` e a coluna `status`). Se der `0`, o client gerado localmente
funcionaria e só o `migrate deploy` em produção quebraria — o tipo de falha que só aparece
na pior hora possível.

- [ ] **Passo 7: tsc**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

- [ ] **Passo 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260731120000_add_scheduled_message
git commit -m "feat(notifications): model ScheduledMessage para mensagem agendada um-a-um"
```

---

## Task 2: Erros tipados

**Arquivos:**
- Modificar: `src/shared/errors/domain-error.ts`
- Criar: `src/shared/errors/scheduled-message-errors.test.ts`

**Interfaces:**
- Produz: `ScheduledMessageNotFoundError()`, `ScheduledMessageNotEditableError(status: string)`, `ScheduledMessageInPastError()` — consumidos pelo service da Task 5.

- [ ] **Passo 1: Escrever o teste que falha**

Crie `src/shared/errors/scheduled-message-errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import {
  DomainError,
  ScheduledMessageInPastError,
  ScheduledMessageNotEditableError,
  ScheduledMessageNotFoundError,
} from "./domain-error";

describe("erros de mensagem agendada", () => {
  it("ScheduledMessageNotFoundError é 404 com código próprio", () => {
    const erro = new ScheduledMessageNotFoundError();
    expect(erro).toBeInstanceOf(DomainError);
    expect(erro.statusCode).toBe(404);
    expect(erro.code).toBe("SCHEDULED_MESSAGE_NOT_FOUND");
  });

  it("ScheduledMessageNotEditableError é 409 e diz qual status travou a edição", () => {
    const erro = new ScheduledMessageNotEditableError("SENT");
    expect(erro.statusCode).toBe(409);
    expect(erro.code).toBe("SCHEDULED_MESSAGE_NOT_EDITABLE");
    expect(erro.details).toEqual({ status: "SENT" });
    expect(erro.message).toContain("ja foi enviada");
  });

  it("ScheduledMessageInPastError é 422 — validação de negócio, não de formato", () => {
    const erro = new ScheduledMessageInPastError();
    expect(erro.statusCode).toBe(422);
    expect(erro.code).toBe("SCHEDULED_MESSAGE_IN_PAST");
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/shared/errors/scheduled-message-errors.test.ts`
Esperado: FAIL — `ScheduledMessageInPastError` não é exportado por `./domain-error`.

- [ ] **Passo 3: Implementar**

No fim de `src/shared/errors/domain-error.ts`:

```ts
export class ScheduledMessageNotFoundError extends DomainError {
  constructor() {
    super("Mensagem agendada nao encontrada.", "SCHEDULED_MESSAGE_NOT_FOUND", 404);
  }
}

/**
 * Editar ou cancelar so vale enquanto a mensagem nao saiu. Depois de enviada, a
 * cliente ja leu — mudar o registro seria reescrever o passado.
 */
export class ScheduledMessageNotEditableError extends DomainError {
  constructor(status: string) {
    super(
      status === "SENT"
        ? "Esta mensagem ja foi enviada e nao pode mais ser alterada."
        : "Esta mensagem nao pode mais ser alterada.",
      "SCHEDULED_MESSAGE_NOT_EDITABLE",
      409,
      { status },
    );
  }
}

export class ScheduledMessageInPastError extends DomainError {
  constructor() {
    super("Escolha uma data e um horario no futuro.", "SCHEDULED_MESSAGE_IN_PAST", 422);
  }
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npx vitest run src/shared/errors/scheduled-message-errors.test.ts`
Esperado: 3 testes PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/shared/errors/domain-error.ts src/shared/errors/scheduled-message-errors.test.ts
git commit -m "feat(errors): erros tipados de mensagem agendada"
```

---

## Task 3: Repository

**Arquivos:**
- Criar: `src/domains/notifications/scheduled-messages/types.ts`
- Criar: `src/domains/notifications/scheduled-messages/scheduled-message.repository.ts`
- Criar: `src/domains/notifications/scheduled-messages/scheduled-message.repository.test.ts`

**Interfaces:**
- Consome: model `ScheduledMessage` da Task 1.
- Produz: `scheduledMessageRepository` com `create`, `listByCustomer`, `findById`, `update`, `cancel`, `findDue`, `claim`, `markSent`, `markFailed`, `expireStuck`. E a constante `SCHEDULED_MESSAGE_TEMPLATE_KEY = "scheduled-message"`, usada pelo service (Task 5) como `NotificationLog.template`.

- [ ] **Passo 1: Criar o arquivo de tipos**

Crie `src/domains/notifications/scheduled-messages/types.ts`:

```ts
import type { Prisma } from "@prisma/client";

/**
 * Vai para `NotificationLog.template`. Não existe em `LEGACY_TEMPLATE_TO_EVENT` de
 * propósito: mensagem agendada é texto livre, e o gateway de WhatsApp só consulta
 * aquele mapa quando `payload.message` está vazio — o que aqui nunca acontece,
 * porque o corpo é obrigatório em todas as camadas.
 */
export const SCHEDULED_MESSAGE_TEMPLATE_KEY = "scheduled-message";

/** O que a lista da UI precisa: a mensagem mais quem a agendou. */
export type ScheduledMessageWithAuthor = Prisma.ScheduledMessageGetPayload<{
  include: { createdByUser: { select: { id: true; name: true } } };
}>;

/**
 * O que a UI recebe. `scheduledDate`/`scheduledTime` vêm **já formatados no fuso do
 * tenant** pelo service: o navegador nunca converte `scheduledAt`, senão um profissional
 * em outro fuso veria — e ao editar, reenviaria — um horário deslocado. São exatamente os
 * mesmos campos que o formulário manda de volta em `date`/`time`.
 */
export type ScheduledMessageListItem = ScheduledMessageWithAuthor & {
  scheduledDate: string;
  scheduledTime: string;
};

/** O que a varredura do cron precisa para renderizar e entregar sem N+1. */
export type ScheduledMessageForDelivery = Prisma.ScheduledMessageGetPayload<{
  include: {
    customer: { select: { id: true; name: true; phone: true } };
    tenant: {
      select: { name: true; slug: true; timezone: true; phone: true; address: true };
    };
  };
}>;
```

- [ ] **Passo 2: Escrever os testes que falham**

Crie `src/domains/notifications/scheduled-messages/scheduled-message.repository.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

import { prismaMock } from "@/shared/test/prisma-mock";

import { scheduledMessageRepository } from "./scheduled-message.repository";

describe("scheduledMessageRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create grava com o tenantId do argumento, nunca do input", async () => {
    prismaMock.scheduledMessage.create.mockResolvedValue({ id: "sm-1" } as never);

    await scheduledMessageRepository.create("tenant-1", {
      customerId: "cli-1",
      body: "Oi Maria",
      scheduledAt: new Date("2026-08-01T12:00:00.000Z"),
      createdByUserId: "user-1",
    });

    expect(prismaMock.scheduledMessage.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        customerId: "cli-1",
        body: "Oi Maria",
        scheduledAt: new Date("2026-08-01T12:00:00.000Z"),
        createdByUserId: "user-1",
        channel: "WHATSAPP",
      },
    });
  });

  it("listByCustomer filtra tenant e cliente, e traz quem agendou", async () => {
    prismaMock.scheduledMessage.findMany.mockResolvedValue([] as never);

    await scheduledMessageRepository.listByCustomer("tenant-1", "cli-1");

    expect(prismaMock.scheduledMessage.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", customerId: "cli-1" },
      include: { createdByUser: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "desc" },
    });
  });

  it("findById filtra pelo tenant — id de outro tenant nunca é alcançável", async () => {
    prismaMock.scheduledMessage.findFirst.mockResolvedValue(null);

    await scheduledMessageRepository.findById("tenant-1", "sm-1");

    expect(prismaMock.scheduledMessage.findFirst).toHaveBeenCalledWith({
      where: { id: "sm-1", tenantId: "tenant-1" },
      include: { createdByUser: { select: { id: true, name: true } } },
    });
  });

  it("update aplica corpo e horário novos filtrando o tenant", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 1 });

    await scheduledMessageRepository.update("tenant-1", "sm-1", {
      body: "Texto novo",
      scheduledAt: new Date("2026-08-02T12:00:00.000Z"),
    });

    expect(prismaMock.scheduledMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "sm-1", tenantId: "tenant-1", status: "PENDING" },
      data: { body: "Texto novo", scheduledAt: new Date("2026-08-02T12:00:00.000Z") },
    });
  });

  it("update devolve false quando nada foi alterado (linha já saiu do PENDING)", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 0 });

    const alterou = await scheduledMessageRepository.update("tenant-1", "sm-1", {
      body: "Texto novo",
      scheduledAt: new Date("2026-08-02T12:00:00.000Z"),
    });

    expect(alterou).toBe(false);
  });

  it("cancel só cancela o que ainda está PENDING", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 1 });

    const cancelou = await scheduledMessageRepository.cancel("tenant-1", "sm-1");

    expect(cancelou).toBe(true);
    expect(prismaMock.scheduledMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "sm-1", tenantId: "tenant-1", status: "PENDING" },
      data: { status: "CANCELLED" },
    });
  });

  it("findDue pega o que venceu, em ordem, com cliente e tenant juntos", async () => {
    prismaMock.scheduledMessage.findMany.mockResolvedValue([] as never);
    const agora = new Date("2026-08-01T12:05:00.000Z");

    await scheduledMessageRepository.findDue(agora, 50);

    expect(prismaMock.scheduledMessage.findMany).toHaveBeenCalledWith({
      where: { status: "PENDING", scheduledAt: { lte: agora } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        tenant: {
          select: { name: true, slug: true, timezone: true, phone: true, address: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
    });
  });

  it("claim é atômico: só ganha quem trocou PENDING por SENDING", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 1 });

    const ganhou = await scheduledMessageRepository.claim("sm-1");

    expect(ganhou).toBe(true);
    expect(prismaMock.scheduledMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "sm-1", status: "PENDING" },
      data: { status: "SENDING" },
    });
  });

  it("claim devolve false quando outro tick já levou a linha — idempotência", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 0 });

    expect(await scheduledMessageRepository.claim("sm-1")).toBe(false);
  });

  it("markSent grava horário de envio e o log gerado", async () => {
    prismaMock.scheduledMessage.update.mockResolvedValue({ id: "sm-1" } as never);
    const agora = new Date("2026-08-01T12:05:00.000Z");

    await scheduledMessageRepository.markSent("sm-1", "log-9", agora);

    expect(prismaMock.scheduledMessage.update).toHaveBeenCalledWith({
      where: { id: "sm-1" },
      data: {
        status: "SENT",
        sentAt: agora,
        notificationLogId: "log-9",
        failureReason: null,
      },
    });
  });

  it("markFailed guarda o motivo e não reagenda nada", async () => {
    prismaMock.scheduledMessage.update.mockResolvedValue({ id: "sm-1" } as never);

    await scheduledMessageRepository.markFailed("sm-1", "Cliente sem telefone.", null);

    expect(prismaMock.scheduledMessage.update).toHaveBeenCalledWith({
      where: { id: "sm-1" },
      data: {
        status: "FAILED",
        failureReason: "Cliente sem telefone.",
        notificationLogId: null,
      },
    });
  });

  it("expireStuck derruba SENDING antigo, para não ficar preso para sempre", async () => {
    prismaMock.scheduledMessage.updateMany.mockResolvedValue({ count: 3 });
    const limite = new Date("2026-08-01T11:50:00.000Z");

    const quantas = await scheduledMessageRepository.expireStuck(limite);

    expect(quantas).toBe(3);
    expect(prismaMock.scheduledMessage.updateMany).toHaveBeenCalledWith({
      where: { status: "SENDING", updatedAt: { lt: limite } },
      data: {
        status: "FAILED",
        failureReason:
          "O envio foi interrompido antes de terminar. Agende a mensagem de novo.",
      },
    });
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

Rode: `npx vitest run src/domains/notifications/scheduled-messages/scheduled-message.repository.test.ts`
Esperado: FAIL — o módulo `./scheduled-message.repository` não existe.

- [ ] **Passo 4: Implementar o repository**

Crie `src/domains/notifications/scheduled-messages/scheduled-message.repository.ts`:

```ts
import { prisma } from "@/shared/database/prisma";

import type { ScheduledMessageForDelivery, ScheduledMessageWithAuthor } from "./types";

export type CreateScheduledMessageData = {
  customerId: string;
  body: string;
  scheduledAt: Date;
  createdByUserId: string;
};

export type UpdateScheduledMessageData = {
  body: string;
  scheduledAt: Date;
};

const AUTOR = { createdByUser: { select: { id: true, name: true } } } as const;

export class ScheduledMessageRepository {
  /** `tenantId` vem sempre do argumento (extraído da sessão), nunca do input. */
  async create(tenantId: string, data: CreateScheduledMessageData) {
    return prisma.scheduledMessage.create({
      data: {
        tenantId,
        customerId: data.customerId,
        body: data.body,
        scheduledAt: data.scheduledAt,
        createdByUserId: data.createdByUserId,
        // A v1 só entrega por WhatsApp. O campo existe para o e-mail plugar depois.
        channel: "WHATSAPP",
      },
    });
  }

  async listByCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<ScheduledMessageWithAuthor[]> {
    return prisma.scheduledMessage.findMany({
      where: { tenantId, customerId },
      include: AUTOR,
      orderBy: { scheduledAt: "desc" },
    });
  }

  async findById(tenantId: string, id: string): Promise<ScheduledMessageWithAuthor | null> {
    return prisma.scheduledMessage.findFirst({
      where: { id, tenantId },
      include: AUTOR,
    });
  }

  /**
   * O `status: "PENDING"` no `where` não é redundância com a checagem do service: ele
   * fecha a corrida entre a edição e a varredura do cron. Devolve `false` quando a
   * linha já saiu do PENDING no meio do caminho.
   */
  async update(
    tenantId: string,
    id: string,
    data: UpdateScheduledMessageData,
  ): Promise<boolean> {
    const { count } = await prisma.scheduledMessage.updateMany({
      where: { id, tenantId, status: "PENDING" },
      data: { body: data.body, scheduledAt: data.scheduledAt },
    });
    return count === 1;
  }

  /** Cancelar é mudar o status, nunca apagar a linha — o histórico fica. */
  async cancel(tenantId: string, id: string): Promise<boolean> {
    const { count } = await prisma.scheduledMessage.updateMany({
      where: { id, tenantId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    return count === 1;
  }

  /**
   * VARREDURA DO CRON — cross-tenant de propósito. O tick processa todos os tenants
   * numa passada só; filtrar por tenant aqui exigiria varrer a tabela de tenants a
   * cada 10 minutos. Este método não é alcançável a partir de nenhuma rota HTTP.
   */
  async findDue(now: Date, limit: number): Promise<ScheduledMessageForDelivery[]> {
    return prisma.scheduledMessage.findMany({
      where: { status: "PENDING", scheduledAt: { lte: now } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        tenant: {
          select: { name: true, slug: true, timezone: true, phone: true, address: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    });
  }

  /**
   * A reivindicação atômica que garante a idempotência: o `where` exige `PENDING`, e
   * o Postgres só deixa um `updateMany` concorrente ver a linha nesse estado. Quem
   * recebe `count === 1` é dono do envio; qualquer outro tick recebe `0` e desiste.
   * Cross-tenant pelo mesmo motivo do `findDue`.
   */
  async claim(id: string): Promise<boolean> {
    const { count } = await prisma.scheduledMessage.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "SENDING" },
    });
    return count === 1;
  }

  async markSent(id: string, notificationLogId: string, sentAt: Date) {
    return prisma.scheduledMessage.update({
      where: { id },
      data: { status: "SENT", sentAt, notificationLogId, failureReason: null },
    });
  }

  async markFailed(id: string, failureReason: string, notificationLogId: string | null) {
    return prisma.scheduledMessage.update({
      where: { id },
      data: { status: "FAILED", failureReason, notificationLogId },
    });
  }

  /**
   * Rede de segurança: se o processo morreu entre o `claim` e o desfecho, a linha
   * ficaria em `SENDING` para sempre — invisível para o `findDue`, que só olha
   * `PENDING`. Depois da janela, vira FAILED com motivo legível. Cross-tenant.
   */
  async expireStuck(before: Date): Promise<number> {
    const { count } = await prisma.scheduledMessage.updateMany({
      where: { status: "SENDING", updatedAt: { lt: before } },
      data: {
        status: "FAILED",
        failureReason:
          "O envio foi interrompido antes de terminar. Agende a mensagem de novo.",
      },
    });
    return count;
  }
}

export const scheduledMessageRepository = new ScheduledMessageRepository();
```

- [ ] **Passo 5: Rodar e ver passar**

Rode: `npx vitest run src/domains/notifications/scheduled-messages/scheduled-message.repository.test.ts`
Esperado: 12 testes PASS.

- [ ] **Passo 6: Teste negativo do isolamento por tenant**

Prova empírica de que o filtro existe de verdade, e não só no comentário. Rode:

```bash
grep -c "tenantId" src/domains/notifications/scheduled-messages/scheduled-message.repository.ts
```

Depois confira **manualmente** que os únicos métodos sem `tenantId` no `where` são `findDue`, `claim`, `expireStuck`, `markSent` e `markFailed` — os três primeiros por serem varredura do cron, e os dois últimos porque operam sobre um `id` que a varredura acabou de reivindicar (já validado) e nunca chegam por rota HTTP. Se algum método exposto a rota aparecer sem filtro, corrija antes de commitar.

- [ ] **Passo 7: tsc**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

- [ ] **Passo 8: Commit**

```bash
git add src/domains/notifications/scheduled-messages/
git commit -m "feat(notifications): repository de mensagem agendada com claim atomico"
```

---

## Task 4: Modo direto no dispatcher

O dispatcher da Fase 2 só sabe despachar **evento do catálogo**: consulta `shouldNotify`,
resolve canais pelo padrão do tenant e traduz o evento numa chave de log. Mensagem agendada
não é nada disso — é texto livre, canal explícito, e quem escreveu já decidiu enviar.

Além disso, o resultado atual não diz **se a entrega deu certo**: `dispatched` só registra
que `logAndDispatch` não lançou. Como o `NotificationLog` é quem carrega o status real, o
resultado passa a devolver os logs criados — é o que a Task 5 usa para decidir SENT × FAILED
e para gravar `notificationLogId`.

**Arquivos:**
- Modificar: `src/domains/notifications/customer-messages/customer-message-dispatcher.service.ts`
- Modificar: `src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts`

**Interfaces:**
- Consome: `notificationService.logAndDispatch` (já existente), que devolve o `NotificationLog` criado.
- Produz:
  - `CustomerMessageDirectDispatch` — `{ kind: "direct"; tenantId; customerId?; appointmentId?; recipient; payload; channels: CustomerMessageChannel[]; message: string; templateKey: string }`
  - `CustomerMessageDispatchResult.logs: { channel: CustomerMessageChannel; notificationLogId: string; status: NotificationStatus; errorMessage: string | null }[]`
  - Os chamadores existentes (subscriptions, jobs, rota de lembrete) continuam compilando sem mudança, porque `kind` é opcional no modo catálogo.

- [ ] **Passo 1: Ajustar os 3 testes existentes que comparam o resultado inteiro**

Em `customer-message-dispatcher.service.test.ts`, três testes usam `toEqual` sobre o objeto
inteiro e passariam a falhar assim que `logs` existir. Troque **exatamente** estas asserções:

No teste `"não envia nada quando o padrão do tenant está desligado"`:

```ts
    expect(resultado).toEqual({ dispatched: [], skipReason: "desligado", logs: [] });
```

No teste `"pula o canal sem destinatário e reporta quando nenhum canal tem para onde enviar"`:

```ts
    expect(resultado).toEqual({ dispatched: [], skipReason: "sem-destinatario", logs: [] });
```

No teste `"não deixa escapar exceção de shouldNotify/resolve — devolve resultado vazio"`:

```ts
    expect(resultado).toEqual({ dispatched: [], skipReason: null, logs: [] });
```

E no `beforeEach`, o mock precisa devolver um log com status, porque agora o resultado o lê:

```ts
    logAndDispatch.mockResolvedValue({ id: "log-1", status: "SENT", errorMessage: null });
```

- [ ] **Passo 2: Escrever os testes novos (falhando)**

Acrescente ao mesmo `describe`:

```ts
  it("devolve o log criado por canal, com id e status — é assim que o chamador sabe se saiu", async () => {
    ligado();
    logAndDispatch.mockResolvedValue({ id: "log-42", status: "SENT", errorMessage: null });

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000" },
      payload: {},
    });

    expect(resultado.logs).toEqual([
      { channel: "WHATSAPP", notificationLogId: "log-42", status: "SENT", errorMessage: null },
    ]);
  });

  it("log FAILED vem com o motivo real preservado — é o que a profissional vai ler", async () => {
    ligado();
    logAndDispatch.mockResolvedValue({
      id: "log-43",
      status: "FAILED",
      errorMessage: "Limite mensal de WhatsApp atingido.",
    });

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000" },
      payload: {},
    });

    expect(resultado.logs).toEqual([
      {
        channel: "WHATSAPP",
        notificationLogId: "log-43",
        status: "FAILED",
        errorMessage: "Limite mensal de WhatsApp atingido.",
      },
    ]);
  });

  it("modo direto não consulta o liga/desliga por evento — quem escreveu já decidiu enviar", async () => {
    logAndDispatch.mockResolvedValue({ id: "log-1", status: "SENT", errorMessage: null });

    const resultado = await customerMessageDispatcher.dispatch({
      kind: "direct",
      tenantId: "t1",
      customerId: "c1",
      channels: ["WHATSAPP"],
      message: "Oi Maria, lembrete do seu horário.",
      templateKey: "scheduled-message",
      recipient: { phone: "11999990000" },
      payload: { customerName: "Maria" },
    });

    expect(settings.shouldNotify).not.toHaveBeenCalled();
    expect(settings.resolve).not.toHaveBeenCalled();
    expect(resultado.dispatched).toEqual(["WHATSAPP"]);
  });

  it("modo direto manda o texto livre como `message` e a chave de log informada", async () => {
    logAndDispatch.mockResolvedValue({ id: "log-1", status: "SENT", errorMessage: null });

    await customerMessageDispatcher.dispatch({
      kind: "direct",
      tenantId: "t1",
      customerId: "c1",
      channels: ["WHATSAPP"],
      message: "Texto escrito pela profissional",
      templateKey: "scheduled-message",
      recipient: { phone: "11999990000" },
      payload: { customerName: "Maria" },
    });

    expect(logAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "scheduled-message",
        payload: expect.objectContaining({ message: "Texto escrito pela profissional" }),
      }),
    );
  });

  it("modo direto sem destinatário no canal não envia e reporta o motivo", async () => {
    const resultado = await customerMessageDispatcher.dispatch({
      kind: "direct",
      tenantId: "t1",
      customerId: "c1",
      channels: ["WHATSAPP"],
      message: "Texto",
      templateKey: "scheduled-message",
      recipient: { phone: null },
      payload: {},
    });

    expect(resultado).toEqual({ dispatched: [], skipReason: "sem-destinatario", logs: [] });
    expect(logAndDispatch).not.toHaveBeenCalled();
  });
```

- [ ] **Passo 3: Rodar e ver falhar**

Rode: `npx vitest run src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts`
Esperado: FAIL. Os testes de `logs` falham com `undefined`, e os de `kind: "direct"` nem compilam — o tipo do input não aceita `kind`.

- [ ] **Passo 4: Implementar**

Substitua o topo de `customer-message-dispatcher.service.ts` (do `import` até o fim do tipo `CustomerMessageDispatchResult`) por:

```ts
import { NotificationChannel, type NotificationStatus } from "@prisma/client";

import { CUSTOMER_MESSAGE_TEMPLATE_KEY } from "./customer-message-catalog";
import { customerMessageSettingService } from "./customer-message-setting.service";
import type { CustomerMessageChannel, CustomerMessageEventKey } from "./types";

type CustomerMessageDispatchBase = {
  tenantId: string;
  appointmentId?: string;
  customerId?: string;
  recipient: { phone?: string | null; email?: string | null };
  /** Dados do template — vira `NotificationLog.payload`. */
  payload: Record<string, unknown>;
};

/** Mensagem de um evento do catálogo: o padrão do tenant decide se envia e por onde. */
export type CustomerMessageCatalogDispatch = CustomerMessageDispatchBase & {
  kind?: "catalog";
  event: CustomerMessageEventKey;
  /** Override pontual da ação. `undefined` = usa o padrão do tenant. */
  notifyOverride?: boolean;
  /** Mensagem escrita na hora pelo profissional; tem precedência sobre o template. */
  message?: string;
};

/**
 * Mensagem avulsa escrita pelo profissional — hoje, a mensagem agendada. NÃO passa
 * pelo liga/desliga por evento: quem escreveu e marcou a hora já decidiu enviar, e um
 * toggle de configuração cancelando um envio explícito seria uma surpresa ruim. O
 * canal é explícito pela mesma razão.
 */
export type CustomerMessageDirectDispatch = CustomerMessageDispatchBase & {
  kind: "direct";
  channels: CustomerMessageChannel[];
  message: string;
  /** Vai cru para `NotificationLog.template`; identifica a origem do envio. */
  templateKey: string;
};

export type CustomerMessageDispatchInput =
  | CustomerMessageCatalogDispatch
  | CustomerMessageDirectDispatch;

export type CustomerMessageDispatchLog = {
  channel: CustomerMessageChannel;
  notificationLogId: string;
  status: NotificationStatus;
  /** Causa preservada do `NotificationLog` — vira o motivo que a profissional lê. */
  errorMessage: string | null;
};

export type CustomerMessageDispatchResult = {
  dispatched: CustomerMessageChannel[];
  skipReason: "desligado" | "sem-destinatario" | null;
  /**
   * Um registro por canal em que a entrega foi tentada. `dispatched` só diz que a
   * gravação do log não explodiu; o status REAL da entrega mora aqui, porque é o
   * `NotificationLog` que o gateway preenche com SENT/FAILED/PENDING.
   */
  logs: CustomerMessageDispatchLog[];
};
```

Depois, substitua o corpo do método `dispatch` por:

```ts
  async dispatch(input: CustomerMessageDispatchInput): Promise<CustomerMessageDispatchResult> {
    let channels: CustomerMessageChannel[];
    let template: string;

    if (input.kind === "direct") {
      channels = input.channels;
      template = input.templateKey;
    } else {
      try {
        const enviar = await customerMessageSettingService.shouldNotify(
          input.tenantId,
          input.event,
          input.notifyOverride,
        );
        if (!enviar) {
          return { dispatched: [], skipReason: "desligado", logs: [] };
        }

        ({ channels } = await customerMessageSettingService.resolve(input.tenantId, input.event));
      } catch (err) {
        // shouldNotify/resolve tocam o banco (CustomerMessageSetting). Uma falha aqui — soluço
        // transitório do Postgres, migration atrasada — não pode escapar: dispatch() é chamado
        // de handlers assíncronos do event bus, que engolem a rejeição, e a mensagem sumiria
        // sem deixar rastro (o mesmo tipo de bug histórico do reagendamento).
        console.error(
          "[customer-messages] Falha ao resolver configuração de envio",
          input.event,
          err instanceof Error ? err.message : err,
        );
        return { dispatched: [], skipReason: null, logs: [] };
      }

      template = CUSTOMER_MESSAGE_TEMPLATE_KEY[input.event];
    }

    const { notificationService } = await import("../notification.service");

    const payload = {
      ...input.payload,
      ...(input.message ? { message: input.message } : {}),
    };

    const dispatched: CustomerMessageChannel[] = [];
    const logs: CustomerMessageDispatchLog[] = [];

    for (const channel of channels) {
      const destinatario =
        channel === "WHATSAPP" ? input.recipient.phone : input.recipient.email;
      if (!destinatario) continue;

      try {
        const log = await notificationService.logAndDispatch({
          tenantId: input.tenantId,
          appointmentId: input.appointmentId,
          customerId: input.customerId,
          channel:
            channel === "WHATSAPP" ? NotificationChannel.WHATSAPP : NotificationChannel.EMAIL,
          template,
          recipient: destinatario,
          payload,
        });
        dispatched.push(channel);
        logs.push({
          channel,
          notificationLogId: log.id,
          status: log.status,
          errorMessage: log.errorMessage,
        });
      } catch (err) {
        // logAndDispatch já converte falha de envio em log FAILED; um throw aqui é
        // falha da própria gravação do log. Registrar e seguir para o outro canal.
        console.error(
          "[customer-messages] Falha ao despachar",
          template,
          channel,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return {
      dispatched,
      skipReason: dispatched.length === 0 ? "sem-destinatario" : null,
      logs,
    };
  }
```

> Note que o `console.error` do catch passou a logar `template` em vez de `input.event`:
> no modo direto não existe `input.event`, e o TypeScript rejeitaria o acesso.

- [ ] **Passo 5: Rodar e ver passar**

Rode: `npx vitest run src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts`
Esperado: 13 testes PASS (os 8 antigos + 5 novos).

- [ ] **Passo 6: Teste negativo — provar que a união discriminada realmente trava**

Não basta o implementador afirmar que o tipo protege. Crie um arquivo temporário
`src/domains/notifications/customer-messages/__quebra.ts` com:

```ts
import { customerMessageDispatcher } from "./customer-message-dispatcher.service";

void customerMessageDispatcher.dispatch({
  kind: "direct",
  tenantId: "t1",
  channels: ["WHATSAPP"],
  templateKey: "scheduled-message",
  recipient: { phone: "1" },
  payload: {},
});
```

Rode: `npx tsc --noEmit`
Esperado: **erro** apontando que `message` está faltando no modo direto. Se compilar, a
união não está discriminando e o tipo é decorativo — conserte antes de seguir.

Depois apague o arquivo: `rm src/domains/notifications/customer-messages/__quebra.ts`

- [ ] **Passo 7: tsc limpo e suíte de notificações**

Rode: `npx tsc --noEmit`
Esperado: zero erros (o `__quebra.ts` já foi apagado).

Rode: `npx vitest run src/domains/notifications/notifications`
Se esse caminho não casar com nada, rode `npx vitest run src/domains/notifications`
Esperado: verde, exceto `appointment-reminder.test.ts`, que já falhava antes desta entrega.

- [ ] **Passo 8: Commit**

```bash
git add src/domains/notifications/customer-messages/customer-message-dispatcher.service.ts src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts
git commit -m "feat(notifications): modo direto e logs de entrega no dispatcher"
```

---

## Task 5: Schemas Zod e service

O coração da entrega. Três regras moram aqui e em nenhum outro lugar: **o fuso é o do
tenant**, **não se agenda para o passado**, e **depois de enviada ninguém mexe**.

**Arquivos:**
- Criar: `src/domains/notifications/scheduled-messages/scheduled-message.schemas.ts`
- Criar: `src/domains/notifications/scheduled-messages/scheduled-message.service.ts`
- Criar: `src/domains/notifications/scheduled-messages/scheduled-message.service.test.ts`
- Modificar: `src/domains/notifications/scheduled-messages/scheduled-message.repository.ts` (dois métodos de leitura a mais)

**Interfaces:**
- Consome: `scheduledMessageRepository` (Task 3), erros da Task 2, `customerMessageDispatcher.dispatch` no modo `direct` (Task 4), `localDateTimeToUtc` de `@/lib/dates`, `buildCustomerMessageVariables` e `interpolateTemplate` já existentes.
- Produz:
  - `createScheduledMessageSchema` / `updateScheduledMessageSchema` / `previewScheduledMessageSchema` e seus tipos inferidos.
  - `scheduledMessageService` com `list(tenantId, customerId)` (devolve `ScheduledMessageListItem[]`, com `scheduledDate`/`scheduledTime` no fuso do tenant), `create(tenantId, userId, input)`, `update(tenantId, id, input)`, `cancel(tenantId, id)`, `renderPreview(tenantId, customerId, body)`, `deliverDue(now?)`.
  - `deliverDue` devolve `{ enviadas: number; falhas: number; expiradas: number }` — consumido pela Task 8 (cron).

- [ ] **Passo 1: Escrever os schemas Zod**

Crie `src/domains/notifications/scheduled-messages/scheduled-message.schemas.ts`:

```ts
import { z } from "zod";

/**
 * Data e hora chegam SEPARADAS e no formato local, nunca como instante ISO. É o que
 * força a conversão para UTC a acontecer no service, com o fuso do tenant — se o
 * componente mandasse um ISO, ele teria convertido no fuso do navegador, que é
 * exatamente o bug que o resumo diário da equipe já teve.
 */
const dataLocalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida.");

const horaLocalSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario invalido.");

export const createScheduledMessageSchema = z.object({
  customerId: z.string().min(1),
  body: z.string().trim().min(1).max(1500),
  date: dataLocalSchema,
  time: horaLocalSchema,
});

export type CreateScheduledMessageInput = z.infer<typeof createScheduledMessageSchema>;

export const updateScheduledMessageSchema = z.object({
  body: z.string().trim().min(1).max(1500),
  date: dataLocalSchema,
  time: horaLocalSchema,
});

export type UpdateScheduledMessageInput = z.infer<typeof updateScheduledMessageSchema>;

export const previewScheduledMessageSchema = z.object({
  customerId: z.string().min(1),
  // Aqui o vazio é permitido: a prévia acompanha a digitação desde o primeiro caractere.
  body: z.string().max(1500),
});

export type PreviewScheduledMessageInput = z.infer<typeof previewScheduledMessageSchema>;
```

- [ ] **Passo 2: Acrescentar as duas leituras que faltam no repository**

Em `scheduled-message.repository.ts`, dentro da classe, antes do `create`:

```ts
  /** Só os campos que a montagem das variáveis do template precisa. */
  async findTenantContext(tenantId: string) {
    return prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, slug: true, timezone: true, phone: true, address: true },
    });
  }

  /** Filtra o tenant: id de cliente de outro negócio nunca resolve. */
  async findCustomerForMessage(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, name: true, phone: true },
    });
  }
```

- [ ] **Passo 3: Escrever os testes que falham**

Crie `src/domains/notifications/scheduled-messages/scheduled-message.service.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./scheduled-message.repository", () => ({
  scheduledMessageRepository: {
    findTenantContext: vi.fn(),
    findCustomerForMessage: vi.fn(),
    create: vi.fn(),
    listByCustomer: vi.fn(),

    findById: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    findDue: vi.fn(),
    claim: vi.fn(),
    markSent: vi.fn(),
    markFailed: vi.fn(),
    expireStuck: vi.fn(),
  },
}));

vi.mock("../customer-messages/customer-message-dispatcher.service", () => ({
  customerMessageDispatcher: { dispatch: vi.fn() },
}));

import {
  ScheduledMessageInPastError,
  ScheduledMessageNotEditableError,
  ScheduledMessageNotFoundError,
  CustomerNotFoundError,
  ValidationError,
} from "@/shared/errors";

import { customerMessageDispatcher } from "../customer-messages/customer-message-dispatcher.service";

import { scheduledMessageRepository } from "./scheduled-message.repository";
import { scheduledMessageService } from "./scheduled-message.service";

const repo = vi.mocked(scheduledMessageRepository);
const dispatcher = vi.mocked(customerMessageDispatcher);

const TENANT = {
  name: "Studio Bela",
  slug: "studio-bela",
  timezone: "America/Sao_Paulo",
  phone: "1133334444",
  address: "Rua A, 100",
};

const CLIENTE = { id: "cli-1", name: "Maria Silva", phone: "11999990000" };

describe("scheduledMessageService.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findTenantContext.mockResolvedValue(TENANT as never);
  });

  it("formata data e hora no fuso do TENANT — a UI nunca converte sozinha", async () => {
    repo.listByCustomer.mockResolvedValue([
      { id: "sm-1", scheduledAt: new Date("2026-08-01T12:00:00.000Z") },
    ] as never);

    const itens = await scheduledMessageService.list("tenant-1", "cli-1");

    // 12:00 UTC = 09:00 em America/Sao_Paulo, independente do fuso da máquina.
    expect(itens[0].scheduledDate).toBe("2026-08-01");
    expect(itens[0].scheduledTime).toBe("09:00");
  });
});

describe("scheduledMessageService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    repo.findTenantContext.mockResolvedValue(TENANT as never);
    repo.findCustomerForMessage.mockResolvedValue(CLIENTE as never);
    repo.create.mockResolvedValue({ id: "sm-1" } as never);
  });

  it("converte data e hora locais para UTC usando o fuso do TENANT, não o do processo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));

    await scheduledMessageService.create("tenant-1", "user-1", {
      customerId: "cli-1",
      body: "Oi Maria",
      date: "2026-08-01",
      time: "09:00",
    });

    // 09:00 em America/Sao_Paulo (UTC-3) = 12:00 UTC. Independe do fuso da máquina.
    expect(repo.create).toHaveBeenCalledWith("tenant-1", {
      customerId: "cli-1",
      body: "Oi Maria",
      scheduledAt: new Date("2026-08-01T12:00:00.000Z"),
      createdByUserId: "user-1",
    });
  });

  it("recusa horário no passado — a validação é do service, não da UI", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T15:00:00.000Z"));

    await expect(
      scheduledMessageService.create("tenant-1", "user-1", {
        customerId: "cli-1",
        body: "Oi",
        date: "2026-08-01",
        // 09:00 local = 12:00 UTC, três horas antes de agora.
        time: "09:00",
      }),
    ).rejects.toBeInstanceOf(ScheduledMessageInPastError);

    expect(repo.create).not.toHaveBeenCalled();
  });

  it("recusa cliente que não é do tenant da sessão", async () => {
    repo.findCustomerForMessage.mockResolvedValue(null);

    await expect(
      scheduledMessageService.create("tenant-1", "user-1", {
        customerId: "cli-de-outro-tenant",
        body: "Oi",
        date: "2099-01-01",
        time: "09:00",
      }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it("recusa cliente sem telefone — não adianta agendar o que nunca vai sair", async () => {
    repo.findCustomerForMessage.mockResolvedValue({ ...CLIENTE, phone: null } as never);

    await expect(
      scheduledMessageService.create("tenant-1", "user-1", {
        customerId: "cli-1",
        body: "Oi",
        date: "2099-01-01",
        time: "09:00",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("scheduledMessageService.update e cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    repo.findTenantContext.mockResolvedValue(TENANT as never);
  });

  it("não deixa editar mensagem já enviada", async () => {
    repo.findById.mockResolvedValue({ id: "sm-1", status: "SENT" } as never);

    await expect(
      scheduledMessageService.update("tenant-1", "sm-1", {
        body: "Outro texto",
        date: "2099-01-01",
        time: "09:00",
      }),
    ).rejects.toBeInstanceOf(ScheduledMessageNotEditableError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it("não deixa cancelar mensagem já enviada", async () => {
    repo.findById.mockResolvedValue({ id: "sm-1", status: "SENT" } as never);

    await expect(scheduledMessageService.cancel("tenant-1", "sm-1")).rejects.toBeInstanceOf(
      ScheduledMessageNotEditableError,
    );

    expect(repo.cancel).not.toHaveBeenCalled();
  });

  it("404 quando o id não existe no tenant da sessão", async () => {
    repo.findById.mockResolvedValue(null);

    await expect(scheduledMessageService.cancel("tenant-1", "sm-1")).rejects.toBeInstanceOf(
      ScheduledMessageNotFoundError,
    );
  });

  it("edita o que ainda está pendente, reconvertendo o horário no fuso do tenant", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
    repo.findById.mockResolvedValue({ id: "sm-1", status: "PENDING" } as never);
    repo.update.mockResolvedValue(true);

    await scheduledMessageService.update("tenant-1", "sm-1", {
      body: "Texto novo",
      date: "2026-08-02",
      time: "18:30",
    });

    expect(repo.update).toHaveBeenCalledWith("tenant-1", "sm-1", {
      body: "Texto novo",
      scheduledAt: new Date("2026-08-02T21:30:00.000Z"),
    });
  });

  it("se o cron levou a linha no meio da edição, o erro diz o status novo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
    repo.findById
      .mockResolvedValueOnce({ id: "sm-1", status: "PENDING" } as never)
      .mockResolvedValueOnce({ id: "sm-1", status: "SENDING" } as never);
    repo.update.mockResolvedValue(false);

    await expect(
      scheduledMessageService.update("tenant-1", "sm-1", {
        body: "Texto novo",
        date: "2026-08-02",
        time: "18:30",
      }),
    ).rejects.toMatchObject({ details: { status: "SENDING" } });
  });
});

describe("scheduledMessageService.renderPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findTenantContext.mockResolvedValue(TENANT as never);
    repo.findCustomerForMessage.mockResolvedValue(CLIENTE as never);
  });

  it("interpola as variáveis com os dados reais do cliente e do negócio", async () => {
    const texto = await scheduledMessageService.renderPreview(
      "tenant-1",
      "cli-1",
      "Oi {{primeiro_nome}}, aqui é do {{negocio}}!",
    );

    expect(texto).toBe("Oi Maria, aqui é do Studio Bela!");
  });
});

describe("scheduledMessageService.deliverDue", () => {
  const VENCIDA = {
    id: "sm-1",
    tenantId: "tenant-1",
    customerId: "cli-1",
    body: "Oi {{primeiro_nome}}",
    customer: CLIENTE,
    tenant: TENANT,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.expireStuck.mockResolvedValue(0);
    repo.findDue.mockResolvedValue([] as never);
  });

  it("entrega pelo dispatcher em modo direto, com o texto já interpolado", async () => {
    repo.findDue.mockResolvedValue([VENCIDA] as never);
    repo.claim.mockResolvedValue(true);
    dispatcher.dispatch.mockResolvedValue({
      dispatched: ["WHATSAPP"],
      skipReason: null,
      logs: [
        {
          channel: "WHATSAPP",
          notificationLogId: "log-1",
          status: "SENT",
          errorMessage: null,
        },
      ],
    });

    const agora = new Date("2026-08-01T12:05:00.000Z");
    const resumo = await scheduledMessageService.deliverDue(agora);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "direct",
        tenantId: "tenant-1",
        channels: ["WHATSAPP"],
        message: "Oi Maria",
        templateKey: "scheduled-message",
        recipient: { phone: "11999990000" },
      }),
    );
    expect(repo.markSent).toHaveBeenCalledWith("sm-1", "log-1", agora);
    expect(resumo).toEqual({ enviadas: 1, falhas: 0, expiradas: 0 });
  });

  it("não envia quando outro tick já reivindicou a linha — idempotência", async () => {
    repo.findDue.mockResolvedValue([VENCIDA] as never);
    repo.claim.mockResolvedValue(false);

    const resumo = await scheduledMessageService.deliverDue(new Date());

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(repo.markSent).not.toHaveBeenCalled();
    expect(repo.markFailed).not.toHaveBeenCalled();
    expect(resumo).toEqual({ enviadas: 0, falhas: 0, expiradas: 0 });
  });

  it("falha de entrega vira FAILED com o motivo real do log, sem reagendar", async () => {
    repo.findDue.mockResolvedValue([VENCIDA] as never);
    repo.claim.mockResolvedValue(true);
    dispatcher.dispatch.mockResolvedValue({
      dispatched: ["WHATSAPP"],
      skipReason: null,
      logs: [
        {
          channel: "WHATSAPP",
          notificationLogId: "log-9",
          status: "FAILED",
          errorMessage: "Limite mensal de WhatsApp atingido.",
        },
      ],
    });

    const resumo = await scheduledMessageService.deliverDue(new Date());

    expect(repo.markFailed).toHaveBeenCalledWith(
      "sm-1",
      "Limite mensal de WhatsApp atingido.",
      "log-9",
    );
    expect(resumo).toEqual({ enviadas: 0, falhas: 1, expiradas: 0 });
  });

  it("exceção numa linha não derruba o lote — a próxima ainda é processada", async () => {
    repo.findDue.mockResolvedValue([VENCIDA, { ...VENCIDA, id: "sm-2" }] as never);
    repo.claim.mockResolvedValue(true);
    dispatcher.dispatch
      .mockRejectedValueOnce(new Error("banco fora do ar"))
      .mockResolvedValueOnce({
        dispatched: ["WHATSAPP"],
        skipReason: null,
        logs: [
          {
            channel: "WHATSAPP",
            notificationLogId: "log-2",
            status: "SENT",
            errorMessage: null,
          },
        ],
      });

    const resumo = await scheduledMessageService.deliverDue(new Date());

    expect(repo.markFailed).toHaveBeenCalledWith(
      "sm-1",
      expect.stringContaining("banco fora do ar"),
      null,
    );
    expect(repo.markSent).toHaveBeenCalledWith("sm-2", "log-2", expect.any(Date));
    expect(resumo).toEqual({ enviadas: 1, falhas: 1, expiradas: 0 });
  });

  it("cliente que perdeu o telefone entre agendar e enviar falha com motivo legível", async () => {
    repo.findDue.mockResolvedValue([
      { ...VENCIDA, customer: { ...CLIENTE, phone: null } },
    ] as never);
    repo.claim.mockResolvedValue(true);

    await scheduledMessageService.deliverDue(new Date());

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(repo.markFailed).toHaveBeenCalledWith(
      "sm-1",
      "Cliente sem telefone cadastrado.",
      null,
    );
  });

  it("derruba SENDING preso antes de varrer, e conta quantos", async () => {
    repo.expireStuck.mockResolvedValue(2);

    const agora = new Date("2026-08-01T12:00:00.000Z");
    const resumo = await scheduledMessageService.deliverDue(agora);

    // 15 minutos antes de agora.
    expect(repo.expireStuck).toHaveBeenCalledWith(new Date("2026-08-01T11:45:00.000Z"));
    expect(resumo.expiradas).toBe(2);
  });
});
```

- [ ] **Passo 4: Rodar e ver falhar**

Rode: `npx vitest run src/domains/notifications/scheduled-messages/scheduled-message.service.test.ts`
Esperado: FAIL — `./scheduled-message.service` não existe.

- [ ] **Passo 5: Implementar o service**

Crie `src/domains/notifications/scheduled-messages/scheduled-message.service.ts`:

```ts
import { localDateTimeToUtc } from "@/lib/dates";
import {
  CustomerNotFoundError,
  NotFoundError,
  ScheduledMessageInPastError,
  ScheduledMessageNotEditableError,
  ScheduledMessageNotFoundError,
  ValidationError,
} from "@/shared/errors";

import { customerMessageDispatcher } from "../customer-messages/customer-message-dispatcher.service";
import { buildCustomerMessageVariables } from "../customer-messages/customer-message-variables";
import { interpolateTemplate } from "../user-notifications/notification-template-engine";

import { scheduledMessageRepository } from "./scheduled-message.repository";
import {
  SCHEDULED_MESSAGE_TEMPLATE_KEY,
  type ScheduledMessageForDelivery,
  type ScheduledMessageListItem,
} from "./types";
import type {
  CreateScheduledMessageInput,
  UpdateScheduledMessageInput,
} from "./scheduled-message.schemas";

/** Quantas mensagens vencidas um único tick processa. */
const TAMANHO_DO_LOTE = 50;

/**
 * Depois disso, uma linha em SENDING é considerada abandonada. Precisa ser bem maior
 * que a duração de um envio e menor que o intervalo em que alguém repararia na falta.
 */
const JANELA_DE_TRAVAMENTO_MS = 15 * 60 * 1000;

export type DeliverDueSummary = {
  enviadas: number;
  falhas: number;
  expiradas: number;
};

export class ScheduledMessageService {
  /**
   * Devolve data e hora **já no fuso do tenant**. A UI nunca converte `scheduledAt`:
   * um profissional acessando de outro fuso veria o horário deslocado e, ao editar,
   * reenviaria esse valor errado — o formulário devolve exatamente estes dois campos.
   */
  async list(tenantId: string, customerId: string): Promise<ScheduledMessageListItem[]> {
    const [tenant, itens] = await Promise.all([
      scheduledMessageRepository.findTenantContext(tenantId),
      scheduledMessageRepository.listByCustomer(tenantId, customerId),
    ]);

    if (!tenant) throw new NotFoundError("Negocio");

    return itens.map((item) => ({
      ...item,
      ...this.formatarNoFusoDoTenant(item.scheduledAt, tenant.timezone),
    }));
  }

  /** Mesma técnica de `src/lib/dates.ts`: Intl, sem lib externa. */
  private formatarNoFusoDoTenant(quando: Date, timezone: string) {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(quando);

    const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;

    return {
      scheduledDate: `${parte("year")}-${parte("month")}-${parte("day")}`,
      scheduledTime: `${parte("hour")}:${parte("minute")}`,
    };
  }

  async create(tenantId: string, userId: string, input: CreateScheduledMessageInput) {
    const { tenant, cliente } = await this.contexto(tenantId, input.customerId);

    if (!cliente.phone) {
      throw new ValidationError(
        "Este cliente nao tem telefone cadastrado. Cadastre o telefone antes de agendar a mensagem.",
      );
    }

    const scheduledAt = this.paraUtc(input.date, input.time, tenant.timezone);

    return scheduledMessageRepository.create(tenantId, {
      customerId: input.customerId,
      body: input.body,
      scheduledAt,
      createdByUserId: userId,
    });
  }

  async update(tenantId: string, id: string, input: UpdateScheduledMessageInput) {
    const existente = await scheduledMessageRepository.findById(tenantId, id);
    if (!existente) throw new ScheduledMessageNotFoundError();
    if (existente.status !== "PENDING") {
      throw new ScheduledMessageNotEditableError(existente.status);
    }

    const tenant = await scheduledMessageRepository.findTenantContext(tenantId);
    if (!tenant) throw new NotFoundError("Negocio");

    const scheduledAt = this.paraUtc(input.date, input.time, tenant.timezone);

    const alterou = await scheduledMessageRepository.update(tenantId, id, {
      body: input.body,
      scheduledAt,
    });

    // Corrida real: a varredura do cron pode ter reivindicado a linha entre a leitura
    // acima e este update. Reler o status faz o erro dizer a verdade ao usuário.
    if (!alterou) {
      const atual = await scheduledMessageRepository.findById(tenantId, id);
      throw new ScheduledMessageNotEditableError(atual?.status ?? "SENDING");
    }
  }

  async cancel(tenantId: string, id: string) {
    const existente = await scheduledMessageRepository.findById(tenantId, id);
    if (!existente) throw new ScheduledMessageNotFoundError();
    if (existente.status !== "PENDING") {
      throw new ScheduledMessageNotEditableError(existente.status);
    }

    const cancelou = await scheduledMessageRepository.cancel(tenantId, id);
    if (!cancelou) {
      const atual = await scheduledMessageRepository.findById(tenantId, id);
      throw new ScheduledMessageNotEditableError(atual?.status ?? "SENDING");
    }
  }

  /** Mesma interpolação do envio real — a prévia nunca mente sobre o que vai sair. */
  async renderPreview(tenantId: string, customerId: string, body: string): Promise<string> {
    const { tenant, cliente } = await this.contexto(tenantId, customerId);

    return interpolateTemplate(
      body,
      buildCustomerMessageVariables({
        customerName: cliente.name,
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          timezone: tenant.timezone,
          phone: tenant.phone,
          address: tenant.address,
        },
      }),
      // WhatsApp é texto puro: escapar HTML aqui produziria "&amp;" no celular.
      false,
    );
  }

  /**
   * A varredura chamada pelo /api/cron/tick a cada ~10 minutos. Idempotente por
   * construção: cada linha só é enviada por quem vencer o `claim` atômico.
   */
  async deliverDue(now: Date = new Date()): Promise<DeliverDueSummary> {
    const expiradas = await scheduledMessageRepository.expireStuck(
      new Date(now.getTime() - JANELA_DE_TRAVAMENTO_MS),
    );

    const vencidas = await scheduledMessageRepository.findDue(now, TAMANHO_DO_LOTE);

    let enviadas = 0;
    let falhas = 0;

    for (const mensagem of vencidas) {
      const ganhou = await scheduledMessageRepository.claim(mensagem.id);
      if (!ganhou) continue;

      try {
        const saiu = await this.entregar(mensagem, now);
        if (saiu) enviadas += 1;
        else falhas += 1;
      } catch (err) {
        // Uma linha problemática não pode derrubar o lote inteiro nem deixar a linha
        // presa em SENDING até a janela de travamento expirar.
        await scheduledMessageRepository.markFailed(
          mensagem.id,
          `Falha inesperada no envio: ${err instanceof Error ? err.message : "erro desconhecido"}`,
          null,
        );
        falhas += 1;
      }
    }

    return { enviadas, falhas, expiradas };
  }

  private async entregar(
    mensagem: ScheduledMessageForDelivery,
    now: Date,
  ): Promise<boolean> {
    if (!mensagem.customer.phone) {
      await scheduledMessageRepository.markFailed(
        mensagem.id,
        "Cliente sem telefone cadastrado.",
        null,
      );
      return false;
    }

    const texto = interpolateTemplate(
      mensagem.body,
      buildCustomerMessageVariables({
        customerName: mensagem.customer.name,
        tenant: {
          name: mensagem.tenant.name,
          slug: mensagem.tenant.slug,
          timezone: mensagem.tenant.timezone,
          phone: mensagem.tenant.phone,
          address: mensagem.tenant.address,
        },
      }),
      false,
    );

    // O dispatcher é o único caminho de envio ao cliente (ADR-018). A cota de WhatsApp
    // é incrementada e devolvida dentro do gateway — nada a fazer aqui.
    const resultado = await customerMessageDispatcher.dispatch({
      kind: "direct",
      tenantId: mensagem.tenantId,
      customerId: mensagem.customerId,
      channels: ["WHATSAPP"],
      message: texto,
      templateKey: SCHEDULED_MESSAGE_TEMPLATE_KEY,
      recipient: { phone: mensagem.customer.phone },
      payload: {
        customerName: mensagem.customer.name,
        scheduledMessageId: mensagem.id,
      },
    });

    const entregue = resultado.logs.find((log) => log.status === "SENT");
    if (entregue) {
      await scheduledMessageRepository.markSent(mensagem.id, entregue.notificationLogId, now);
      return true;
    }

    const log = resultado.logs[0] ?? null;
    await scheduledMessageRepository.markFailed(
      mensagem.id,
      this.motivoDaFalha(resultado.skipReason, log?.errorMessage ?? null),
      log?.notificationLogId ?? null,
    );
    return false;
  }

  private motivoDaFalha(
    skipReason: "desligado" | "sem-destinatario" | null,
    errorMessage: string | null,
  ): string {
    if (errorMessage) return errorMessage;
    if (skipReason === "sem-destinatario") return "Cliente sem telefone cadastrado.";
    // Status PENDING no log: o gateway não chegou a tentar (WhatsApp desligado ou
    // desconectado). Não é erro de entrega, e por isso não tem errorMessage.
    return "O WhatsApp do seu negocio nao estava pronto para enviar.";
  }

  private paraUtc(date: string, time: string, timezone: string): Date {
    const quando = localDateTimeToUtc(date, time, timezone);
    if (quando.getTime() <= Date.now()) throw new ScheduledMessageInPastError();
    return quando;
  }

  private async contexto(tenantId: string, customerId: string) {
    const [tenant, cliente] = await Promise.all([
      scheduledMessageRepository.findTenantContext(tenantId),
      scheduledMessageRepository.findCustomerForMessage(tenantId, customerId),
    ]);

    if (!tenant) throw new NotFoundError("Negocio");
    if (!cliente) throw new CustomerNotFoundError();

    return { tenant, cliente };
  }
}

export const scheduledMessageService = new ScheduledMessageService();
```

- [ ] **Passo 6: Conferir a assinatura de `CustomerNotFoundError` antes de rodar**

Rode: `grep -n "class CustomerNotFoundError" -A 5 src/shared/errors/domain-error.ts`
Se o construtor exigir argumento, ajuste as duas chamadas (`this.contexto` e o teste)
para passá-lo. Não invente o argumento — leia o que está lá.

- [ ] **Passo 7: Rodar e ver passar**

Rode: `npx vitest run src/domains/notifications/scheduled-messages/`
Esperado: repository (12) + service (17) PASS.

- [ ] **Passo 8: Teste negativo do fuso — a prova que interessa**

Não aceite "o fuso está certo" como alegação. Rode a suíte do service forçando um fuso de
processo diferente do fuso do tenant:

```bash
TZ=Asia/Tokyo npx vitest run src/domains/notifications/scheduled-messages/scheduled-message.service.test.ts
```

Esperado: **os mesmos testes passando**. Se o teste de conversão falhar sob `TZ=Asia/Tokyo`,
a conversão está usando o fuso do processo em algum ponto — é exatamente o bug que o resumo
diário da equipe já teve, e precisa ser corrigido antes de commitar.

- [ ] **Passo 9: tsc**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

- [ ] **Passo 10: Commit**

```bash
git add src/domains/notifications/scheduled-messages/
git commit -m "feat(notifications): service de mensagem agendada com fuso do tenant e entrega idempotente"
```

---

## Task 6: Extrair o motivo de bloqueio para módulo compartilhado

A função `motivoDeBloqueio` vive privada dentro da rota de prévia da Fase 2. São ~35 linhas
de regra real (gate de plano, telefone, WhatsApp ligado, Evolution conectada). A tela nova
precisa da mesma resposta; copiar seria criar duas versões que divergem na primeira mudança.

**Arquivos:**
- Criar: `src/domains/notifications/customer-messages/customer-message-delivery.ts`
- Criar: `src/domains/notifications/customer-messages/customer-message-delivery.test.ts`
- Modificar: `src/app/api/notifications/customer-messages/preview/route.ts`

**Interfaces:**
- Produz: `customerMessageBlockedReason(args): Promise<string | null>`, com
  `args = { tenantId: string; channels: CustomerMessageChannel[]; cliente: { phone: string | null; email: string | null }; tenant: { whatsappEnabled: boolean; evolutionConnected: boolean; evolutionStatus: string | null } }`.
  Consumido pela rota de prévia existente e pela rota de prévia da Task 7.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `src/domains/notifications/customer-messages/customer-message-delivery.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertAccess: vi.fn() },
  FEATURES: { WHATSAPP_BASIC: "whatsapp_basic" },
}));

import { featureGuard } from "@/domains/billing/feature-guard";

import { customerMessageBlockedReason } from "./customer-message-delivery";

const guard = vi.mocked(featureGuard);

const TENANT_PRONTO = {
  whatsappEnabled: true,
  evolutionConnected: true,
  evolutionStatus: "CONNECTED",
};

describe("customerMessageBlockedReason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.assertAccess.mockResolvedValue(undefined as never);
  });

  it("devolve null quando tudo está pronto para o WhatsApp sair", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP"],
      cliente: { phone: "11999990000", email: null },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBeNull();
  });

  it("aponta o cliente sem telefone", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP"],
      cliente: { phone: null, email: null },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBe("Este cliente não tem telefone cadastrado.");
  });

  it("aponta o plano sem WhatsApp", async () => {
    guard.assertAccess.mockRejectedValue(new Error("sem acesso"));

    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP"],
      cliente: { phone: "11999990000", email: null },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBe("Seu plano não inclui o envio de WhatsApp.");
  });

  it("aponta o WhatsApp desconectado", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP"],
      cliente: { phone: "11999990000", email: null },
      tenant: { ...TENANT_PRONTO, evolutionStatus: "DISCONNECTED" },
    });

    expect(motivo).toBe("O WhatsApp do seu negócio não está conectado.");
  });

  it("não bloqueia quando o e-mail salva a entrega, mesmo com o WhatsApp travado", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: ["WHATSAPP", "EMAIL"],
      cliente: { phone: null, email: "maria@exemplo.com" },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBeNull();
  });

  it("bloqueia quando nenhum canal está ligado", async () => {
    const motivo = await customerMessageBlockedReason({
      tenantId: "t1",
      channels: [],
      cliente: { phone: "11999990000", email: "maria@exemplo.com" },
      tenant: TENANT_PRONTO,
    });

    expect(motivo).toBe("Nenhum canal está ligado para este aviso nas configurações.");
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/domains/notifications/customer-messages/customer-message-delivery.test.ts`
Esperado: FAIL — o módulo não existe.

- [ ] **Passo 3: Criar o módulo movendo o código, sem reescrevê-lo**

Crie `src/domains/notifications/customer-messages/customer-message-delivery.ts` com o corpo
**idêntico** ao da função `motivoDeBloqueio` que hoje está em
`src/app/api/notifications/customer-messages/preview/route.ts` (linhas 148-197). Mudam só o
nome, o `export` e os imports:

```ts
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";

import type { CustomerMessageChannel } from "./types";

export type CustomerMessageBlockedReasonArgs = {
  tenantId: string;
  channels: CustomerMessageChannel[];
  cliente: { phone: string | null; email: string | null };
  tenant: {
    whatsappEnabled: boolean;
    evolutionConnected: boolean;
    evolutionStatus: string | null;
  };
};

/**
 * Devolve o motivo legível SÓ quando nenhum canal ligado consegue entregar. Se ao
 * menos um consegue, a mensagem sai e o toggle não pode aparecer desabilitado.
 */
export async function customerMessageBlockedReason(
  args: CustomerMessageBlockedReasonArgs,
): Promise<string | null> {
  if (args.channels.length === 0) {
    return "Nenhum canal está ligado para este aviso nas configurações.";
  }

  const emailEntrega = args.channels.includes("EMAIL") && Boolean(args.cliente.email);

  if (!args.channels.includes("WHATSAPP")) {
    return emailEntrega ? null : "Este cliente não tem e-mail cadastrado.";
  }

  let motivoWhatsApp: string | null = null;

  try {
    await featureGuard.assertAccess(args.tenantId, FEATURES.WHATSAPP_BASIC);
  } catch {
    motivoWhatsApp = "Seu plano não inclui o envio de WhatsApp.";
  }

  if (!motivoWhatsApp && !args.cliente.phone) {
    motivoWhatsApp = "Este cliente não tem telefone cadastrado.";
  }
  if (!motivoWhatsApp && !args.tenant.whatsappEnabled) {
    motivoWhatsApp = "O envio automático de WhatsApp está desligado nas configurações.";
  }
  if (
    !motivoWhatsApp &&
    (!args.tenant.evolutionConnected || args.tenant.evolutionStatus !== "CONNECTED")
  ) {
    motivoWhatsApp = "O WhatsApp do seu negócio não está conectado.";
  }

  if (!motivoWhatsApp) return null;
  return emailEntrega ? null : motivoWhatsApp;
}
```

- [ ] **Passo 4: Apagar a cópia da rota e importar a nova**

Em `src/app/api/notifications/customer-messages/preview/route.ts`:

1. Apague o tipo `MotivoArgs` e a função `motivoDeBloqueio` inteiros (do fim do `POST` até o fim do arquivo).
2. Acrescente ao bloco de imports:

```ts
import { customerMessageBlockedReason } from "@/domains/notifications/customer-messages/customer-message-delivery";
```

3. Troque a chamada:

```ts
    const blockedReason = await customerMessageBlockedReason({
      tenantId,
      channels,
      cliente,
      tenant,
    });
```

4. Se o `featureGuard`/`FEATURES` ficarem sem uso no arquivo, remova o import — o ESLint aponta.

- [ ] **Passo 5: Rodar e ver passar, incluindo a rota que já existia**

Rode: `npx vitest run src/domains/notifications/customer-messages/customer-message-delivery.test.ts src/app/api/notifications/customer-messages/preview/route.test.ts`
Esperado: 6 testes novos PASS **e** os testes já existentes da rota de prévia continuam PASS.

Se algum teste da rota de prévia quebrar, é porque ele mockava `featureGuard` contando com a
função morar dentro da rota. Ajuste o mock para apontar para o módulo novo — não relaxe a
asserção.

- [ ] **Passo 6: tsc**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

- [ ] **Passo 7: Commit**

```bash
git add src/domains/notifications/customer-messages/customer-message-delivery.ts src/domains/notifications/customer-messages/customer-message-delivery.test.ts src/app/api/notifications/customer-messages/preview/route.ts
git commit -m "refactor(notifications): extrai motivo de bloqueio de entrega para modulo compartilhado"
```

---

## Task 7: Rotas de API

Quatro rotas finas. Nenhuma toca o Prisma; nenhuma lê `tenantId` do corpo.

**Arquivos:**
- Modificar: `src/domains/notifications/scheduled-messages/types.ts` (constante de variáveis)
- Criar: `src/app/api/notifications/scheduled-messages/route.ts`
- Criar: `src/app/api/notifications/scheduled-messages/route.test.ts`
- Criar: `src/app/api/notifications/scheduled-messages/[id]/route.ts`
- Criar: `src/app/api/notifications/scheduled-messages/[id]/route.test.ts`
- Criar: `src/app/api/notifications/scheduled-messages/preview/route.ts`
- Criar: `src/app/api/notifications/scheduled-messages/options/route.ts`

**Interfaces:**
- Consome: `scheduledMessageService` (Task 5), schemas Zod (Task 5), `customerMessageBlockedReason` (Task 6), `CUSTOMER_MESSAGE_CATALOG` e `customerMessageTemplateRepository` (Fase 1).
- Produz (contratos que a UI da Task 9 consome):
  - `GET /api/notifications/scheduled-messages?customerId=...` → `{ items: ScheduledMessageWithAuthor[] }`
  - `POST /api/notifications/scheduled-messages` body `{ customerId, body, date, time }` → a linha criada
  - `PATCH /api/notifications/scheduled-messages/[id]` body `{ body, date, time }` → `204`
  - `DELETE /api/notifications/scheduled-messages/[id]` → `204`
  - `POST /api/notifications/scheduled-messages/preview` body `{ customerId, body }` → `{ preview: string; blockedReason: string | null }`
  - `GET /api/notifications/scheduled-messages/options` → `{ templates: { event: string; label: string; body: string }[]; variables: string[] }`

- [ ] **Passo 1: Acrescentar a lista de variáveis em `types.ts`**

No fim de `src/domains/notifications/scheduled-messages/types.ts`:

```ts
/**
 * As variáveis que fazem sentido numa mensagem avulsa. Não há agendamento no contexto,
 * então `data`, `hora`, `servico`, `profissional` e `valor` renderizariam vazio — e um
 * chip que produz string vazia é pior do que chip nenhum.
 */
export const SCHEDULED_MESSAGE_VARIABLES = [
  "cliente",
  "primeiro_nome",
  "negocio",
  "endereco",
  "telefone_negocio",
  "link_agendamento",
  "link_portal",
] as const;
```

- [ ] **Passo 2: Escrever os testes da rota de coleção (falhando)**

Crie `src/app/api/notifications/scheduled-messages/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: vi.fn() }));
vi.mock("@/shared/auth/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/domains/notifications/scheduled-messages/scheduled-message.service", () => ({
  scheduledMessageService: { list: vi.fn(), create: vi.fn() },
}));

import { getSessionContext } from "@/shared/auth/session";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";

import { GET, POST } from "./route";

const session = vi.mocked(getSessionContext);
const service = vi.mocked(scheduledMessageService);

function sessaoCom(permissions: Record<string, string[]>) {
  session.mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-1",
    isOwner: false,
    permissions,
  } as unknown as Awaited<ReturnType<typeof getSessionContext>>);
}

const PODE_TUDO = { clientes: ["view", "create", "edit", "delete"] };

describe("/api/notifications/scheduled-messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoCom(PODE_TUDO);
  });

  it("GET lista as mensagens do cliente no tenant da sessão", async () => {
    service.list.mockResolvedValue([] as never);

    const res = await GET(
      new Request("http://localhost/api/notifications/scheduled-messages?customerId=cli-1"),
    );

    expect(res.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith("tenant-1", "cli-1");
  });

  it("GET sem customerId é 422, não uma listagem do tenant inteiro", async () => {
    const res = await GET(new Request("http://localhost/api/notifications/scheduled-messages"));

    expect(res.status).toBe(422);
    expect(service.list).not.toHaveBeenCalled();
  });

  it("GET exige clientes:view", async () => {
    sessaoCom({ clientes: [] });

    const res = await GET(
      new Request("http://localhost/api/notifications/scheduled-messages?customerId=cli-1"),
    );

    expect(res.status).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });

  it("POST cria usando tenantId e userId da sessão, ignorando o que vier no body", async () => {
    service.create.mockResolvedValue({ id: "sm-1" } as never);

    const res = await POST(
      new Request("http://localhost/api/notifications/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant-INVASOR",
          createdByUserId: "user-INVASOR",
          customerId: "cli-1",
          body: "Oi Maria",
          date: "2099-01-01",
          time: "09:00",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(service.create).toHaveBeenCalledWith("tenant-1", "user-1", {
      customerId: "cli-1",
      body: "Oi Maria",
      date: "2099-01-01",
      time: "09:00",
    });
  });

  it("POST exige clientes:edit — ver cliente não basta para mandar mensagem", async () => {
    sessaoCom({ clientes: ["view"] });

    const res = await POST(
      new Request("http://localhost/api/notifications/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "cli-1",
          body: "Oi",
          date: "2099-01-01",
          time: "09:00",
        }),
      }),
    );

    expect(res.status).toBe(403);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("POST rejeita horário fora do formato HH:mm", async () => {
    const res = await POST(
      new Request("http://localhost/api/notifications/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "cli-1",
          body: "Oi",
          date: "2099-01-01",
          time: "25:99",
        }),
      }),
    );

    expect(res.status).toBe(422);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("POST rejeita corpo vazio", async () => {
    const res = await POST(
      new Request("http://localhost/api/notifications/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "cli-1",
          body: "   ",
          date: "2099-01-01",
          time: "09:00",
        }),
      }),
    );

    expect(res.status).toBe(422);
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

Rode: `npx vitest run src/app/api/notifications/scheduled-messages/route.test.ts`
Esperado: FAIL — `./route` não existe.

- [ ] **Passo 4: Implementar a rota de coleção**

Crie `src/app/api/notifications/scheduled-messages/route.ts`:

```ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { createScheduledMessageSchema } from "@/domains/notifications/scheduled-messages/scheduled-message.schemas";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { ValidationError } from "@/shared/errors";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "view");

    const customerId = new URL(request.url).searchParams.get("customerId");
    if (!customerId) {
      throw new ValidationError("Informe o customerId na query.");
    }

    const items = await scheduledMessageService.list(session.tenantId, customerId);
    return Response.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "edit");

    const input = await validateInput(request, createScheduledMessageSchema);

    // tenantId e autor vêm SEMPRE da sessão — nunca do body.
    const criada = await scheduledMessageService.create(
      session.tenantId,
      session.userId,
      input,
    );

    return Response.json(criada);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Passo 5: Rodar e ver passar**

Rode: `npx vitest run src/app/api/notifications/scheduled-messages/route.test.ts`
Esperado: 7 testes PASS.

- [ ] **Passo 6: Testes da rota de item (falhando)**

Crie `src/app/api/notifications/scheduled-messages/[id]/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: vi.fn() }));
vi.mock("@/shared/auth/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/domains/notifications/scheduled-messages/scheduled-message.service", () => ({
  scheduledMessageService: { update: vi.fn(), cancel: vi.fn() },
}));

import { getSessionContext } from "@/shared/auth/session";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";
import { ScheduledMessageNotEditableError } from "@/shared/errors";

import { DELETE, PATCH } from "./route";

const session = vi.mocked(getSessionContext);
const service = vi.mocked(scheduledMessageService);

function sessaoCom(permissions: Record<string, string[]>) {
  session.mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-1",
    isOwner: false,
    permissions,
  } as unknown as Awaited<ReturnType<typeof getSessionContext>>);
}

const params = Promise.resolve({ id: "sm-1" });

describe("/api/notifications/scheduled-messages/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoCom({ clientes: ["view", "edit"] });
  });

  it("PATCH edita com o tenantId da sessão e devolve 204", async () => {
    service.update.mockResolvedValue(undefined);

    const res = await PATCH(
      new Request("http://localhost/api/notifications/scheduled-messages/sm-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Novo texto", date: "2099-01-01", time: "09:00" }),
      }),
      { params },
    );

    expect(res.status).toBe(204);
    expect(service.update).toHaveBeenCalledWith("tenant-1", "sm-1", {
      body: "Novo texto",
      date: "2099-01-01",
      time: "09:00",
    });
  });

  it("PATCH em mensagem já enviada vira 409, não 500", async () => {
    service.update.mockRejectedValue(new ScheduledMessageNotEditableError("SENT"));

    const res = await PATCH(
      new Request("http://localhost/api/notifications/scheduled-messages/sm-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Novo texto", date: "2099-01-01", time: "09:00" }),
      }),
      { params },
    );

    expect(res.status).toBe(409);
  });

  it("DELETE cancela e devolve 204", async () => {
    service.cancel.mockResolvedValue(undefined);

    const res = await DELETE(
      new Request("http://localhost/api/notifications/scheduled-messages/sm-1", {
        method: "DELETE",
      }),
      { params },
    );

    expect(res.status).toBe(204);
    expect(service.cancel).toHaveBeenCalledWith("tenant-1", "sm-1");
  });

  it("DELETE exige clientes:edit", async () => {
    sessaoCom({ clientes: ["view"] });

    const res = await DELETE(
      new Request("http://localhost/api/notifications/scheduled-messages/sm-1", {
        method: "DELETE",
      }),
      { params },
    );

    expect(res.status).toBe(403);
    expect(service.cancel).not.toHaveBeenCalled();
  });
});
```

- [ ] **Passo 7: Implementar a rota de item**

Crie `src/app/api/notifications/scheduled-messages/[id]/route.ts`:

```ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { updateScheduledMessageSchema } from "@/domains/notifications/scheduled-messages/scheduled-message.schemas";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "edit");

    const { id } = await params;
    const input = await validateInput(request, updateScheduledMessageSchema);

    await scheduledMessageService.update(session.tenantId, id, input);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "edit");

    const { id } = await params;

    // Cancelar muda o status; a linha continua na lista, com o histórico preservado.
    await scheduledMessageService.cancel(session.tenantId, id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Passo 8: Rodar e ver passar**

Rode: `npx vitest run "src/app/api/notifications/scheduled-messages/[id]/route.test.ts"`
Esperado: 4 testes PASS.

- [ ] **Passo 9: Implementar a rota de prévia**

Crie `src/app/api/notifications/scheduled-messages/preview/route.ts`:

```ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { customerMessageBlockedReason } from "@/domains/notifications/customer-messages/customer-message-delivery";
import { previewScheduledMessageSchema } from "@/domains/notifications/scheduled-messages/scheduled-message.schemas";
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { prisma } from "@/shared/database/prisma";
import { NotFoundError } from "@/shared/errors";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

/**
 * Prévia do que a cliente vai ler, com as variáveis já interpoladas, mais o motivo de
 * bloqueio quando o WhatsApp não tem como sair. Mesma renderização do envio real
 * (`scheduledMessageService.renderPreview`) — a prévia nunca pode mentir.
 */
export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "view");

    const input = await validateInput(request, previewScheduledMessageSchema);
    const tenantId = session.tenantId;

    const [tenant, cliente] = await Promise.all([
      prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { whatsappEnabled: true, evolutionConnected: true, evolutionStatus: true },
      }),
      prisma.customer.findFirst({
        where: { id: input.customerId, tenantId },
        select: { phone: true, email: true },
      }),
    ]);

    if (!tenant || !cliente) throw new NotFoundError("Cliente");

    const [preview, blockedReason] = await Promise.all([
      scheduledMessageService.renderPreview(tenantId, input.customerId, input.body),
      customerMessageBlockedReason({
        tenantId,
        // A v1 só entrega por WhatsApp.
        channels: ["WHATSAPP"],
        cliente,
        tenant,
      }),
    ]);

    return Response.json({ preview, blockedReason });
  } catch (error) {
    return handleApiError(error);
  }
}
```

> Esta rota lê o Prisma direto porque só monta os argumentos do
> `customerMessageBlockedReason` — é o mesmo desenho da rota de prévia da Fase 2
> (`customer-messages/preview/route.ts`), que já faz exatamente isso. Não é regra de
> negócio; a renderização, que é, mora no service.

- [ ] **Passo 10: Implementar a rota de opções**

Crie `src/app/api/notifications/scheduled-messages/options/route.ts`:

```ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { CUSTOMER_MESSAGE_CATALOG } from "@/domains/notifications/customer-messages/customer-message-catalog";
import { customerMessageTemplateRepository } from "@/domains/notifications/customer-messages/customer-message-template.repository";
import { SCHEDULED_MESSAGE_VARIABLES } from "@/domains/notifications/scheduled-messages/types";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

/**
 * Ponto de partida do formulário: os textos de WhatsApp que o tenant já tem (o
 * personalizado quando existe, senão o padrão do catálogo) e as variáveis oferecidas
 * como chips.
 *
 * Não exige `configuracoes:view` — precedente do ADR-016: é leitura de apoio de quem
 * atende, não edição de configuração. Escrever template continua exigindo a permissão
 * de configurações, na rota da Fase 1.
 */
export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "view");

    const personalizados = await customerMessageTemplateRepository.listByTenant(
      session.tenantId,
    );
    const porEvento = new Map(
      personalizados
        .filter((t) => t.channel === "WHATSAPP")
        .map((t) => [t.event as string, t.body]),
    );

    const templates = CUSTOMER_MESSAGE_CATALOG.map((entrada) => ({
      event: entrada.event,
      label: entrada.label,
      body: porEvento.get(entrada.event) ?? entrada.defaults.WHATSAPP.body,
    }));

    return Response.json({ templates, variables: [...SCHEDULED_MESSAGE_VARIABLES] });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Passo 11: Teste negativo de isolamento entre tenants**

Prova empírica de que o `tenantId` do corpo não é obedecido — o teste do Passo 2 já cobre o
`POST`. Confirme rodando só ele e lendo a saída:

```bash
npx vitest run src/app/api/notifications/scheduled-messages/route.test.ts -t "ignorando o que vier no body"
```

Esperado: PASS, e o `expect` mostra `service.create` chamado com `"tenant-1"`. Se você
trocar, de propósito, `session.tenantId` por `input.tenantId` na rota, este teste **precisa**
falhar. Faça essa troca, rode, veja falhar, e desfaça. Sem esse ciclo, a asserção é decorativa.

- [ ] **Passo 12: tsc e suíte das rotas**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

Rode: `npx vitest run src/app/api/notifications/`
Esperado: verde.

- [ ] **Passo 13: Commit**

```bash
git add src/app/api/notifications/scheduled-messages/ src/domains/notifications/scheduled-messages/types.ts
git commit -m "feat(notifications): rotas de mensagem agendada (listar, criar, editar, cancelar, previa)"
```

---

## Task 8: Ligar a varredura ao cron

O `/api/cron/tick` é chamado pelo GitHub Actions a cada 10 minutos
([`.github/workflows/cron-tick.yml`](../../../.github/workflows/cron-tick.yml)).

**Decisão a respeitar:** a varredura **não** vira job do pg-boss. A idempotência já vem do
`claim` atômico na própria tabela; enfileirar só criaria backlog, porque o tick é o único
worker e cada tick só busca um job. Uma chamada direta, com try/catch próprio, é mais simples
e mais honesta. O comentário no código precisa dizer isso — senão alguém "conserta" depois.

**Arquivos:**
- Modificar: `src/app/api/cron/tick/route.ts`
- Criar: `src/app/api/cron/tick/route.test.ts`

**Interfaces:**
- Consome: `scheduledMessageService.deliverDue()` (Task 5).
- Produz: a chave `scheduledMessages: { enviadas, falhas, expiradas }` no JSON de resposta do tick.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `src/app/api/cron/tick/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const boss = {
  createQueue: vi.fn().mockResolvedValue(undefined),
  schedule: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn().mockResolvedValue([]),
  complete: vi.fn().mockResolvedValue(undefined),
  fail: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/shared/queue/pg-boss", () => ({ startPgBoss: vi.fn(async () => boss) }));
vi.mock("@/domains/notifications/scheduled-messages/scheduled-message.service", () => ({
  scheduledMessageService: { deliverDue: vi.fn() },
}));

import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";

import { GET } from "./route";

const service = vi.mocked(scheduledMessageService);

function requisicao() {
  return new Request("http://localhost/api/cron/tick") as never;
}

describe("/api/cron/tick — mensagens agendadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boss.fetch.mockResolvedValue([]);
    delete process.env.CRON_SECRET;
  });

  it("roda a varredura de mensagens agendadas e reporta o resumo", async () => {
    service.deliverDue.mockResolvedValue({ enviadas: 2, falhas: 1, expiradas: 0 });

    const res = await GET(requisicao());
    const body = await res.json();

    expect(service.deliverDue).toHaveBeenCalledTimes(1);
    expect(body.processed.scheduledMessages).toEqual({
      enviadas: 2,
      falhas: 1,
      expiradas: 0,
    });
  });

  it("falha da varredura não derruba o tick inteiro — os outros jobs seguem", async () => {
    service.deliverDue.mockRejectedValue(new Error("banco fora do ar"));

    const res = await GET(requisicao());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.processed.scheduledMessages).toEqual({
      enviadas: 0,
      falhas: 0,
      expiradas: 0,
    });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/app/api/cron/tick/route.test.ts`
Esperado: FAIL — `body.processed.scheduledMessages` é `undefined`.

Se o teste falhar por outro motivo (algum import de job explodindo), acrescente o `vi.mock`
correspondente **antes** dos imports — não mude a rota para acomodar o teste.

- [ ] **Passo 3: Implementar**

Em `src/app/api/cron/tick/route.ts`:

1. Acrescente ao bloco de imports:

```ts
import { scheduledMessageService } from "@/domains/notifications/scheduled-messages/scheduled-message.service";
```

2. Acrescente esta função auxiliar logo depois de `runScheduled`:

```ts
// Mensagens agendadas NÃO são um job do pg-boss de propósito: a idempotência já vem do
// claim atômico na própria tabela (`ScheduledMessage.status`), e enfileirar criaria
// backlog — o tick é o único worker e cada tick buscaria um job só. O try/catch local
// existe para que uma falha aqui não zere o processamento dos demais jobs do tick.
async function runMensagensAgendadas() {
  try {
    return await scheduledMessageService.deliverDue();
  } catch (err) {
    console.error("[cron:tick] mensagens agendadas falharam:", err);
    return { enviadas: 0, falhas: 0, expiradas: 0 };
  }
}
```

3. Dentro do `try` do `GET`, logo **depois** do `const [reminders, ...] = await Promise.all([...])`:

```ts
    const scheduledMessages = await runMensagensAgendadas();
```

4. Acrescente a chave ao objeto `processed` da resposta, depois de `teamDigest,`:

```ts
        scheduledMessages,
```

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npx vitest run src/app/api/cron/tick/route.test.ts`
Esperado: 2 testes PASS.

- [ ] **Passo 5: Teste negativo — provar que o try/catch é real**

O segundo teste já é o negativo: ele quebra a varredura de propósito e exige que o tick
continue respondendo 200. Confirme que ele **falha** se o try/catch for removido: apague
temporariamente o `try`/`catch` de `runMensagensAgendadas` (deixando só o `return await`),
rode o teste, veja o erro, e restaure. Sem esse ciclo, o catch pode estar cobrindo nada.

- [ ] **Passo 6: tsc**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

- [ ] **Passo 7: Commit**

```bash
git add src/app/api/cron/tick/route.ts src/app/api/cron/tick/route.test.ts
git commit -m "feat(notifications): varredura de mensagens agendadas no cron tick"
```

---

## Task 9: Hooks de dados

**Arquivos:**
- Criar: `src/hooks/notifications/use-scheduled-messages.ts`

**Interfaces:**
- Consome: as rotas da Task 7.
- Produz: `ScheduledMessageItem`, `useScheduledMessages`, `useScheduledMessageOptions`, `useScheduledMessagePreview`, `useCreateScheduledMessage`, `useUpdateScheduledMessage`, `useCancelScheduledMessage`. Consumidos pela Task 10.

- [ ] **Passo 1: Implementar o arquivo de hooks**

Crie `src/hooks/notifications/use-scheduled-messages.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ScheduledMessageStatus =
  | "PENDING"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "CANCELLED";

export type ScheduledMessageItem = {
  id: string;
  body: string;
  /** Instante em UTC. Serve para ordenar; NUNCA para exibir nem para preencher o form. */
  scheduledAt: string;
  /** `YYYY-MM-DD` no fuso do tenant, calculado no servidor. É o que a tela mostra. */
  scheduledDate: string;
  /** `HH:mm` no fuso do tenant, calculado no servidor. */
  scheduledTime: string;
  status: ScheduledMessageStatus;
  sentAt: string | null;
  failureReason: string | null;
  createdByUser: { id: string; name: string };
};

export type ScheduledMessageOptions = {
  templates: { event: string; label: string; body: string }[];
  variables: string[];
};

export type ScheduledMessageFormInput = {
  body: string;
  date: string;
  time: string;
};

const BASE = "/api/notifications/scheduled-messages";

/** Extrai a mensagem do erro tipado da API; sem ela, o usuário só veria "erro". */
async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(corpo?.error?.message ?? "Nao foi possivel completar a operacao.");
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function chaveDaLista(customerId: string) {
  return ["scheduled-messages", customerId] as const;
}

export function useScheduledMessages(customerId: string) {
  return useQuery({
    queryKey: chaveDaLista(customerId),
    queryFn: async () => {
      const { items } = await pedir<{ items: ScheduledMessageItem[] }>(
        `${BASE}?customerId=${encodeURIComponent(customerId)}`,
      );
      return items;
    },
    enabled: Boolean(customerId),
  });
}

/** Templates e variáveis mudam pouco: vale segurar por bastante tempo. */
export function useScheduledMessageOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["scheduled-message-options"],
    queryFn: () => pedir<ScheduledMessageOptions>(`${BASE}/options`),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useScheduledMessagePreview(
  input: { customerId: string; body: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["scheduled-message-preview", input.customerId, input.body],
    queryFn: () =>
      pedir<{ preview: string; blockedReason: string | null }>(`${BASE}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    enabled: enabled && Boolean(input.customerId),
    // A prévia acompanha a digitação; sem isso, cada tecla dispararia uma requisição nova.
    staleTime: 10_000,
    retry: false,
  });
}

export function useCreateScheduledMessage(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ScheduledMessageFormInput) =>
      pedir<ScheduledMessageItem>(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, ...input }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveDaLista(customerId) });
    },
  });
}

export function useUpdateScheduledMessage(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: ScheduledMessageFormInput & { id: string }) =>
      pedir<void>(`${BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveDaLista(customerId) });
    },
  });
}

export function useCancelScheduledMessage(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pedir<void>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveDaLista(customerId) });
    },
  });
}
```

- [ ] **Passo 2: tsc**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

- [ ] **Passo 3: Commit**

```bash
git add src/hooks/notifications/use-scheduled-messages.ts
git commit -m "feat(notifications): hooks de mensagem agendada"
```

---

## Task 10: Dialog de lembretes

Um único `Dialog` com duas telas internas (lista ↔ formulário). Nunca um dialog dentro de
outro: a confirmação de cancelamento acontece **no próprio item da lista**.

**Arquivos:**
- Criar: `src/components/domain/notifications/scheduled-messages-dialog.tsx`
- Criar: `src/components/domain/notifications/scheduled-messages-dialog.test.tsx`

**Interfaces:**
- Consome: hooks da Task 9; `WhatsAppIcon` de `@/components/domain/vitrine/vitrine-icons`.
- Produz: `<ScheduledMessagesDialog open onClose customerId customerName />`, usado pela Task 11.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `src/components/domain/notifications/scheduled-messages-dialog.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/notifications/use-scheduled-messages", () => ({
  useScheduledMessages: vi.fn(),
  useScheduledMessageOptions: vi.fn(),
  useScheduledMessagePreview: vi.fn(),
  useCreateScheduledMessage: vi.fn(),
  useUpdateScheduledMessage: vi.fn(),
  useCancelScheduledMessage: vi.fn(),
}));

import {
  useCancelScheduledMessage,
  useCreateScheduledMessage,
  useScheduledMessageOptions,
  useScheduledMessagePreview,
  useScheduledMessages,
  useUpdateScheduledMessage,
} from "@/hooks/notifications/use-scheduled-messages";

import { ScheduledMessagesDialog } from "./scheduled-messages-dialog";

const lista = vi.mocked(useScheduledMessages);
const opcoes = vi.mocked(useScheduledMessageOptions);
const previa = vi.mocked(useScheduledMessagePreview);
const criar = vi.mocked(useCreateScheduledMessage);
const editar = vi.mocked(useUpdateScheduledMessage);
const cancelar = vi.mocked(useCancelScheduledMessage);

const cancelarMutate = vi.fn();

function montar() {
  render(
    <ScheduledMessagesDialog
      open
      onClose={() => {}}
      customerId="cli-1"
      customerName="Maria Silva"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  opcoes.mockReturnValue({
    data: { templates: [], variables: ["primeiro_nome"] },
  } as never);
  previa.mockReturnValue({ data: { preview: "", blockedReason: null } } as never);
  criar.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  editar.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  cancelar.mockReturnValue({ mutate: cancelarMutate, isPending: false } as never);
});

describe("ScheduledMessagesDialog", () => {
  it("mostra o estado de carregando", () => {
    lista.mockReturnValue({ isLoading: true } as never);
    montar();

    expect(screen.getByTestId("lembretes-carregando")).toBeInTheDocument();
  });

  it("mostra o estado de erro com ação de tentar de novo", () => {
    const refetch = vi.fn();
    lista.mockReturnValue({ isLoading: false, isError: true, refetch } as never);
    montar();

    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
  });

  it("mostra o estado vazio quando não há lembrete agendado", () => {
    lista.mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    montar();

    expect(screen.getByText(/nenhum lembrete agendado/i)).toBeInTheDocument();
  });

  it("lista o lembrete pendente com o motivo da falha quando houver", () => {
    lista.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: "sm-1",
          body: "Oi Maria",
          scheduledAt: "2099-01-01T12:00:00.000Z",
          scheduledDate: "2099-01-01",
          scheduledTime: "09:00",
          status: "FAILED",
          sentAt: null,
          failureReason: "Limite mensal de WhatsApp atingido.",
          createdByUser: { id: "u1", name: "Ana" },
        },
      ],
    } as never);
    montar();

    expect(screen.getByText(/Limite mensal de WhatsApp atingido/)).toBeInTheDocument();
  });

  it("cancelar pede confirmação no próprio item antes de chamar a API", async () => {
    lista.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: "sm-1",
          body: "Oi Maria",
          scheduledAt: "2099-01-01T12:00:00.000Z",
          scheduledDate: "2099-01-01",
          scheduledTime: "09:00",
          status: "PENDING",
          sentAt: null,
          failureReason: null,
          createdByUser: { id: "u1", name: "Ana" },
        },
      ],
    } as never);
    montar();

    await userEvent.click(screen.getByRole("button", { name: /cancelar lembrete/i }));
    expect(cancelarMutate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^sim, cancelar$/i }));
    expect(cancelarMutate).toHaveBeenCalledWith("sm-1", expect.anything());
  });

  it("avisa que o envio tem granularidade de ~10 minutos", async () => {
    lista.mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    montar();

    await userEvent.click(screen.getByRole("button", { name: /agendar lembrete/i }));

    expect(screen.getByText(/10 minutos/i)).toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/components/domain/notifications/scheduled-messages-dialog.test.tsx`
Esperado: FAIL — o componente não existe.

- [ ] **Passo 3: Implementar o componente**

Crie `src/components/domain/notifications/scheduled-messages-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ptBR } from "react-day-picker/locale";
import { AlertTriangle, CalendarIcon, Check, Clock, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppIcon } from "@/components/domain/vitrine/vitrine-icons";
import {
  useCancelScheduledMessage,
  useCreateScheduledMessage,
  useScheduledMessageOptions,
  useScheduledMessagePreview,
  useScheduledMessages,
  useUpdateScheduledMessage,
  type ScheduledMessageItem,
  type ScheduledMessageStatus,
} from "@/hooks/notifications/use-scheduled-messages";
import { toDateInputLocal } from "@/shared/utils/day-slots";

type Props = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
};

const ROTULO_DO_STATUS: Record<ScheduledMessageStatus, string> = {
  PENDING: "Agendado",
  SENDING: "Enviando",
  SENT: "Enviado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

const COR_DO_STATUS: Record<ScheduledMessageStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  SENDING: "bg-sky-50 text-sky-700 border-sky-200",
  SENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

/**
 * Recebe a data e a hora que o servidor JÁ converteu para o fuso do tenant. Nada de
 * `new Date(iso).toLocaleString()`: isso usaria o fuso do navegador e mostraria um
 * horário diferente do que a mensagem vai realmente sair.
 */
function formatarDataHora(scheduledDate: string, scheduledTime: string): string {
  const [ano, mes, dia] = scheduledDate.split("-");
  return `${dia}/${mes}/${ano} às ${scheduledTime}`;
}

function rotuloDaData(dateInput: string): string {
  if (!dateInput) return "Selecionar data";
  return new Date(`${dateInput}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ScheduledMessagesDialog({
  open,
  onClose,
  customerId,
  customerName,
}: Props) {
  const [modo, setModo] = useState<"lista" | "formulario">("lista");
  const [emEdicao, setEmEdicao] = useState<ScheduledMessageItem | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState<string | null>(null);

  const lista = useScheduledMessages(customerId);
  const cancelar = useCancelScheduledMessage(customerId);

  function voltarParaLista() {
    setModo("lista");
    setEmEdicao(null);
  }

  function fechar() {
    voltarParaLista();
    setConfirmandoCancelamento(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WhatsAppIcon className="size-5 text-emerald-600" />
            Lembretes de {customerName}
          </DialogTitle>
          <DialogDescription>
            Mensagens de WhatsApp que saem sozinhas na data e hora que você marcar.
          </DialogDescription>
        </DialogHeader>

        {modo === "formulario" ? (
          <FormularioDeLembrete
            customerId={customerId}
            emEdicao={emEdicao}
            onPronto={voltarParaLista}
            onCancelar={voltarParaLista}
          />
        ) : (
          <div className="space-y-3">
            {lista.isLoading && (
              <div data-testid="lembretes-carregando" className="space-y-2">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            )}

            {!lista.isLoading && lista.isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm text-red-700">
                  Não foi possível carregar os lembretes.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 min-h-11"
                  onClick={() => void lista.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            )}

            {!lista.isLoading && !lista.isError && (lista.data?.length ?? 0) === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <Clock className="mx-auto size-6 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">Nenhum lembrete agendado.</p>
              </div>
            )}

            {lista.data?.map((item) => (
              <div
                key={item.id}
                className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {formatarDataHora(item.scheduledDate, item.scheduledTime)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Agendado por {item.createdByUser.name}
                    </p>
                  </div>
                  <Badge className={`shrink-0 border ${COR_DO_STATUS[item.status]}`}>
                    {ROTULO_DO_STATUS[item.status]}
                  </Badge>
                </div>

                <p className="whitespace-pre-wrap rounded-lg rounded-tl-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                  {item.body}
                </p>

                {item.failureReason && (
                  <p className="flex items-start gap-1.5 text-xs text-red-600">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {item.failureReason}
                  </p>
                )}

                {item.status === "PENDING" &&
                  (confirmandoCancelamento === item.id ? (
                    // Confirmação inline: abrir um AlertDialog aqui empilharia dois
                    // Radix Dialog modais e travaria a tela.
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Cancelar este lembrete?</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="min-h-11"
                        disabled={cancelar.isPending}
                        onClick={() =>
                          cancelar.mutate(item.id, {
                            onSuccess: () => {
                              setConfirmandoCancelamento(null);
                              toast.success("Lembrete cancelado");
                            },
                            onError: (erro) =>
                              toast.error(
                                erro instanceof Error ? erro.message : "Erro ao cancelar",
                              ),
                          })
                        }
                      >
                        <Check className="size-4" />
                        Sim, cancelar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => setConfirmandoCancelamento(null)}
                      >
                        Voltar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          setEmEdicao(item);
                          setModo("formulario");
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setConfirmandoCancelamento(item.id)}
                      >
                        <X className="size-4" />
                        Cancelar lembrete
                      </Button>
                    </div>
                  ))}
              </div>
            ))}

            <Button
              className="min-h-11 w-full"
              onClick={() => {
                setEmEdicao(null);
                setModo("formulario");
              }}
            >
              <Plus className="size-4" />
              Agendar lembrete
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type FormularioProps = {
  customerId: string;
  emEdicao: ScheduledMessageItem | null;
  onPronto: () => void;
  onCancelar: () => void;
};

function FormularioDeLembrete({
  customerId,
  emEdicao,
  onPronto,
  onCancelar,
}: FormularioProps) {
  const [texto, setTexto] = useState(emEdicao?.body ?? "");
  // Vêm prontos do servidor, no fuso do tenant, e voltam iguais no PATCH — nenhuma
  // conversão acontece aqui.
  const [data, setData] = useState(emEdicao?.scheduledDate ?? "");
  const [hora, setHora] = useState(emEdicao?.scheduledTime ?? "");
  const [calendarioAberto, setCalendarioAberto] = useState(false);

  const opcoes = useScheduledMessageOptions(true);
  const previa = useScheduledMessagePreview(
    { customerId, body: texto },
    texto.trim().length > 0,
  );
  const criar = useCreateScheduledMessage(customerId);
  const editar = useUpdateScheduledMessage(customerId);

  const salvando = criar.isPending || editar.isPending;
  const podeSalvar = texto.trim().length > 0 && data !== "" && hora !== "" && !salvando;

  function inserirVariavel(nome: string) {
    setTexto((atual) => `${atual}{{${nome}}}`);
  }

  function salvar() {
    const entrada = { body: texto.trim(), date: data, time: hora };
    const aoDarErro = (erro: unknown) =>
      toast.error(erro instanceof Error ? erro.message : "Erro ao salvar o lembrete");

    if (emEdicao) {
      editar.mutate(
        { id: emEdicao.id, ...entrada },
        {
          onSuccess: () => {
            toast.success("Lembrete atualizado");
            onPronto();
          },
          onError: aoDarErro,
        },
      );
      return;
    }

    criar.mutate(entrada, {
      onSuccess: () => {
        toast.success("Lembrete agendado");
        onPronto();
      },
      onError: aoDarErro,
    });
  }

  return (
    <div className="space-y-4">
      {opcoes.data && opcoes.data.templates.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="modelo-lembrete">Começar de uma mensagem pronta</Label>
          <select
            id="modelo-lembrete"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value=""
            onChange={(e) => {
              const modelo = opcoes.data?.templates.find((t) => t.event === e.target.value);
              if (modelo) setTexto(modelo.body);
            }}
          >
            <option value="">Escrever do zero</option>
            {opcoes.data.templates.map((modelo) => (
              <option key={modelo.event} value={modelo.event}>
                {modelo.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="texto-lembrete">Mensagem</Label>
        <Textarea
          id="texto-lembrete"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva o que a cliente vai receber..."
          maxLength={1500}
          className="min-h-30 resize-none"
        />
        {/* Faixa rolável sem `touch-pan-x`: essa classe trava o scroll vertical no mobile. */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {opcoes.data?.variables.map((variavel) => (
            <Button
              key={variavel}
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 shrink-0 text-xs"
              onClick={() => inserirVariavel(variavel)}
            >
              {`{{${variavel}}}`}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 gap-3">
        <div className="w-3/5 min-w-0 space-y-2">
          <Label htmlFor="data-lembrete">Data</Label>
          <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
            <PopoverTrigger asChild>
              <Button
                id="data-lembrete"
                type="button"
                variant="outline"
                className="min-h-11 w-full min-w-0 justify-start gap-2 font-normal"
              >
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{rotuloDaData(data)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                className="[--cell-size:2.75rem]"
                locale={ptBR}
                defaultMonth={data ? new Date(`${data}T00:00:00`) : undefined}
                selected={data ? new Date(`${data}T00:00:00`) : undefined}
                onSelect={(d) => {
                  if (!d) return;
                  setData(toDateInputLocal(d));
                  setCalendarioAberto(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-2/5 min-w-24 space-y-2">
          <Label htmlFor="hora-lembrete">Horário</Label>
          <Input
            id="hora-lembrete"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="min-h-11 px-1.5"
          />
        </div>
      </div>

      {/* Honestidade sobre a granularidade real: o cron roda a cada 10 minutos. */}
      <p className="text-xs text-slate-500">
        O envio é verificado a cada 10 minutos, então a mensagem pode sair alguns minutos
        depois do horário escolhido — nunca antes.
      </p>

      {previa.data?.blockedReason && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {previa.data.blockedReason}
        </p>
      )}

      {previa.data?.preview && (
        <div className="space-y-1">
          <Label>Como a cliente vai ver</Label>
          <div className="whitespace-pre-wrap rounded-xl rounded-tl-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            {previa.data.preview}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 flex gap-2 bg-white pt-2">
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          onClick={onCancelar}
          disabled={salvando}
        >
          Voltar
        </Button>
        <Button className="min-h-11 flex-1" onClick={salvar} disabled={!podeSalvar}>
          {salvando ? "Salvando..." : emEdicao ? "Salvar alterações" : "Agendar"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npx vitest run src/components/domain/notifications/scheduled-messages-dialog.test.tsx`
Esperado: 6 testes PASS.

Se o `Calendar` explodir no jsdom, confira que o `ResizeObserver` do
`src/shared/test/setup.ts` está ativo — nenhum teste deste arquivo abre o popover.

- [ ] **Passo 5: Conferir a importação de `ptBR` e `toDateInputLocal`**

Rode: `grep -n "react-day-picker/locale\|toDateInputLocal" src/components/domain/scheduling/create-appointment-modal.tsx`
Confirme que os caminhos batem com os usados aqui. Se o modal importar `ptBR` de outro lugar,
use o mesmo caminho — não invente.

- [ ] **Passo 6: tsc**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

- [ ] **Passo 7: Commit**

```bash
git add src/components/domain/notifications/scheduled-messages-dialog.tsx src/components/domain/notifications/scheduled-messages-dialog.test.tsx
git commit -m "feat(notifications): dialog de lembretes agendados por cliente"
```

---

## Task 11: Botão de lembrete na ficha da cliente

O ponto de entrada é um botão de WhatsApp **à direita do nome**, com referência explícita a
lembrete e um contador de quantos estão agendados. Não é uma aba nova.

**Arquivos:**
- Modificar: `src/components/domain/crm/customer-profile-header.tsx`
- Criar: `src/components/domain/crm/customer-profile-header.test.tsx`
- Modificar: `src/app/(app)/clientes/[id]/page.tsx`

**Interfaces:**
- Consome: `useScheduledMessages` (Task 9), `<ScheduledMessagesDialog>` (Task 10), `WhatsAppIcon`.
- Produz: `CustomerProfileHeader` passa a aceitar `onScheduleMessage?: () => void` e `scheduledCount?: number`. Ambos opcionais — nenhum outro chamador quebra.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `src/components/domain/crm/customer-profile-header.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CustomerProfileHeader } from "./customer-profile-header";

const BASE = {
  id: "cli-1",
  name: "Maria Silva",
  phone: "11999990000",
  email: null,
  tags: [],
  notes: null,
  noShowCount: 0,
  isBlocked: false,
  blockedReason: null,
  deletedAt: null,
  appointments: [],
};

function montar(extra: Record<string, unknown> = {}) {
  const onScheduleMessage = vi.fn();
  render(
    <CustomerProfileHeader
      customer={{ ...BASE, ...extra } as never}
      onScheduleMessage={onScheduleMessage}
      scheduledCount={(extra.scheduledCount as number) ?? 0}
    />,
  );
  return { onScheduleMessage };
}

describe("CustomerProfileHeader — botão de lembrete", () => {
  it("mostra o botão ao lado do nome e dispara o callback", async () => {
    const { onScheduleMessage } = montar();

    const botao = screen.getByRole("button", { name: /lembrete/i });
    await userEvent.click(botao);

    expect(onScheduleMessage).toHaveBeenCalledTimes(1);
  });

  it("não oferece o botão para cliente sem telefone — não há como entregar", () => {
    montar({ phone: null });

    expect(screen.queryByRole("button", { name: /lembrete/i })).not.toBeInTheDocument();
  });

  it("mostra quantos lembretes estão agendados", () => {
    montar({ scheduledCount: 3 });

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("sem lembrete agendado, não mostra contador zerado", () => {
    montar({ scheduledCount: 0 });

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/components/domain/crm/customer-profile-header.test.tsx`
Esperado: FAIL — o componente não aceita `onScheduleMessage` e não renderiza botão nenhum.

- [ ] **Passo 3: Implementar no header**

Em `src/components/domain/crm/customer-profile-header.tsx`:

1. Acrescente aos imports:

```tsx
import { Button } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/domain/vitrine/vitrine-icons'
```

2. Troque o tipo `Props` por:

```tsx
type Props = {
  customer: CustomerProfile
  /** Abre o painel de lembretes. Ausente = o botão não aparece. */
  onScheduleMessage?: () => void
  /** Quantos lembretes ainda vão sair, para o contador no botão. */
  scheduledCount?: number
}
```

3. Troque a assinatura do componente:

```tsx
export function CustomerProfileHeader({
  customer,
  onScheduleMessage,
  scheduledCount = 0,
}: Props) {
```

4. Dentro do `<div className="flex flex-wrap items-center gap-2">`, **logo depois** do `<h2>`:

```tsx
            {onScheduleMessage && customer.phone && (
              <Button
                variant="outline"
                size="sm"
                onClick={onScheduleMessage}
                className="min-h-11 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <WhatsAppIcon className="size-4" />
                Lembrete
                {scheduledCount > 0 && (
                  <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">
                    {scheduledCount}
                  </span>
                )}
              </Button>
            )}
```

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npx vitest run src/components/domain/crm/customer-profile-header.test.tsx`
Esperado: 4 testes PASS.

- [ ] **Passo 5: Ligar na página da cliente**

Em `src/app/(app)/clientes/[id]/page.tsx`:

1. Acrescente aos imports:

```tsx
import { ScheduledMessagesDialog } from '@/components/domain/notifications/scheduled-messages-dialog'
import { useScheduledMessages } from '@/hooks/notifications/use-scheduled-messages'
```

2. Junto aos outros `useState`, acrescente:

```tsx
  const [lembretesOpen, setLembretesOpen] = useState(false)
```

3. Depois de `const { mutate: restore, isPending: isRestoring } = useRestoreCustomer(id)`:

```tsx
  // A lista alimenta tanto o contador do botão quanto o dialog — uma requisição só,
  // servida do cache do TanStack Query nos dois lugares.
  const { data: lembretes } = useScheduledMessages(id)
  const lembretesPendentes =
    lembretes?.filter((lembrete) => lembrete.status === 'PENDING').length ?? 0
```

4. Troque a renderização do header por:

```tsx
      <CustomerProfileHeader
        customer={customer}
        onScheduleMessage={() => setLembretesOpen(true)}
        scheduledCount={lembretesPendentes}
      />
```

5. Ao lado dos outros dialogs (logo depois de `<CreateAppointmentModal ... />`):

```tsx
      <ScheduledMessagesDialog
        open={lembretesOpen}
        onClose={() => setLembretesOpen(false)}
        customerId={id}
        customerName={customer.name}
      />
```

- [ ] **Passo 6: Checklist mobile — conferir de fato, não presumir**

Abra o app (`npm run dev`), vá a `/clientes/<id>` e, com o DevTools em 390×844:

1. O botão "Lembrete" fica visível ao lado do nome, sem estourar a largura (o
   `flex-wrap` do container permite quebrar de linha).
2. O alvo de toque tem no mínimo 44px de altura (`min-h-11`).
3. O dialog abre com rolagem interna (`max-h-[85vh] overflow-y-auto`) e o rodapé de ações
   do formulário fica alcançável sem rolar até o fim.
4. O calendário abre dentro da viewport.
5. A faixa de chips de variável rola na horizontal **sem** travar o scroll vertical da página.

Anote o que não passar e corrija antes de commitar.

- [ ] **Passo 7: tsc e suíte**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

Rode: `npx vitest run src/components/domain/crm/ src/components/domain/notifications/`
Esperado: verde, exceto `customer-history-client.test.tsx` (×2), que já falhava antes.

- [ ] **Passo 8: Commit**

```bash
git add src/components/domain/crm/customer-profile-header.tsx src/components/domain/crm/customer-profile-header.test.tsx "src/app/(app)/clientes/[id]/page.tsx"
git commit -m "feat(crm): botao de lembrete na ficha da cliente"
```

---

## Task 12: Documentação

A spec descreve a Fase 4 como "uma `Campaign` com `scheduledAt`". Esse model não existe e
não vai existir nesta entrega. Deixar a spec como está é deixar uma armadilha para quem
pegar a Fase 3.

**Arquivos:**
- Modificar: `docs/superpowers/specs/2026-07-26-motor-mensagens-cliente-design.md` (§8 e §14)
- Modificar: `docs/decisions.md` (ADR-019)
- Modificar: `src/domains/notifications/DOMAIN.md`
- Modificar: `docs/handoff-motor-mensagens-fases-2-5.md`
- Modificar: `CLAUDE.md`

- [ ] **Passo 1: Reescrever a §8 da spec**

Substitua a seção inteira `## 8. Fase 4 — Mensagens agendadas` (da linha do título até a
linha `---` que a fecha) por:

```markdown
## 8. Mensagens agendadas

> **Recorte revisado em 2026-07-31.** O desenho original desta seção dizia "não requer model
> próprio: é uma `Campaign` com `scheduledAt`". Isso amarrava a entrega à Fase 3, que não foi
> implementada — o model `Campaign` não existe. O caso um-para-um foi separado e entregue
> antes, com model próprio. Ver ADR-019.

**O caso um-para-um (entregue):** o profissional escolhe uma cliente, escreve o texto, marca
data e hora, e o sistema entrega. Model `ScheduledMessage` — uma mensagem, uma cliente, um
horário. Não é campanha: não tem segmento, nem destinatários múltiplos, nem throttle.

- `scheduledAt` é gravado em UTC, convertido a partir de data e hora **locais do tenant**,
  sempre no service, nunca no componente — o formulário manda `date` e `time` separados
  justamente para tornar impossível uma conversão acidental no fuso do navegador.
- A entrega roda dentro do `/api/cron/tick`, chamada direta (não é job do pg-boss). Cada
  linha é reivindicada por um update atômico `PENDING → SENDING`; quem perde a corrida
  desiste. Reprocessar um lote nunca envia duas vezes.
- Granularidade real de ~10 minutos, herdada do workflow do cron. A UI diz isso ao usuário
  em vez de prometer precisão ao minuto.
- Uma tentativa, sem retry. Falha vira `FAILED` com o motivo vindo do `NotificationLog`,
  visível na lista. Linha presa em `SENDING` por mais de 15 minutos é derrubada para
  `FAILED` na varredura seguinte.
- O envio passa por `customerMessageDispatcherService.dispatch()` num modo `direct`: texto
  livre, canal explícito, sem consultar o liga/desliga por evento — quem escreveu e marcou
  a hora já decidiu enviar.
- O texto pode partir de um template do catálogo ou ser escrito do zero, e aceita
  `{{variaveis}}`, interpoladas no envio com a mesma função da prévia.
- Canal: só WhatsApp na v1. O campo `channel` já existe no model para o e-mail plugar depois
  sem migration.
- Entrada pela ficha da cliente: botão de WhatsApp ao lado do nome, com contador de
  lembretes agendados.

**O caso um-para-muitos (Fase 3):** campanha agendada continua sendo `Campaign` com
`scheduledAt`, como esta seção descrevia. Quando a Fase 3 chegar, ela deve **reusar a máquina
de agendamento** já entregue — o par `claim` atômico + varredura no tick —, não criar uma
segunda. O que a campanha acrescenta é o que ela tem de próprio: segmento, throttle, janela
de horário e teste obrigatório.
```

- [ ] **Passo 2: Atualizar a tabela de fases (§14)**

Substitua a tabela inteira de `## 14. Fases de entrega` por:

```markdown
| # | Entrega | Depende de | Status |
|---|---|---|---|
| 1 | Catálogo, models, migration + backfill, remoção de todo o hardcode, aba de templates | — | ✅ entregue |
| 2 | Toggles por evento, flag nos 10 pontos de disparo, modal de no-show, fluxo `appointment_requested` | 1 | ✅ entregue |
| 3 | Campanhas: segmentos, editor com mídia, fila throttled, opt-out, teste obrigatório, relatório, permissão `mensagens`, gate `campaigns` | 1, 2 | pendente |
| 4 | **Mensagem agendada um-a-um** (model `ScheduledMessage`, entrega pelo tick, UI na ficha da cliente) | 1, 2 | ✅ entregue |
| 4b | Campanha agendada — `Campaign` com `scheduledAt`, reusando a máquina de agendamento da fase 4 | 3, 4 | pendente |
| 5 | Confirmação por resposta, retorno programado, reconquista | 2, 3 | pendente |

> A fase 4 foi **antecipada** e desacoplada da 3: o caso um-para-um não precisa de segmento
> nem de throttle, e entregar valor sozinho não dependia da campanha existir. O que sobrou
> da fase 4 original virou 4b. Ver ADR-019.
```

- [ ] **Passo 3: Escrever o ADR-019**

No fim de `docs/decisions.md`:

```markdown
## ADR-019 — Mensagem agendada um-a-um com model próprio, fora do caminho de campanha (2026-07-31)

**Data**: 2026-07-31
**Status**: Aceito

**Contexto**: A §8 da spec do motor de mensagens definia mensagem agendada como "uma `Campaign` com `scheduledAt`" — sem model próprio. Só que `Campaign` pertence à Fase 3, que não foi implementada: o model não existe. Seguir a spec ao pé da letra exigiria entregar campanhas segmentadas inteiras (segmento, throttle, janela de horário, opt-out, teste obrigatório, permissão nova, promoção da capability `campaigns` a `ga`) antes de conseguir agendar um único lembrete para uma única cliente — que é a demanda real e cabe numa fração do esforço.

**Decisão**:

1. **Model próprio `ScheduledMessage`, não `Campaign`.** Uma mensagem, uma cliente, um horário. Sem segmento, sem destinatários múltiplos, sem throttle. A abstração de campanha não foi antecipada (YAGNI): quando a Fase 3 chegar, a campanha reusa a **máquina de agendamento** — `claim` atômico + varredura no tick — em vez de duplicá-la.

2. **`scheduledAt` sempre no fuso do tenant, garantido pelo formato do contrato.** A API recebe `date` (`YYYY-MM-DD`) e `time` (`HH:mm`) **separados**, nunca um instante ISO, e converte com `localDateTimeToUtc(date, time, tenant.timezone)` no service. Um ISO vindo do navegador já teria sido convertido no fuso do usuário — que é exatamente o bug que a PR #278 corrigiu no resumo diário da equipe. O formato do contrato torna o erro impossível, em vez de depender de disciplina.

3. **Idempotência por reivindicação atômica na própria tabela, não por fila.** Cada linha vencida é reivindicada com `updateMany({ where: { id, status: "PENDING" }, data: { status: "SENDING" } })`; só quem recebe `count === 1` envia. Por isso a varredura é uma **chamada direta** dentro do `/api/cron/tick` e não um job do pg-boss: o tick é o único worker e busca um job por vez, então enfileirar a cada 10 minutos só criaria backlog, sem acrescentar nenhuma garantia que o claim já não desse.

4. **Uma tentativa, `FAILED` terminal.** Falha registra o motivo real vindo do `NotificationLog` e para. Retry automático arriscaria mensagem duplicada quando o provedor entrega mas responde erro — e uma mensagem duplicada para a cliente é pior do que uma que não saiu, porque a profissional consegue ver a falha na lista e reagendar. Uma varredura derruba para `FAILED` o que ficar preso em `SENDING` por mais de 15 minutos.

5. **Modo `direct` no dispatcher, em vez de um evento novo no catálogo.** Mensagem avulsa não passa pelo liga/desliga por evento (quem escreveu e marcou a hora já decidiu enviar) e tem canal explícito. Um evento novo no catálogo obrigaria a mexer no enum `CustomerMessageEvent` (migration) e faria a mensagem avulsa aparecer como 11ª linha na matriz de configuração, onde um toggle poderia cancelar silenciosamente um envio explícito.

6. **Permissão reusada (`clientes:view`/`clientes:edit`), não `mensagens`.** A permissão `mensagens` da §10 da spec nasce junto com as campanhas, onde ela realmente pesa — poder disparar para a base inteira. Para uma mensagem a uma cliente específica, quem já pode editar aquela cliente pode falar com ela.

**Alternativas rejeitadas**:
- **Implementar `Campaign` só para ter `scheduledAt`**: carregaria segmento, `CampaignRecipient`, throttle e opt-out — subsistemas inteiros — para atender um caso que não usa nenhum deles.
- **Job do pg-boss para a varredura**: ver Decisão 3.
- **Retry com contador de tentativas**: ver Decisão 4.
- **Evento `custom_message` no catálogo**: ver Decisão 5.

**Consequências**:
- **Migration `20260731120000_add_scheduled_message` precisa ser aplicada manualmente em produção**: `npx prisma migrate deploy`, porta **5432** do Supabase (a 6543 trava em DDL). **Não há backfill** — a tabela nasce vazia e nenhum comportamento existente muda.
- A migration foi **escrita à mão** e depois conferida contra o schema real de produção com `prisma migrate diff --from-config-datasource` — a saída bate exatamente com o SQL escrito. Ela ainda não foi *executada*: isso só acontece no `migrate deploy` da janela de produção.
- **Achado colateral:** o `DIRECT_URL` não existia nesta máquina, e o CLI do Prisma caía num túnel local morto (`P1001`) — era por isso que "o banco estava indisponível". Com a variável apontando para o pooler na porta 5432, ficou registrado que **todo comando do Prisma CLI aqui fala com produção**: `migrate dev`, `migrate reset` e `db push` passam a ser proibidos, porque não há banco local para absorver o erro.
- **Drift pré-existente detectado e deixado de fora:** produção tem o índice `UserNotificationPreference_tenantId_userId_eventType_channel_ke`, enquanto o schema espera `..._channe_key` (truncamento diferente, herdado da migration de notificações da equipe). Aparece em qualquer `migrate diff` e **não** foi corrigido aqui — é escopo de outra PR.
- `CustomerMessageDispatchResult` ganhou o campo `logs` (id, status e `errorMessage` por canal). Nenhum chamador existente quebrou, mas testes que comparavam o resultado inteiro com `toEqual` precisaram do campo novo.
- `motivoDeBloqueio`, que era privada da rota de prévia da Fase 2, virou `customerMessageBlockedReason` em `customer-messages/customer-message-delivery.ts`, consumida pelas duas rotas de prévia.
- A precisão do envio é de ~10 minutos, herdada do workflow do cron. A UI diz isso explicitamente; aumentar a precisão é aumentar a frequência do workflow (mínimo de 5 minutos no GitHub Actions).
```

- [ ] **Passo 4: Atualizar o `DOMAIN.md`**

Em `src/domains/notifications/DOMAIN.md`, logo antes da seção `## Transacional × promocional`:

```markdown
## Mensagem agendada (um-a-um)

`scheduled-messages/` — o profissional marca uma mensagem para uma cliente numa data e hora.

```
formulário (date + time locais)
   ↓ conversão para UTC com o fuso do TENANT, no service
ScheduledMessage (PENDING)
   ↓ /api/cron/tick, a cada ~10 min
claim atômico PENDING → SENDING   ← a idempotência mora aqui
   ↓ interpola {{variaveis}} com buildCustomerMessageVariables
customerMessageDispatcher.dispatch({ kind: "direct" })
   ↓
SENT (+ notificationLogId) ou FAILED (+ motivo do NotificationLog)
```

Uma tentativa, sem retry. Linha presa em `SENDING` por mais de 15 min vira `FAILED`.
Não é `Campaign` — ver ADR-019. Quando as campanhas chegarem, devem reusar esta máquina.
```

- [ ] **Passo 5: Atualizar o handoff**

Em `docs/handoff-motor-mensagens-fases-2-5.md`:

1. No cabeçalho, acrescente depois da linha da Fase 2:

```markdown
**Fase 4 (recorte um-a-um):** ✅ entregue — migration `20260731120000_add_scheduled_message` **pendente de aplicação manual** em produção
```

2. Substitua o bloco `### Fase 4 — Mensagens agendadas` por:

```markdown
### Fase 4 — Mensagens agendadas
**Recorte um-a-um: ✅ entregue.** Model `ScheduledMessage`, varredura no `/api/cron/tick`,
UI na ficha da cliente. Ver ADR-019 e a §8 reescrita da spec.

**Falta (4b):** campanha agendada — `Campaign` com `scheduledAt`. Depende da Fase 3, e deve
**reusar** a máquina de agendamento já entregue (claim atômico + varredura no tick), não
criar uma segunda.
```

3. Acrescente à seção "Armadilhas que já custaram tempo aqui":

```markdown
**`dispatch()` não diz se a mensagem saiu.** `dispatched` só registra que a gravação do log
não explodiu — o status real (SENT/FAILED/PENDING) mora no `NotificationLog`. Quem precisa
saber se a entrega aconteceu lê `result.logs`, não `result.dispatched`.
```

- [ ] **Passo 6: Atualizar o `CLAUDE.md`**

Na tabela de status dos domínios, no fim da célula de **Notifications**, acrescente:

```markdown
**Mensagem agendada um-a-um (ADR-019, 2026-07-31):** model `ScheduledMessage` (uma mensagem, uma cliente, uma data/hora — **não** `Campaign`, que segue inexistente); `scheduledAt` gravado em UTC a partir de `date`+`time` locais convertidos no service com o fuso do tenant (a API recebe data e hora separadas justamente para impedir conversão no fuso do navegador); entrega por chamada direta dentro do `/api/cron/tick` (não é job do pg-boss — a idempotência já vem do `claim` atômico `PENDING → SENDING` na própria tabela, e enfileirar só criaria backlog), com granularidade real de ~10 min que a UI declara em vez de esconder; uma tentativa, `FAILED` terminal com o motivo vindo do `NotificationLog`, e varredura que derruba `SENDING` preso há mais de 15 min; envio pelo `customerMessageDispatcher.dispatch()` num modo novo `kind: "direct"` (texto livre, canal explícito, sem consultar o liga/desliga por evento — quem agendou já decidiu enviar), que também passou a devolver `logs` com id/status/erro por canal; texto pode partir de um template do catálogo ou ser escrito do zero e aceita `{{variaveis}}` interpoladas no envio com a mesma função da prévia; canal só WhatsApp na v1 (campo `channel` já existe para e-mail plugar sem migration); permissão reusada `clientes:view`/`clientes:edit` (a `mensagens` da spec fica para a Fase 3); UI é um botão de WhatsApp com contador ao lado do nome na ficha da cliente, abrindo dialog único com lista + formulário (confirmação de cancelamento inline, sem Dialog aninhado); `motivoDeBloqueio` da rota de prévia da Fase 2 virou `customerMessageBlockedReason` compartilhada.
```

E na seção "Próximo passo crítico", acrescente ao bloco de avisos:

```markdown
> ⚠️ 2026-07-31: mensagem agendada um-a-um (ADR-019). Migration `20260731120000_add_scheduled_message` **pendente de aplicação manual** em produção: `npx prisma migrate deploy` na porta **5432**. **Não há backfill** — a tabela nasce vazia e nenhum comportamento existente muda. A migration foi escrita à mão (banco local indisponível) e nunca rodou contra um Postgres real — validar antes do merge.
```

- [ ] **Passo 6b: Corrigir os avisos desatualizados sobre a migration da Fase 2**

Em 2026-07-31 o `prisma migrate status` confirmou 62 de 62 migrations aplicadas em produção,
incluindo `20260727120000_add_customer_message_setting`. Os dois avisos de "pendente"
viraram informação falsa — e informação falsa sobre migration faz alguém tentar aplicar de
novo.

1. No `CLAUDE.md`, na seção "Próximo passo crítico", troque o marcador da linha que começa
   com `⚠️ 2026-07-27: motor de mensagens ao cliente — Fase 2 (ADR-018).` de `⚠️` para `✅` e
   substitua "**pendente de aplicação manual** em produção: `npx prisma migrate deploy`" por:

```markdown
**aplicada em produção** (confirmado em 2026-07-31 com `prisma migrate status`: 62/62, schema em dia).
```

2. No `docs/handoff-motor-mensagens-fases-2-5.md`, no cabeçalho, troque
   "migration `20260727120000_add_customer_message_setting` **pendente de aplicação manual**
   em produção" por "migration `20260727120000_add_customer_message_setting` **aplicada em
   produção** (confirmado em 2026-07-31)".

3. Ainda no handoff, acrescente à seção "Armadilhas que já custaram tempo aqui":

```markdown
**`P1001` do Prisma CLI quase nunca é o Supabase fora do ar.** Em 2026-07-31 o erro era
`DIRECT_URL` inexistente: o `prisma.config.ts` caía no fallback `DATABASE_URL`, que apontava
para um túnel local morto. A correção é um `.env.local` (fora do git) com `DIRECT_URL` no
pooler, porta **5432**. Depois disso, atenção: **todo comando do Prisma CLI passa a falar com
produção** — `migrate dev`, `migrate reset` e `db push` viram proibidos, sem rede de proteção.
```

- [ ] **Passo 7: Conferir que a spec não fala mais de `Campaign` como solução do caso um-a-um**

Rode: `grep -n "Campaign" docs/superpowers/specs/2026-07-26-motor-mensagens-cliente-design.md`
Esperado: as ocorrências restantes são todas da **§7 (Fase 3)** e da §4.2, mais a menção
explícita a "campanha agendada (4b)" na §8. Nenhuma delas pode descrever o caso um-para-um.

- [ ] **Passo 8: Commit**

```bash
git add docs/ CLAUDE.md src/domains/notifications/DOMAIN.md
git commit -m "docs(notifications): ADR-019, recorte da fase 4 na spec e estado das fases"
```

---

## Fechamento

- [ ] **Verificação final**

Rode: `npx tsc --noEmit`
Esperado: zero erros.

Rode: `npx vitest run`
Esperado: verde, com exatamente as 4 falhas pré-existentes listadas nas Constraints globais —
nenhuma a mais. Se aparecer uma quinta, ela é desta entrega e precisa ser corrigida.

- [ ] **Abrir a PR**

```bash
git push -u origin feat/mensagem-agendada-um-a-um
gh pr create --base main --title "feat(notifications): mensagem agendada um-a-um" --body "..."
```

O corpo da PR precisa conter, no mínimo:

- o resumo do que foi entregue;
- o **runbook de produção**: aplicar `20260731120000_add_scheduled_message` com
  `npx prisma migrate deploy` na porta **5432**, **sem backfill** (a tabela nasce vazia e
  nenhum comportamento existente muda);
- a saída do `migrate diff` do Passo 6 da Task 1, como evidência de que a migration confere
  com o schema real;
- o registro do **drift pré-existente** do índice `UserNotificationPreference`, deixado de
  fora de propósito, para virar issue própria;
- a lista das 4 falhas de teste pré-existentes.
