# Central de Notificações da Equipe — Motor (Fase 1, parte backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o disparo de notificações da equipe (`notifyAppointment`/`notifyCustomerCreated`, fire-and-forget) por um motor genérico orientado a `eventType`, com modelo de dados configurável (negócio + colaborador), entrega in-app imediata, e-mail confiável via fila durável (`pg-boss` + `/api/cron/tick`), motor de templates com variáveis, e anti-fadiga (quiet hours + modo digest).

**Architecture:** Expande o submódulo `src/domains/notifications/user-notifications/` (Abordagem A do spec). Três tabelas novas (`TenantNotificationSetting`, `UserNotificationPreference`, `NotificationTemplate`) guardam configuração; um resolvedor de canais puro decide, por destinatário, se cada evento vira notificação in-app (grava na hora) e/ou e-mail (enfileira job durável, nunca envia inline). Um dispatcher genérico substitui o service atual e é o único ponto que orquestra: candidatos → resolução de canais → gravação in-app → enfileiramento de e-mail. Dois jobs novos (`team-notification-email`, `team-daily-digest`) processam a fila e o resumo diário via o tick já existente.

**Tech Stack:** Next.js 15 (API Routes), Prisma/PostgreSQL, pg-boss (fila sobre o Postgres), Resend (e-mail), Vitest.

Este plano cobre **apenas o backend** (dados, dispatcher, jobs, motor de templates). A aba **Configurações › Notificações** (UI, editor de templates, permissões de tela) é um plano separado, a escrever em seguida — ver nota em "Fora de escopo" abaixo. Essa divisão existe porque o backend sozinho já entrega o objetivo mais urgente do spec (parar de perder e-mail em serverless) e é testável/revisável de forma independente; a UI depende dele e some razão para portar em dois PRs.

## Global Constraints

- Todo código, comentário, nome de branch, mensagem de commit e teste em Português do Brasil (CLAUDE.md).
- `tenantId` sempre extraído do contexto de sessão/evento — nunca do body. Toda query nova filtra por `tenantId`.
- Nunca usar `throw new Error('string genérica')` — sempre erros tipados de `src/shared/errors/`. Este plano não precisa de erro novo (nenhuma rota HTTP nova é criada aqui), mas qualquer ponto de falha deve degradar (log + continue), nunca derrubar o fluxo de negócio ou o job inteiro.
- **Não** adicionar os 3 campos novos do `User` (`notificationDeliveryMode`, `quietHoursStart`, `quietHoursEnd`) ao `select` de `getCurrentUser`/sessão (`iam.service.ts`) — regra aprendida em incidente anterior: coluna nova acoplada à query de sessão + migration atrasada em produção = logout global (P2022, já aconteceu 2×). Esses campos só serão lidos pelos jobs/dispatcher, nunca pela sessão.
- Migração é **aditiva** apenas: enums/models novos, campos novos com default, nenhum drop. Os 3 booleans legados (`notifyEmailAppointments`, `notifyOwnAppointments`, `notifyTeamAppointments`) continuam existindo e sendo lidos — não remover nesta entrega.
- `npx tsc --noEmit` limpo e `npx vitest run` passando antes de qualquer commit final.
- Falha de e-mail (Resend indisponível, etc.) nunca deve derrubar o job pg-boss inteiro nem o fluxo de negócio — sempre `try/catch` + `console.error` por destinatário, como já é o padrão do módulo.

### Decisão de escopo explícita (leia antes de implementar)

O spec (seção 3.1) diz que os 3 booleans legados serão totalmente substituídos. Ao desenhar o modelo, uma nuance apareceu: `notifyOwnAppointments` (colaborador quer ser avisado quando ele mesmo cria o agendamento) e `notifyTeamAppointments` (gestor quer ser avisado de agendamentos de outros) não têm um campo equivalente no modelo novo do spec (que só define overrides de canal `EMAIL`, nunca de `IN_APP`). Decisão para este plano:

- `notifyEmailAppointments` **migra** para `UserNotificationPreference` (override de canal `EMAIL`) via script de backfill — é o único boolean com equivalente direto no modelo novo.
- `notifyOwnAppointments` e `notifyTeamAppointments` **continuam sendo lidos diretamente do `User`** pelo dispatcher, exatamente como hoje (regra de auto-skip e opt-out de gestor). Eles não viram linhas em `UserNotificationPreference` porque IN_APP não é overridable nesse modelo — só remova essa leitura direta quando (fase futura) o spec definir um campo equivalente.
- Isso é uma correção de ambiguidade do spec, não um desvio de comportamento: nenhum destinatário passa a receber notificação que não devia.

## Visão geral de arquivos

```
prisma/schema.prisma                                                          [modificar]
prisma/migrations/20260713120000_add_team_notification_settings/migration.sql [criar, gerado]
scripts/backfill-team-notification-preferences.mjs                            [criar]

src/domains/notifications/user-notifications/
  types.ts                                    [modificar]
  notification-view.ts                        [modificar]
  system-default-templates.ts                 [criar]
  notification-template-engine.ts             [criar] + .test.ts
  tenant-notification-setting.repository.ts   [criar] + .test.ts
  user-notification-preference.repository.ts  [criar] + .test.ts
  notification-template.repository.ts         [criar] + .test.ts
  notification-channel-resolver.ts            [criar] + .test.ts
  user-notification.repository.ts             [modificar] + .test.ts (adicionar casos)
  team-notification-dispatcher.service.ts     [criar] + .test.ts
  user-notification.service.ts                [modificar] + .test.ts (remover casos antigos)
  user-notifications.subscriptions.ts         [modificar]

src/shared/queue/jobs/
  team-notification-email.ts   [criar] + .test.ts
  team-daily-digest.ts         [criar] + .test.ts

src/app/api/cron/tick/route.ts  [modificar]
docs/decisions.md               [modificar]
```

---

### Task 1: Schema Prisma — enums, 3 models novos, campos em `User`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260713120000_add_team_notification_settings/migration.sql` (gerado pelo Prisma, não escrito à mão)

**Interfaces:**
- Produces: enums `NotificationEventType`, `TeamNotificationChannel`; models `TenantNotificationSetting`, `UserNotificationPreference`, `NotificationTemplate`; campos `User.notificationDeliveryMode` (`String`, default `"realtime"`), `User.quietHoursStart` (`Int?`), `User.quietHoursEnd` (`Int?`).

- [ ] **Step 1: Adicionar os 2 enums novos**, logo após o enum `NotificationStatus` existente (linha ~40 de `prisma/schema.prisma`):

```prisma
enum NotificationEventType {
  appointment_created
  appointment_cancelled
  appointment_rescheduled
  appointment_no_show
  customer_created
  appointment_pending_confirmation
  payment_pending
  daily_digest
  birthday_digest
  customer_inactive
  agenda_idle
  monthly_goal
}

enum TeamNotificationChannel {
  IN_APP
  EMAIL
}
```

- [ ] **Step 2: Adicionar campos novos no `User`** — logo após a linha `notifyTeamAppointments  Boolean               @default(true)`:

```prisma
  notificationDeliveryMode String                @default("realtime")
  quietHoursStart          Int?
  quietHoursEnd            Int?
```

E adicionar a relação nova logo após `userNotifications       UserNotification[]` (dentro do mesmo model `User`):

```prisma
  notificationPreferences UserNotificationPreference[]
```

- [ ] **Step 3: Adicionar as 3 relações novas no `Tenant`** — logo após `userNotifications      UserNotification[]` (última linha antes do `}` de fechamento do model `Tenant`):

```prisma
  tenantNotificationSettings  TenantNotificationSetting[]
  notificationTemplates       NotificationTemplate[]
  userNotificationPreferences UserNotificationPreference[]
```

- [ ] **Step 4: Adicionar os 3 models novos** — logo após o model `UserNotification` (após o `}` que fecha esse model, antes do model `WhatsAppAutoReplyLog`):

```prisma
model TenantNotificationSetting {
  id              String                    @id @default(cuid())
  tenantId        String
  eventType       NotificationEventType
  enabled         Boolean                   @default(true)
  defaultChannels TeamNotificationChannel[] @default([IN_APP, EMAIL])
  templateId      String?
  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt

  tenant   Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  template NotificationTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)

  @@unique([tenantId, eventType])
  @@index([tenantId])
}

model UserNotificationPreference {
  id        String                  @id @default(cuid())
  tenantId  String
  userId    String
  eventType NotificationEventType
  channel   TeamNotificationChannel
  enabled   Boolean
  createdAt DateTime                @default(now())
  updatedAt DateTime                @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId, eventType, channel])
  @@index([tenantId, userId])
}

model NotificationTemplate {
  id        String                  @id @default(cuid())
  tenantId  String
  eventType NotificationEventType
  channel   TeamNotificationChannel
  subject   String?
  body      String
  createdAt DateTime                @default(now())
  updatedAt DateTime                @updatedAt

  tenant   Tenant                       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  settings TenantNotificationSetting[]

  @@unique([tenantId, eventType, channel])
  @@index([tenantId])
}
```

- [ ] **Step 5: Gerar a migration**

Run: `npx prisma migrate dev --name add_team_notification_settings`

Expected: cria `prisma/migrations/20260713120000_add_team_notification_settings/migration.sql` (o timestamp real é gerado pelo Prisma, pode diferir de `20260713120000`) com `CREATE TYPE`, `CREATE TABLE` para as 3 tabelas, `ALTER TABLE "User" ADD COLUMN` para os 3 campos novos, e as FKs. Nenhum `DROP`.

- [ ] **Step 6: Gerar o client e validar**

Run: `npx prisma generate && npx tsc --noEmit`

Expected: sem erros (o client agora exporta `NotificationEventType`, `TeamNotificationChannel`, `TenantNotificationSetting`, `UserNotificationPreference`, `NotificationTemplate`).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(notifications): adiciona modelo de dados do motor de notificacoes da equipe"
```

---

### Task 2: Script de backfill dos booleans legados

**Files:**
- Create: `scripts/backfill-team-notification-preferences.mjs`

**Interfaces:**
- Consumes: `prisma.user.findMany`, `prisma.userNotificationPreference.upsert` (models da Task 1).
- Produces: nenhuma interface de código — é um script de execução manual (mesmo padrão de `scripts/seed-plan-features-comissoes-descontos.mjs`).

- [ ] **Step 1: Escrever o script**

```javascript
// scripts/backfill-team-notification-preferences.mjs
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Único boolean legado com equivalente direto no modelo novo (ver "Decisão de
// escopo explícita" no plano). notifyOwnAppointments/notifyTeamAppointments
// continuam lidos direto do User pelo dispatcher — não migram para cá.
const EMAIL_EVENTS = [
  'appointment_created',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_no_show',
]

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, tenantId: true, notifyEmailAppointments: true },
  })

  let count = 0
  for (const user of users) {
    for (const eventType of EMAIL_EVENTS) {
      await prisma.userNotificationPreference.upsert({
        where: {
          tenantId_userId_eventType_channel: {
            tenantId: user.tenantId,
            userId: user.id,
            eventType,
            channel: 'EMAIL',
          },
        },
        update: {},
        create: {
          tenantId: user.tenantId,
          userId: user.id,
          eventType,
          channel: 'EMAIL',
          enabled: user.notifyEmailAppointments,
        },
      })
      count++
    }
  }
  console.log(`OK: ${count} preferências de e-mail migradas para ${users.length} usuário(s).`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Validar sintaticamente**

Run: `node --check scripts/backfill-team-notification-preferences.mjs`

Expected: sem erro de sintaxe (o script só roda de fato contra um banco real em produção, após o deploy da migration da Task 1 — não faz parte do CI, é execução manual documentada no fim deste plano, Task 16).

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-team-notification-preferences.mjs
git commit -m "feat(notifications): script de backfill das preferencias de email legadas"
```

---

### Task 3: Tipos de domínio + chip de filtro do sino

**Files:**
- Modify: `src/domains/notifications/user-notifications/types.ts`
- Modify: `src/domains/notifications/user-notifications/notification-view.ts`

**Interfaces:**
- Produces: `UserNotificationType` ganha `"appointment_rescheduled" | "appointment_no_show"`.

- [ ] **Step 1: Ampliar `UserNotificationType`** em `types.ts` (linha 3-7):

```typescript
export type UserNotificationType =
  | "appointment_created"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "appointment_no_show"
  | "customer_created"
  | "birthday_digest";
```

- [ ] **Step 2: Incluir os 2 tipos novos no chip "Agenda"** do sino, em `notification-view.ts` (linha 16):

```typescript
  agenda: ["appointment_created", "appointment_cancelled", "appointment_rescheduled", "appointment_no_show"],
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/domains/notifications/user-notifications/types.ts src/domains/notifications/user-notifications/notification-view.ts
git commit -m "feat(notifications): amplia tipos de notificacao para reagendamento e falta"
```

---

### Task 4: Templates padrão do sistema + motor de interpolação

**Files:**
- Create: `src/domains/notifications/user-notifications/system-default-templates.ts`
- Create: `src/domains/notifications/user-notifications/notification-template-engine.ts`
- Test: `src/domains/notifications/user-notifications/notification-template-engine.test.ts`

**Interfaces:**
- Produces: `getSystemTemplate(eventType, channel): { subject: string | null; body: string } | null`; `interpolateTemplate(template, vars, escape): string`; `renderNotification(template, vars, channel): { subject: string; body: string }`.
- Consumes (Step 3+): tipos `NotificationEventType`, `TeamNotificationChannel` de `@prisma/client` (Task 1).

- [ ] **Step 1: Escrever o teste do motor de interpolação**

```typescript
// src/domains/notifications/user-notifications/notification-template-engine.test.ts
import { describe, it, expect } from "vitest";
import { interpolateTemplate, renderNotification } from "./notification-template-engine";

describe("interpolateTemplate", () => {
  it("substitui variáveis conhecidas", () => {
    const result = interpolateTemplate("Olá {{cliente}}, {{servico}} às {{hora}}", {
      cliente: "Maria",
      servico: "Corte",
      hora: "14:00",
    }, false);
    expect(result).toBe("Olá Maria, Corte às 14:00");
  });

  it("variável desconhecida vira string vazia", () => {
    const result = interpolateTemplate("Olá {{cliente}}, {{inexistente}}", { cliente: "Maria" }, false);
    expect(result).toBe("Olá Maria, ");
  });

  it("faz escape de HTML quando escape=true", () => {
    const result = interpolateTemplate("{{cliente}}", { cliente: "<script>alert(1)</script>" }, true);
    expect(result).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("não escapa quando escape=false (in-app é texto puro)", () => {
    const result = interpolateTemplate("{{cliente}}", { cliente: "Maria & João" }, false);
    expect(result).toBe("Maria & João");
  });
});

describe("renderNotification", () => {
  it("aplica escape no canal EMAIL e não no IN_APP", () => {
    const template = { subject: "Oi {{cliente}}", body: "{{cliente}} <3" };
    const email = renderNotification(template, { cliente: "M&M" }, "EMAIL");
    const inApp = renderNotification(template, { cliente: "M&M" }, "IN_APP");
    expect(email.subject).toBe("Oi M&amp;M");
    expect(email.body).toBe("M&amp;M <3");
    expect(inApp.body).toBe("M&M <3");
  });

  it("subject nulo vira string vazia", () => {
    const result = renderNotification({ subject: null, body: "{{cliente}}" }, { cliente: "Ana" }, "IN_APP");
    expect(result.subject).toBe("");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-template-engine.test.ts`

Expected: FAIL — módulo `notification-template-engine` não existe.

- [ ] **Step 3: Implementar o motor de templates**

```typescript
// src/domains/notifications/user-notifications/notification-template-engine.ts
export type TemplateVariables = Record<string, string>;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Substitui {{variavel}} pelo valor correspondente; variável desconhecida vira
// string vazia (nunca quebra o envio). `escape=true` deve ser usado sempre no
// canal EMAIL (o valor pode conter HTML perigoso, ex.: nome de cliente).
export function interpolateTemplate(template: string, vars: TemplateVariables, escape: boolean): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key] ?? "";
    return escape ? escapeHtml(value) : value;
  });
}

export function renderNotification(
  template: { subject: string | null; body: string },
  vars: TemplateVariables,
  channel: "IN_APP" | "EMAIL",
): { subject: string; body: string } {
  const escape = channel === "EMAIL";
  return {
    subject: template.subject ? interpolateTemplate(template.subject, vars, escape) : "",
    body: interpolateTemplate(template.body, vars, escape),
  };
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-template-engine.test.ts`

Expected: PASS (6 testes).

- [ ] **Step 5: Criar os templates padrão do sistema** (fallback quando o tenant não tem `NotificationTemplate` próprio — sem teste dedicado, é uma tabela de dados estática consumida e exercitada pelos testes do job de e-mail na Task 13):

```typescript
// src/domains/notifications/user-notifications/system-default-templates.ts
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";

export type SystemTemplate = { subject: string | null; body: string };

function key(eventType: NotificationEventType, channel: TeamNotificationChannel): string {
  return `${eventType}:${channel}`;
}

const SYSTEM_TEMPLATES: Record<string, SystemTemplate> = {
  [key("appointment_created", "IN_APP")]: {
    subject: null,
    body: "{{cliente}} • {{servico}} • {{data}} às {{hora}}",
  },
  [key("appointment_created", "EMAIL")]: {
    subject: "Novo agendamento",
    body: "Novo agendamento de {{cliente}} para {{servico}} em {{data}} às {{hora}}.",
  },
  [key("appointment_cancelled", "IN_APP")]: {
    subject: null,
    body: "Agendamento de {{cliente}} ({{servico}}) para {{data}} às {{hora}} foi cancelado.",
  },
  [key("appointment_cancelled", "EMAIL")]: {
    subject: "Agendamento cancelado",
    body: "O agendamento de {{cliente}} ({{servico}}) para {{data}} às {{hora}} foi cancelado.",
  },
  [key("appointment_rescheduled", "IN_APP")]: {
    subject: null,
    body: "Agendamento de {{cliente}} remarcado para {{data}} às {{hora}}.",
  },
  [key("appointment_rescheduled", "EMAIL")]: {
    subject: "Agendamento remarcado",
    body: "O agendamento de {{cliente}} ({{servico}}) foi remarcado para {{data}} às {{hora}}.",
  },
  [key("appointment_no_show", "IN_APP")]: {
    subject: null,
    body: "{{cliente}} não compareceu ao atendimento de {{servico}} em {{data}} às {{hora}}.",
  },
  [key("appointment_no_show", "EMAIL")]: {
    subject: "Falta registrada",
    body: "{{cliente}} não compareceu ao atendimento de {{servico}} em {{data}} às {{hora}}.",
  },
  [key("customer_created", "IN_APP")]: {
    subject: null,
    body: "{{cliente}} acabou de se cadastrar.",
  },
};

export function getSystemTemplate(
  eventType: NotificationEventType,
  channel: TeamNotificationChannel,
): SystemTemplate | null {
  return SYSTEM_TEMPLATES[key(eventType, channel)] ?? null;
}
```

- [ ] **Step 6: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/notification-template-engine.ts src/domains/notifications/user-notifications/notification-template-engine.test.ts src/domains/notifications/user-notifications/system-default-templates.ts
git commit -m "feat(notifications): motor de interpolacao de templates com escape de HTML"
```

---

### Task 5: Repository de `TenantNotificationSetting`

**Files:**
- Create: `src/domains/notifications/user-notifications/tenant-notification-setting.repository.ts`
- Test: `src/domains/notifications/user-notifications/tenant-notification-setting.repository.test.ts`

**Interfaces:**
- Produces: `TenantNotificationSettingRepository.findByTenant(tenantId, eventType): Promise<TenantNotificationSetting | null>`; singleton `tenantNotificationSettingRepository`.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/domains/notifications/user-notifications/tenant-notification-setting.repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { TenantNotificationSettingRepository } from "./tenant-notification-setting.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("TenantNotificationSettingRepository", () => {
  let repo: TenantNotificationSettingRepository;

  beforeEach(() => {
    repo = new TenantNotificationSettingRepository();
    vi.clearAllMocks();
  });

  it("findByTenant filtra por tenantId e eventType", async () => {
    prismaMock.tenantNotificationSetting.findFirst.mockResolvedValue({
      id: "s1",
      tenantId: "t1",
      eventType: "appointment_created",
      enabled: true,
      defaultChannels: ["IN_APP", "EMAIL"],
      templateId: null,
    } as never);

    const result = await repo.findByTenant("t1", "appointment_created");

    expect(result?.enabled).toBe(true);
    expect(prismaMock.tenantNotificationSetting.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t1", eventType: "appointment_created" },
    });
  });

  it("retorna null quando o tenant não configurou o evento", async () => {
    prismaMock.tenantNotificationSetting.findFirst.mockResolvedValue(null as never);
    const result = await repo.findByTenant("t1", "customer_created");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/tenant-notification-setting.repository.test.ts`

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/domains/notifications/user-notifications/tenant-notification-setting.repository.ts
import type { NotificationEventType, TenantNotificationSetting } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class TenantNotificationSettingRepository {
  async findByTenant(
    tenantId: string,
    eventType: NotificationEventType,
  ): Promise<TenantNotificationSetting | null> {
    return prisma.tenantNotificationSetting.findFirst({
      where: { tenantId, eventType },
    });
  }
}

export const tenantNotificationSettingRepository = new TenantNotificationSettingRepository();
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/tenant-notification-setting.repository.test.ts`

Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/user-notifications/tenant-notification-setting.repository.ts src/domains/notifications/user-notifications/tenant-notification-setting.repository.test.ts
git commit -m "feat(notifications): repository de configuracao de evento por tenant"
```

---

### Task 6: Repository de `UserNotificationPreference`

**Files:**
- Create: `src/domains/notifications/user-notifications/user-notification-preference.repository.ts`
- Test: `src/domains/notifications/user-notifications/user-notification-preference.repository.test.ts`

**Interfaces:**
- Produces: `UserNotificationPreferenceRepository.findEmailOverridesForUsers(tenantId, userIds, eventType): Promise<Map<string, boolean>>`; `.upsertEmailOverride(tenantId, userId, eventType, enabled): Promise<void>`; singleton `userNotificationPreferenceRepository`.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/domains/notifications/user-notifications/user-notification-preference.repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { UserNotificationPreferenceRepository } from "./user-notification-preference.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("UserNotificationPreferenceRepository", () => {
  let repo: UserNotificationPreferenceRepository;

  beforeEach(() => {
    repo = new UserNotificationPreferenceRepository();
    vi.clearAllMocks();
  });

  it("findEmailOverridesForUsers busca em lote (uma query para N usuários)", async () => {
    prismaMock.userNotificationPreference.findMany.mockResolvedValue([
      { userId: "u1", enabled: false },
      { userId: "u2", enabled: true },
    ] as never);

    const result = await repo.findEmailOverridesForUsers("t1", ["u1", "u2", "u3"], "appointment_created");

    expect(result.get("u1")).toBe(false);
    expect(result.get("u2")).toBe(true);
    expect(result.has("u3")).toBe(false);
    expect(prismaMock.userNotificationPreference.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: { in: ["u1", "u2", "u3"] }, eventType: "appointment_created", channel: "EMAIL" },
      select: { userId: true, enabled: true },
    });
  });

  it("findEmailOverridesForUsers com lista vazia não consulta o banco", async () => {
    const result = await repo.findEmailOverridesForUsers("t1", [], "appointment_created");
    expect(result.size).toBe(0);
    expect(prismaMock.userNotificationPreference.findMany).not.toHaveBeenCalled();
  });

  it("upsertEmailOverride grava enabled para o par usuário/evento", async () => {
    prismaMock.userNotificationPreference.upsert.mockResolvedValue({} as never);

    await repo.upsertEmailOverride("t1", "u1", "appointment_created", false);

    expect(prismaMock.userNotificationPreference.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_userId_eventType_channel: {
          tenantId: "t1", userId: "u1", eventType: "appointment_created", channel: "EMAIL",
        },
      },
      update: { enabled: false },
      create: { tenantId: "t1", userId: "u1", eventType: "appointment_created", channel: "EMAIL", enabled: false },
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification-preference.repository.test.ts`

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/domains/notifications/user-notifications/user-notification-preference.repository.ts
import type { NotificationEventType } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class UserNotificationPreferenceRepository {
  // Batelada: uma única query para todos os candidatos de um evento (evita
  // fan-out de N queries por destinatário, mitigação exigida pelo spec).
  async findEmailOverridesForUsers(
    tenantId: string,
    userIds: string[],
    eventType: NotificationEventType,
  ): Promise<Map<string, boolean>> {
    if (userIds.length === 0) return new Map();
    const rows = await prisma.userNotificationPreference.findMany({
      where: { tenantId, userId: { in: userIds }, eventType, channel: "EMAIL" },
      select: { userId: true, enabled: true },
    });
    return new Map(rows.map((r) => [r.userId, r.enabled]));
  }

  async upsertEmailOverride(
    tenantId: string,
    userId: string,
    eventType: NotificationEventType,
    enabled: boolean,
  ): Promise<void> {
    await prisma.userNotificationPreference.upsert({
      where: {
        tenantId_userId_eventType_channel: { tenantId, userId, eventType, channel: "EMAIL" },
      },
      update: { enabled },
      create: { tenantId, userId, eventType, channel: "EMAIL", enabled },
    });
  }
}

export const userNotificationPreferenceRepository = new UserNotificationPreferenceRepository();
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification-preference.repository.test.ts`

Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/user-notifications/user-notification-preference.repository.ts src/domains/notifications/user-notifications/user-notification-preference.repository.test.ts
git commit -m "feat(notifications): repository de overrides de email por colaborador"
```

---

### Task 7: Repository de `NotificationTemplate`

**Files:**
- Create: `src/domains/notifications/user-notifications/notification-template.repository.ts`
- Test: `src/domains/notifications/user-notifications/notification-template.repository.test.ts`

**Interfaces:**
- Produces: `NotificationTemplateRepository.findByTenant(tenantId, eventType, channel): Promise<NotificationTemplate | null>`; singleton `notificationTemplateRepository`.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/domains/notifications/user-notifications/notification-template.repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationTemplateRepository } from "./notification-template.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("NotificationTemplateRepository", () => {
  let repo: NotificationTemplateRepository;

  beforeEach(() => {
    repo = new NotificationTemplateRepository();
    vi.clearAllMocks();
  });

  it("findByTenant busca por tenantId + eventType + channel", async () => {
    prismaMock.notificationTemplate.findFirst.mockResolvedValue({
      id: "tpl1", subject: "Assunto", body: "Corpo {{cliente}}",
    } as never);

    const result = await repo.findByTenant("t1", "appointment_created", "EMAIL");

    expect(result?.body).toBe("Corpo {{cliente}}");
    expect(prismaMock.notificationTemplate.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t1", eventType: "appointment_created", channel: "EMAIL" },
    });
  });

  it("retorna null quando o tenant não tem template próprio (usa fallback do sistema)", async () => {
    prismaMock.notificationTemplate.findFirst.mockResolvedValue(null as never);
    const result = await repo.findByTenant("t1", "appointment_created", "EMAIL");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-template.repository.test.ts`

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/domains/notifications/user-notifications/notification-template.repository.ts
import type { NotificationEventType, NotificationTemplate, TeamNotificationChannel } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export class NotificationTemplateRepository {
  async findByTenant(
    tenantId: string,
    eventType: NotificationEventType,
    channel: TeamNotificationChannel,
  ): Promise<NotificationTemplate | null> {
    return prisma.notificationTemplate.findFirst({
      where: { tenantId, eventType, channel },
    });
  }
}

export const notificationTemplateRepository = new NotificationTemplateRepository();
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-template.repository.test.ts`

Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/user-notifications/notification-template.repository.ts src/domains/notifications/user-notifications/notification-template.repository.test.ts
git commit -m "feat(notifications): repository de templates de notificacao por tenant"
```

---

### Task 8: Resolvedor de canais (lógica pura — negócio ∩ override, quiet hours, modo digest)

**Files:**
- Create: `src/domains/notifications/user-notifications/notification-channel-resolver.ts`
- Test: `src/domains/notifications/user-notifications/notification-channel-resolver.test.ts`

**Interfaces:**
- Consumes: enums `NotificationEventType`, `TeamNotificationChannel` de `@prisma/client` (Task 1).
- Produces: `SYSTEM_DEFAULT_TENANT_SETTINGS: Record<NotificationEventType, TenantEventSetting>`; `resolveDelivery(params): ResolvedDelivery` — usado pela Task 10 (dispatcher) e Task 14 (daily digest).

- [ ] **Step 1: Escrever o teste**

```typescript
// src/domains/notifications/user-notifications/notification-channel-resolver.test.ts
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
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-channel-resolver.test.ts`

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/domains/notifications/user-notifications/notification-channel-resolver.ts
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";

export type TenantEventSetting = {
  enabled: boolean;
  defaultChannels: TeamNotificationChannel[];
};

// Fallback usado quando o tenant ainda não tem uma linha de TenantNotificationSetting
// para o evento (tenants existentes antes desta entrega, ou evento novo no catálogo).
export const SYSTEM_DEFAULT_TENANT_SETTINGS: Record<NotificationEventType, TenantEventSetting> = {
  appointment_created: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
  appointment_cancelled: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
  appointment_rescheduled: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
  appointment_no_show: { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] },
  customer_created: { enabled: true, defaultChannels: ["IN_APP"] },
  appointment_pending_confirmation: { enabled: true, defaultChannels: ["IN_APP"] },
  payment_pending: { enabled: true, defaultChannels: ["IN_APP"] },
  daily_digest: { enabled: true, defaultChannels: ["EMAIL"] },
  birthday_digest: { enabled: true, defaultChannels: ["IN_APP"] },
  customer_inactive: { enabled: true, defaultChannels: ["IN_APP"] },
  agenda_idle: { enabled: true, defaultChannels: ["IN_APP"] },
  monthly_goal: { enabled: true, defaultChannels: ["IN_APP"] },
};

export type RecipientDeliveryPrefs = {
  deliveryMode: string; // "realtime" | "digest"
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

export type ResolvedDelivery = {
  eventEnabled: boolean;
  inApp: boolean;
  email: boolean;
  // Quando não-nulo, o job de e-mail deve enfileirar com este `startAfter`
  // (mesma técnica de "segurar até a janela" usada em appointment-reminder.ts).
  emailStartAfter: Date | null;
};

function isWithinQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function delayUntilQuietHoursEnd(now: Date, hour: number, end: number): Date {
  const hoursUntilEnd = end > hour ? end - hour : 24 - hour + end;
  return new Date(now.getTime() + hoursUntilEnd * 3600_000);
}

export function resolveDelivery(params: {
  eventType: NotificationEventType;
  tenantSetting: TenantEventSetting | null;
  emailOverrideEnabled: boolean | null; // null = sem override, herda o padrão do negócio
  prefs: RecipientDeliveryPrefs;
  now: Date;
}): ResolvedDelivery {
  const { eventType, tenantSetting, emailOverrideEnabled, prefs, now } = params;
  const setting = tenantSetting ?? SYSTEM_DEFAULT_TENANT_SETTINGS[eventType];

  if (!setting.enabled) {
    return { eventEnabled: false, inApp: false, email: false, emailStartAfter: null };
  }

  const inApp = setting.defaultChannels.includes("IN_APP");
  const businessWantsEmail = setting.defaultChannels.includes("EMAIL");
  const userWantsEmail = emailOverrideEnabled ?? businessWantsEmail;
  const emailAllowed = businessWantsEmail && userWantsEmail;

  // Modo digest: nunca sai e-mail por evento individual — entra no resumo diário (Task 14).
  if (!emailAllowed || prefs.deliveryMode === "digest") {
    return { eventEnabled: true, inApp, email: false, emailStartAfter: null };
  }

  let emailStartAfter: Date | null = null;
  if (prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null) {
    const hour = now.getUTCHours();
    if (isWithinQuietHours(hour, prefs.quietHoursStart, prefs.quietHoursEnd)) {
      emailStartAfter = delayUntilQuietHoursEnd(now, hour, prefs.quietHoursEnd);
    }
  }

  return { eventEnabled: true, inApp, email: true, emailStartAfter };
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-channel-resolver.test.ts`

Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/user-notifications/notification-channel-resolver.ts src/domains/notifications/user-notifications/notification-channel-resolver.test.ts
git commit -m "feat(notifications): resolvedor de canais com quiet hours e modo digest"
```

---

### Task 9: Consultas de destinatário/contexto no `user-notification.repository.ts`

**Files:**
- Modify: `src/domains/notifications/user-notifications/user-notification.repository.ts`
- Modify: `src/domains/notifications/user-notifications/user-notification.repository.test.ts` (adicionar casos, não remover os existentes)

**Interfaces:**
- Consumes: nenhuma nova (usa `prisma` já importado no arquivo).
- Produces: `findManagers` (ampliado — mesma assinatura, `ManagerRecipient` ganha 3 campos); `findRecipientContext(tenantId, userId): Promise<RecipientContext | null>`; `findTenantTimezone(tenantId): Promise<string>`; `findAppointmentForNotification(tenantId, appointmentId): Promise<EnrichedAppointment | null>`; `findPendingWorklist(tenantId, userId): Promise<{ appointmentsAwaitingConfirmation: number; paymentsPending: number }>`; `findAllForDigest(tenantId): Promise<DigestUser[]>`; `countTodayAppointmentsFor(tenantId, professionalId): Promise<number>`; `findTodayForDigest(tenantId, userId): Promise<{ type: string }[]>`.

- [ ] **Step 1: Ampliar `types.ts`** com os novos shapes (adicionar ao final do arquivo, sem remover nada existente):

```typescript
export type RecipientContext = {
  role: string;
  notifyOwnAppointments: boolean;
  notifyTeamAppointments: boolean;
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

export type EnrichedAppointment = {
  createdByUserId: string;
  packageId: string | null;
  serviceId: string | null;
  serviceName: string;
  professional: { id: string; name: string; email: string };
};

export type DigestUser = {
  id: string;
  email: string;
  notificationDeliveryMode: string;
};
```

Atualizar também `ManagerRecipient` (mesmo arquivo, já existente) para incluir os 3 campos novos:

```typescript
export type ManagerRecipient = {
  id: string;
  email: string;
  name: string;
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
} & NotificationPrefs;
```

- [ ] **Step 2: Escrever os testes novos** (adicionar ao final de `user-notification.repository.test.ts`, dentro do `describe("UserNotificationRepository")` existente — não duplicar o `describe` nem remover os `it` já presentes):

```typescript
  it("findManagers inclui os campos de anti-fadiga no select", async () => {
    prismaMock.user.findMany.mockResolvedValue([] as never);
    await repo.findManagers("t1");
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          notificationDeliveryMode: true,
          quietHoursStart: true,
          quietHoursEnd: true,
        }),
      }),
    );
  });

  it("findRecipientContext busca por id e tenant com os campos de anti-fadiga", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      role: "PROFESSIONAL",
      notifyOwnAppointments: false,
      notifyTeamAppointments: true,
      notificationDeliveryMode: "realtime",
      quietHoursStart: null,
      quietHoursEnd: null,
    } as never);

    const result = await repo.findRecipientContext("t1", "u1");

    expect(result?.role).toBe("PROFESSIONAL");
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1", tenantId: "t1" } }),
    );
  });

  it("findTenantTimezone retorna o timezone do tenant ou o default", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ timezone: "America/Sao_Paulo" } as never);
    const tz = await repo.findTenantTimezone("t1");
    expect(tz).toBe("America/Sao_Paulo");
  });

  it("findTenantTimezone usa America/Sao_Paulo quando o tenant não existe", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null as never);
    const tz = await repo.findTenantTimezone("t1");
    expect(tz).toBe("America/Sao_Paulo");
  });

  it("findAppointmentForNotification filtra por tenant e enriquece profissional/serviço", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({
      createdByUserId: "u1",
      packageId: null,
      service: { id: "s1", name: "Corte" },
      professional: { id: "p1", name: "Ana", email: "ana@x.com" },
    } as never);

    const result = await repo.findAppointmentForNotification("t1", "a1");

    expect(result?.serviceName).toBe("Corte");
    expect(result?.professional.email).toBe("ana@x.com");
    expect(prismaMock.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a1", tenantId: "t1" } }),
    );
  });

  it("findAppointmentForNotification retorna null quando não encontra", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null as never);
    const result = await repo.findAppointmentForNotification("t1", "a1");
    expect(result).toBeNull();
  });

  it("findPendingWorklist conta agendamentos de hoje aguardando confirmação e pagamentos pendentes", async () => {
    prismaMock.appointment.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const result = await repo.findPendingWorklist("t1", "u1");
    expect(result).toEqual({ appointmentsAwaitingConfirmation: 3, paymentsPending: 2 });
  });

  it("findAllForDigest retorna id/email/modo de todos os usuários do tenant", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1", email: "u1@x.com", notificationDeliveryMode: "digest" }] as never);
    const result = await repo.findAllForDigest("t1");
    expect(result).toHaveLength(1);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1" },
      select: { id: true, email: true, notificationDeliveryMode: true },
    });
  });

  it("countTodayAppointmentsFor conta agendamentos do dia do profissional, excluindo cancelados", async () => {
    prismaMock.appointment.count.mockResolvedValue(5);
    const count = await repo.countTodayAppointmentsFor("t1", "p1");
    expect(count).toBe(5);
    expect(prismaMock.appointment.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", professionalId: "p1", status: { not: "CANCELLED" } }),
      }),
    );
  });

  it("findTodayForDigest retorna os tipos de notificação de hoje do usuário", async () => {
    prismaMock.userNotification.findMany.mockResolvedValue([{ type: "appointment_created" }] as never);
    const result = await repo.findTodayForDigest("t1", "u1");
    expect(result).toEqual([{ type: "appointment_created" }]);
  });
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.repository.test.ts`

Expected: FAIL — os métodos novos não existem no repository.

- [ ] **Step 4: Implementar os métodos novos** (adicionar ao final da classe `UserNotificationRepository`, e ajustar o `select` de `findManagers` existente):

```typescript
  // (ajustar o método findManagers já existente — adicionar os 3 campos ao select)
  async findManagers(tenantId: string): Promise<ManagerRecipient[]> {
    return prisma.user.findMany({
      where: { tenantId, role: { in: [UserRole.OWNER, UserRole.MANAGER] } },
      select: {
        id: true,
        email: true,
        name: true,
        notifyEmailAppointments: true,
        notifyOwnAppointments: true,
        notifyTeamAppointments: true,
        notificationDeliveryMode: true,
        quietHoursStart: true,
        quietHoursEnd: true,
      },
    });
  }

  async findRecipientContext(tenantId: string, userId: string): Promise<RecipientContext | null> {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        role: true,
        notifyOwnAppointments: true,
        notifyTeamAppointments: true,
        notificationDeliveryMode: true,
        quietHoursStart: true,
        quietHoursEnd: true,
      },
    });
  }

  async findTenantTimezone(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { timezone: true } });
    return tenant?.timezone ?? "America/Sao_Paulo";
  }

  async findAppointmentForNotification(
    tenantId: string,
    appointmentId: string,
  ): Promise<EnrichedAppointment | null> {
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        professional: { select: { id: true, name: true, email: true } },
        service: { select: { id: true, name: true } },
      },
    });
    if (!appt) return null;
    return {
      createdByUserId: appt.createdByUserId,
      packageId: appt.packageId,
      serviceId: appt.service?.id ?? null,
      serviceName: appt.service?.name ?? "",
      professional: appt.professional,
    };
  }

  async findPendingWorklist(
    tenantId: string,
    userId: string,
  ): Promise<{ appointmentsAwaitingConfirmation: number; paymentsPending: number }> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [appointmentsAwaitingConfirmation, paymentsPending] = await Promise.all([
      prisma.appointment.count({
        where: { tenantId, professionalId: userId, startsAt: { gte: start, lte: end }, status: "SCHEDULED" },
      }),
      prisma.appointment.count({
        where: { tenantId, professionalId: userId, paymentStatus: "PENDING", status: "COMPLETED" },
      }),
    ]);

    return { appointmentsAwaitingConfirmation, paymentsPending };
  }

  async findAllForDigest(tenantId: string): Promise<DigestUser[]> {
    return prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, notificationDeliveryMode: true },
    });
  }

  async countTodayAppointmentsFor(tenantId: string, professionalId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return prisma.appointment.count({
      where: { tenantId, professionalId, startsAt: { gte: start, lte: end }, status: { not: "CANCELLED" } },
    });
  }

  async findTodayForDigest(tenantId: string, userId: string): Promise<{ type: string }[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return prisma.userNotification.findMany({
      where: { tenantId, userId, createdAt: { gte: start } },
      select: { type: true },
    });
  }
```

E adicionar os imports de tipo novos no topo do arquivo:

```typescript
import type {
  CreateUserNotificationInput,
  DigestUser,
  EnrichedAppointment,
  ManagerRecipient,
  NotificationPrefs,
  RecipientContext,
  UserPrefsRow,
} from "./types";
```

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.repository.test.ts`

Expected: PASS (todos os testes antigos + os 10 novos).

- [ ] **Step 6: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/user-notification.repository.ts src/domains/notifications/user-notifications/user-notification.repository.test.ts src/domains/notifications/user-notifications/types.ts
git commit -m "feat(notifications): consultas de destinatario, contexto e worklist no repository"
```

---

### Task 10: Dispatcher genérico de notificações da equipe

**Files:**
- Create: `src/domains/notifications/user-notifications/team-notification-dispatcher.service.ts`
- Test: `src/domains/notifications/user-notifications/team-notification-dispatcher.service.test.ts`

**Interfaces:**
- Consumes: `userNotificationRepository` (Task 9), `tenantNotificationSettingRepository` (Task 5), `userNotificationPreferenceRepository` (Task 6), `resolveDelivery` (Task 8), `startPgBoss` (`@/shared/queue/pg-boss`, já existe), `TEAM_NOTIFICATION_EMAIL_JOB`/`TeamNotificationEmailPayload` (Task 13 — declarar a interface aqui e implementar o job na Task 13; a ordem de import não importa em TS, mas a Task 13 deve rodar depois para o teste de integração completo funcionar. Este teste usa mock do job, então não há dependência de execução).
- Produces: `TeamNotificationDispatcherService` com `dispatchAppointmentEvent(kind, payload)`, `dispatchAppointmentRescheduled(payload)`, `dispatchCustomerCreated(payload)`; singleton `teamNotificationDispatcher`.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/domains/notifications/user-notifications/team-notification-dispatcher.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamNotificationDispatcherService } from "./team-notification-dispatcher.service";

const userNotifRepo = {
  createMany: vi.fn(),
  findManagers: vi.fn(),
  findRecipientContext: vi.fn(),
  findTenantTimezone: vi.fn(),
  findAppointmentForNotification: vi.fn(),
};
const settingRepo = { findByTenant: vi.fn() };
const prefRepo = { findEmailOverridesForUsers: vi.fn() };

const bossSend = vi.fn();
vi.mock("@/shared/queue/pg-boss", () => ({
  startPgBoss: () => Promise.resolve({ send: bossSend }),
}));

function makePayload(over: Partial<{ createdByUserId: string | null; profId: string; profEmail: string; origin: "panel" | "public" }> = {}) {
  return {
    tenantId: "t1",
    appointment: { id: "a1", createdByUserId: over.createdByUserId ?? null, startsAt: new Date("2026-07-13T18:00:00Z"), packageId: null },
    customer: { id: "c1", name: "Maria" },
    service: { id: "s1", name: "Corte" },
    professional: { id: over.profId ?? "prof1", name: "Ana", email: over.profEmail ?? "ana@x.com" },
    origin: over.origin ?? "panel",
  } as never;
}

describe("TeamNotificationDispatcherService.dispatchAppointmentEvent", () => {
  let dispatcher: TeamNotificationDispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new TeamNotificationDispatcherService(userNotifRepo as never, settingRepo as never, prefRepo as never);
    userNotifRepo.findManagers.mockResolvedValue([]);
    userNotifRepo.findTenantTimezone.mockResolvedValue("America/Sao_Paulo");
    userNotifRepo.createMany.mockResolvedValue(1);
    userNotifRepo.findRecipientContext.mockResolvedValue({
      role: "PROFESSIONAL",
      notifyOwnAppointments: false,
      notifyTeamAppointments: true,
      notificationDeliveryMode: "realtime",
      quietHoursStart: null,
      quietHoursEnd: null,
    });
    settingRepo.findByTenant.mockResolvedValue(null); // usa default do sistema
    prefRepo.findEmailOverridesForUsers.mockResolvedValue(new Map());
  });

  it("grava in-app e enfileira e-mail para o profissional do atendimento", async () => {
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload());

    expect(userNotifRepo.createMany).toHaveBeenCalledWith("t1", [
      expect.objectContaining({ userId: "prof1", type: "appointment_created" }),
    ]);
    expect(bossSend).toHaveBeenCalledWith(
      "team-notification-email",
      expect.objectContaining({ tenantId: "t1", userId: "prof1", eventType: "appointment_created" }),
      expect.objectContaining({ retryLimit: 2 }),
    );
  });

  it("auto-skip: criador (não-público) sem notifyOwnAppointments não recebe nada", async () => {
    userNotifRepo.findRecipientContext.mockResolvedValue({
      role: "PROFESSIONAL", notifyOwnAppointments: false, notifyTeamAppointments: true,
      notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null,
    });
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload({ createdByUserId: "prof1" }));
    expect(userNotifRepo.createMany).not.toHaveBeenCalled();
    expect(bossSend).not.toHaveBeenCalled();
  });

  it("vitrine pública não aplica auto-skip mesmo com createdByUserId = destinatário", async () => {
    await dispatcher.dispatchAppointmentEvent(
      "appointment_created",
      makePayload({ createdByUserId: "prof1", origin: "public" }),
    );
    expect(userNotifRepo.createMany).toHaveBeenCalled();
  });

  it("gestor com notifyTeamAppointments=false não recebe agendamento de outro profissional", async () => {
    userNotifRepo.findManagers.mockResolvedValue([
      {
        id: "owner1", email: "o@x.com", name: "Dono",
        notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: false,
        notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null,
      },
    ]);
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload());
    const rows = userNotifRepo.createMany.mock.calls[0][1];
    expect(rows.find((r: { userId: string }) => r.userId === "owner1")).toBeUndefined();
  });

  it("evento desabilitado pelo negócio não gera in-app nem e-mail", async () => {
    settingRepo.findByTenant.mockResolvedValue({ enabled: false, defaultChannels: [] });
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload());
    expect(userNotifRepo.createMany).not.toHaveBeenCalled();
    expect(bossSend).not.toHaveBeenCalled();
  });

  it("override de e-mail do usuário desliga o e-mail mas mantém o in-app", async () => {
    prefRepo.findEmailOverridesForUsers.mockResolvedValue(new Map([["prof1", false]]));
    await dispatcher.dispatchAppointmentEvent("appointment_created", makePayload());
    expect(userNotifRepo.createMany).toHaveBeenCalled();
    expect(bossSend).not.toHaveBeenCalled();
  });
});

describe("TeamNotificationDispatcherService.dispatchAppointmentRescheduled", () => {
  let dispatcher: TeamNotificationDispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new TeamNotificationDispatcherService(userNotifRepo as never, settingRepo as never, prefRepo as never);
    userNotifRepo.findManagers.mockResolvedValue([]);
    userNotifRepo.findTenantTimezone.mockResolvedValue("America/Sao_Paulo");
    userNotifRepo.createMany.mockResolvedValue(1);
    userNotifRepo.findRecipientContext.mockResolvedValue({
      role: "PROFESSIONAL", notifyOwnAppointments: false, notifyTeamAppointments: true,
      notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null,
    });
    settingRepo.findByTenant.mockResolvedValue(null);
    prefRepo.findEmailOverridesForUsers.mockResolvedValue(new Map());
  });

  it("busca o agendamento no banco para enriquecer o payload (evento não traz professional.id/email)", async () => {
    userNotifRepo.findAppointmentForNotification.mockResolvedValue({
      createdByUserId: "owner1",
      packageId: null,
      serviceId: "s1",
      serviceName: "Corte",
      professional: { id: "prof1", name: "Ana", email: "ana@x.com" },
    });

    await dispatcher.dispatchAppointmentRescheduled({
      tenantId: "t1",
      appointmentId: "a1",
      customerId: "c1",
      customerName: "Maria",
      customerPhone: null,
      serviceName: "Corte",
      professionalName: "Ana",
      oldStartsAt: new Date("2026-07-13T14:00:00Z"),
      newStartsAt: new Date("2026-07-14T14:00:00Z"),
      newEndsAt: new Date("2026-07-14T14:30:00Z"),
      notificationMessage: "",
    } as never);

    expect(userNotifRepo.createMany).toHaveBeenCalledWith("t1", [
      expect.objectContaining({ userId: "prof1", type: "appointment_rescheduled" }),
    ]);
  });

  it("agendamento não encontrado não quebra (skip silencioso)", async () => {
    userNotifRepo.findAppointmentForNotification.mockResolvedValue(null);
    await expect(
      dispatcher.dispatchAppointmentRescheduled({ tenantId: "t1", appointmentId: "a1" } as never),
    ).resolves.toBeUndefined();
    expect(userNotifRepo.createMany).not.toHaveBeenCalled();
  });
});

describe("TeamNotificationDispatcherService.dispatchCustomerCreated", () => {
  let dispatcher: TeamNotificationDispatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new TeamNotificationDispatcherService(userNotifRepo as never, settingRepo as never, prefRepo as never);
    userNotifRepo.createMany.mockResolvedValue(1);
    settingRepo.findByTenant.mockResolvedValue(null);
    prefRepo.findEmailOverridesForUsers.mockResolvedValue(new Map());
  });

  it("notifica gestores sem e-mail (default do sistema para customer_created é só IN_APP)", async () => {
    userNotifRepo.findManagers.mockResolvedValue([
      {
        id: "owner1", email: "o@x.com", name: "Dono",
        notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: true,
        notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null,
      },
    ]);
    await dispatcher.dispatchCustomerCreated({ tenantId: "t1", customer: { id: "c1", name: "João" } });
    expect(userNotifRepo.createMany).toHaveBeenCalledWith("t1", [
      expect.objectContaining({ userId: "owner1", type: "customer_created" }),
    ]);
    expect(bossSend).not.toHaveBeenCalled();
  });

  it("sem gestores, não faz nada", async () => {
    userNotifRepo.findManagers.mockResolvedValue([]);
    await dispatcher.dispatchCustomerCreated({ tenantId: "t1", customer: { id: "c1", name: "João" } });
    expect(userNotifRepo.createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/team-notification-dispatcher.service.test.ts`

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/domains/notifications/user-notifications/team-notification-dispatcher.service.ts
import type { Appointment } from "@prisma/client";

import { startPgBoss } from "@/shared/queue/pg-boss";
import { TEAM_NOTIFICATION_EMAIL_JOB, type TeamNotificationEmailPayload } from "@/shared/queue/jobs/team-notification-email";
import { userNotificationRepository, UserNotificationRepository } from "./user-notification.repository";
import {
  tenantNotificationSettingRepository,
  TenantNotificationSettingRepository,
} from "./tenant-notification-setting.repository";
import {
  userNotificationPreferenceRepository,
  UserNotificationPreferenceRepository,
} from "./user-notification-preference.repository";
import { resolveDelivery } from "./notification-channel-resolver";
import type { CreateUserNotificationInput } from "./types";

type AppointmentEventKind =
  | "appointment_created"
  | "appointment_cancelled"
  | "appointment_no_show"
  | "appointment_rescheduled";

type AppointmentPayload = {
  tenantId: string;
  appointment: Pick<Appointment, "id" | "createdByUserId" | "startsAt" | "packageId">;
  customer: { id: string; name: string };
  service: { id: string; name: string };
  professional: { id: string; name: string; email: string };
  origin?: "panel" | "public";
};

type RescheduledPayload = {
  tenantId: string;
  appointmentId: string;
  customerId: string;
  customerName: string;
  newStartsAt: Date;
};

type RecipientCandidate = {
  id: string;
  name: string;
  email: string;
  isProfessional: boolean;
  isManager: boolean;
  notifyOwnAppointments: boolean;
  notifyTeamAppointments: boolean;
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

const EVENT_TITLES: Record<AppointmentEventKind, string> = {
  appointment_created: "Novo agendamento",
  appointment_cancelled: "Agendamento cancelado",
  appointment_no_show: "Falta registrada",
  appointment_rescheduled: "Agendamento remarcado",
};

function formatDateTime(date: Date, tz: string): { data: string; hora: string } {
  return {
    data: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz }).format(date),
    hora: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(date),
  };
}

export class TeamNotificationDispatcherService {
  constructor(
    private readonly userNotifRepo: UserNotificationRepository = userNotificationRepository,
    private readonly settingRepo: TenantNotificationSettingRepository = tenantNotificationSettingRepository,
    private readonly prefRepo: UserNotificationPreferenceRepository = userNotificationPreferenceRepository,
  ) {}

  async dispatchAppointmentEvent(kind: AppointmentEventKind, payload: AppointmentPayload): Promise<void> {
    const { tenantId, appointment, customer, service, professional } = payload;
    const isPublic = payload.origin === "public";

    const [managers, proContext, tenantSetting, tenantTz] = await Promise.all([
      this.userNotifRepo.findManagers(tenantId),
      this.userNotifRepo.findRecipientContext(tenantId, professional.id),
      this.settingRepo.findByTenant(tenantId, kind),
      this.userNotifRepo.findTenantTimezone(tenantId),
    ]);

    const byId = new Map<string, RecipientCandidate>();
    byId.set(professional.id, {
      id: professional.id,
      name: professional.name,
      email: professional.email,
      isProfessional: true,
      isManager: proContext?.role === "OWNER" || proContext?.role === "MANAGER",
      notifyOwnAppointments: proContext?.notifyOwnAppointments ?? false,
      notifyTeamAppointments: proContext?.notifyTeamAppointments ?? true,
      notificationDeliveryMode: proContext?.notificationDeliveryMode ?? "realtime",
      quietHoursStart: proContext?.quietHoursStart ?? null,
      quietHoursEnd: proContext?.quietHoursEnd ?? null,
    });
    for (const m of managers) {
      if (byId.has(m.id)) continue;
      byId.set(m.id, {
        id: m.id,
        name: m.name,
        email: m.email,
        isProfessional: false,
        isManager: true,
        notifyOwnAppointments: m.notifyOwnAppointments,
        notifyTeamAppointments: m.notifyTeamAppointments,
        notificationDeliveryMode: m.notificationDeliveryMode,
        quietHoursStart: m.quietHoursStart,
        quietHoursEnd: m.quietHoursEnd,
      });
    }

    const recipients: RecipientCandidate[] = [];
    for (const c of byId.values()) {
      if (kind === "appointment_created" && !isPublic && appointment.createdByUserId === c.id && !c.notifyOwnAppointments) {
        continue;
      }
      if (!c.isProfessional && c.isManager && !c.notifyTeamAppointments) continue;
      recipients.push(c);
    }
    if (recipients.length === 0) return;

    const overrides = await this.prefRepo.findEmailOverridesForUsers(tenantId, recipients.map((r) => r.id), kind);
    const dt = formatDateTime(appointment.startsAt, tenantTz);
    const serviceLabel = service.name || (appointment.packageId ? "Pacote" : "Atendimento");
    const now = new Date();

    // Duas listas resolvidas ANTES de qualquer I/O de fila: garante que uma falha ao
    // enfileirar e-mail (Task 13/pg-boss fora do ar) nunca impede a gravação in-app dos
    // demais destinatários já resolvidos — isolamento de falhas exigido pelo spec.
    const rows: CreateUserNotificationInput[] = [];
    const emailJobs: { payload: TeamNotificationEmailPayload; startAfter: Date | undefined }[] = [];

    for (const r of recipients) {
      const delivery = resolveDelivery({
        eventType: kind,
        tenantSetting: tenantSetting ? { enabled: tenantSetting.enabled, defaultChannels: tenantSetting.defaultChannels } : null,
        emailOverrideEnabled: overrides.get(r.id) ?? null,
        prefs: { deliveryMode: r.notificationDeliveryMode, quietHoursStart: r.quietHoursStart, quietHoursEnd: r.quietHoursEnd },
        now,
      });
      if (!delivery.eventEnabled) continue;

      if (delivery.inApp) {
        rows.push({
          userId: r.id,
          type: kind,
          title: EVENT_TITLES[kind],
          body: `${customer.name} • ${serviceLabel} • ${dt.data} às ${dt.hora}`,
          data: {
            appointmentId: appointment.id,
            customerName: customer.name,
            serviceName: serviceLabel,
            startsAt: appointment.startsAt.toISOString(),
            origin: isPublic ? "public" : "panel",
          },
        });
      }

      if (delivery.email) {
        emailJobs.push({
          payload: {
            tenantId,
            userId: r.id,
            eventType: kind,
            variables: { cliente: customer.name, servico: serviceLabel, data: dt.data, hora: dt.hora },
          },
          startAfter: delivery.emailStartAfter ?? undefined,
        });
      }
    }

    if (rows.length > 0) await this.userNotifRepo.createMany(tenantId, rows);

    if (emailJobs.length > 0) {
      const boss = await startPgBoss();
      for (const job of emailJobs) {
        try {
          await boss.send(TEAM_NOTIFICATION_EMAIL_JOB, job.payload, {
            startAfter: job.startAfter,
            retryLimit: 2,
            retryDelay: 300,
          });
        } catch (err) {
          console.error(`[team-notifications] falha ao enfileirar email para ${job.payload.userId}:`, err);
        }
      }
    }
  }

  async dispatchAppointmentRescheduled(payload: RescheduledPayload): Promise<void> {
    const { tenantId, appointmentId, customerId, customerName, newStartsAt } = payload;
    const enriched = await this.userNotifRepo.findAppointmentForNotification(tenantId, appointmentId);
    if (!enriched) return;

    await this.dispatchAppointmentEvent("appointment_rescheduled", {
      tenantId,
      appointment: {
        id: appointmentId,
        createdByUserId: enriched.createdByUserId,
        startsAt: newStartsAt,
        packageId: enriched.packageId,
      },
      customer: { id: customerId, name: customerName },
      service: { id: enriched.serviceId ?? "", name: enriched.serviceName },
      professional: enriched.professional,
    });
  }

  async dispatchCustomerCreated(payload: { tenantId: string; customer: { id: string; name: string } }): Promise<void> {
    const { tenantId, customer } = payload;
    const managers = await this.userNotifRepo.findManagers(tenantId);
    if (managers.length === 0) return;

    const [tenantSetting, overrides] = await Promise.all([
      this.settingRepo.findByTenant(tenantId, "customer_created"),
      this.prefRepo.findEmailOverridesForUsers(tenantId, managers.map((m) => m.id), "customer_created"),
    ]);
    const now = new Date();

    const rows: CreateUserNotificationInput[] = [];
    const emailJobs: { payload: TeamNotificationEmailPayload; startAfter: Date | undefined }[] = [];

    for (const m of managers) {
      const delivery = resolveDelivery({
        eventType: "customer_created",
        tenantSetting: tenantSetting ? { enabled: tenantSetting.enabled, defaultChannels: tenantSetting.defaultChannels } : null,
        emailOverrideEnabled: overrides.get(m.id) ?? null,
        prefs: { deliveryMode: m.notificationDeliveryMode, quietHoursStart: m.quietHoursStart, quietHoursEnd: m.quietHoursEnd },
        now,
      });
      if (!delivery.eventEnabled) continue;

      if (delivery.inApp) {
        rows.push({
          userId: m.id,
          type: "customer_created",
          title: "Novo cliente cadastrado",
          body: `${customer.name} acabou de se cadastrar.`,
          data: { customerId: customer.id, customerName: customer.name },
        });
      }
      if (delivery.email) {
        emailJobs.push({
          payload: { tenantId, userId: m.id, eventType: "customer_created", variables: { cliente: customer.name } },
          startAfter: delivery.emailStartAfter ?? undefined,
        });
      }
    }

    if (rows.length > 0) await this.userNotifRepo.createMany(tenantId, rows);

    if (emailJobs.length > 0) {
      const boss = await startPgBoss();
      for (const job of emailJobs) {
        try {
          await boss.send(TEAM_NOTIFICATION_EMAIL_JOB, job.payload, {
            startAfter: job.startAfter,
            retryLimit: 2,
            retryDelay: 300,
          });
        } catch (err) {
          console.error(`[team-notifications] falha ao enfileirar email para ${job.payload.userId}:`, err);
        }
      }
    }
  }
}

export const teamNotificationDispatcher = new TeamNotificationDispatcherService();
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/team-notification-dispatcher.service.test.ts`

Expected: PASS (11 testes).

- [ ] **Step 5: Verificar tipos e commit**

Run: `npx tsc --noEmit` — pode reportar erro em `@/shared/queue/jobs/team-notification-email` (ainda não existe, Task 13). Se ocorrer, siga para a Task 11 e volte a rodar `tsc` só no fim da Task 13.

```bash
git add src/domains/notifications/user-notifications/team-notification-dispatcher.service.ts src/domains/notifications/user-notifications/team-notification-dispatcher.service.test.ts
git commit -m "feat(notifications): dispatcher generico orientado a eventType"
```

---

### Task 11: Rewiring das inscrições de eventos

**Files:**
- Modify: `src/domains/notifications/user-notifications/user-notifications.subscriptions.ts`

**Interfaces:**
- Consumes: `teamNotificationDispatcher` (Task 10).
- Produces: `registerUserNotificationSubscriptions()` (mesma assinatura, comportamento ampliado).

- [ ] **Step 1: Reescrever o arquivo completo**

```typescript
// src/domains/notifications/user-notifications/user-notifications.subscriptions.ts
import { eventBus } from "@/shared/events/event-bus";
import { teamNotificationDispatcher } from "./team-notification-dispatcher.service";

let registered = false;

export function registerUserNotificationSubscriptions(): void {
  if (registered) return;
  registered = true;

  eventBus.subscribe("scheduling.appointment.created", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchAppointmentEvent("appointment_created", payload);
    } catch (err) {
      console.error("[team-notifications] created:", err);
    }
  });

  eventBus.subscribe("scheduling.appointment.cancelled", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchAppointmentEvent("appointment_cancelled", payload);
    } catch (err) {
      console.error("[team-notifications] cancelled:", err);
    }
  });

  eventBus.subscribe("scheduling.appointment.no_show", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchAppointmentEvent("appointment_no_show", payload);
    } catch (err) {
      console.error("[team-notifications] no_show:", err);
    }
  });

  eventBus.subscribe("scheduling.appointment.rescheduled", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchAppointmentRescheduled({
        tenantId: payload.tenantId,
        appointmentId: payload.appointmentId,
        customerId: payload.customerId,
        customerName: payload.customerName,
        newStartsAt: payload.newStartsAt,
      });
    } catch (err) {
      console.error("[team-notifications] rescheduled:", err);
    }
  });

  eventBus.subscribe("crm.customer.created", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchCustomerCreated({
        tenantId: payload.tenantId,
        customer: { id: payload.customer.id, name: payload.customer.name },
      });
    } catch (err) {
      console.error("[team-notifications] customer.created:", err);
    }
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`

Expected: sem erros novos relacionados a este arquivo (o erro de `team-notification-email` ainda pode aparecer até a Task 13).

- [ ] **Step 3: Commit**

```bash
git add src/domains/notifications/user-notifications/user-notifications.subscriptions.ts
git commit -m "feat(notifications): liga o dispatcher genérico aos eventos de agendamento e cliente"
```

---

### Task 12: Atualizar `user-notification.service.ts` — remover disparo antigo, manter leitura, dual-write das prefs

**Files:**
- Modify: `src/domains/notifications/user-notifications/user-notification.service.ts`
- Modify: `src/domains/notifications/user-notifications/user-notification.service.test.ts`

**Interfaces:**
- Produces: `UserNotificationService` perde `notifyAppointment`/`notifyCustomerCreated` (agora no dispatcher); mantém `listForUser`, `markRead`; `updatePreferences` ganha dual-write para `UserNotificationPreference` quando `notifyEmailAppointments` é alterado.

- [ ] **Step 1: Substituir o conteúdo do teste** — remover os dois `describe` de `notifyAppointment`/`notifyCustomerCreated` (linhas 45-193 do arquivo atual) e manter/ampliar o restante:

```typescript
// src/domains/notifications/user-notifications/user-notification.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserNotificationService } from "./user-notification.service";

const repo = {
  createMany: vi.fn(),
  findManagers: vi.fn(),
  findManyForUser: vi.fn(),
  countUnread: vi.fn(),
  findUserPrefs: vi.fn(),
  findTenantName: vi.fn(),
  markRead: vi.fn(),
  updatePrefs: vi.fn(),
};

const prefRepo = { upsertEmailOverride: vi.fn() };

describe("UserNotificationService.listForUser", () => {
  let service: UserNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never, prefRepo as never);
  });

  it("retorna items, unreadCount, isManager e prefs", async () => {
    repo.findUserPrefs.mockResolvedValue({
      id: "u1", email: "u1@x.com", name: "U1", role: "OWNER",
      notifyEmailAppointments: true, notifyOwnAppointments: false, notifyTeamAppointments: true,
    });
    repo.findManyForUser.mockResolvedValue([{ id: "n1" }]);
    repo.countUnread.mockResolvedValue(2);

    const result = await service.listForUser("t1", "u1", { period: "7", limit: 20 });

    expect(result.isManager).toBe(true);
    expect(result.unreadCount).toBe(2);
    expect(result.items).toHaveLength(1);
  });
});

describe("UserNotificationService.markRead", () => {
  it("delega ao repository", async () => {
    const service = new UserNotificationService(repo as never, prefRepo as never);
    repo.markRead.mockResolvedValue(3);
    const count = await service.markRead("t1", "u1", { all: true });
    expect(count).toBe(3);
    expect(repo.markRead).toHaveBeenCalledWith("t1", "u1", { all: true });
  });
});

describe("UserNotificationService.updatePreferences", () => {
  let service: UserNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never, prefRepo as never);
    repo.updatePrefs.mockResolvedValue({
      notifyEmailAppointments: true, notifyOwnAppointments: false, notifyTeamAppointments: true,
    });
  });

  it("atualiza o boolean legado no repository", async () => {
    await service.updatePreferences("t1", "u1", { notifyEmailAppointments: true });
    expect(repo.updatePrefs).toHaveBeenCalledWith("t1", "u1", { notifyEmailAppointments: true });
  });

  it("dual-write: ao mudar notifyEmailAppointments, grava override EMAIL nos 4 eventos de agendamento", async () => {
    await service.updatePreferences("t1", "u1", { notifyEmailAppointments: false });
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledTimes(4);
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "appointment_created", false);
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "appointment_cancelled", false);
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "appointment_rescheduled", false);
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "appointment_no_show", false);
  });

  it("não escreve na tabela nova quando notifyEmailAppointments não é enviado (ex.: só notifyOwnAppointments)", async () => {
    await service.updatePreferences("t1", "u1", { notifyOwnAppointments: true });
    expect(prefRepo.upsertEmailOverride).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.service.test.ts`

Expected: FAIL — construtor ainda não aceita `prefRepo`, `updatePreferences` não faz dual-write.

- [ ] **Step 3: Reescrever o service**

```typescript
// src/domains/notifications/user-notifications/user-notification.service.ts
import type { UserNotification } from "@prisma/client";

import { userNotificationRepository, UserNotificationRepository } from "./user-notification.repository";
import {
  userNotificationPreferenceRepository,
  UserNotificationPreferenceRepository,
} from "./user-notification-preference.repository";
import type { NotificationPrefs } from "./types";

const EMAIL_OVERRIDE_EVENTS = [
  "appointment_created",
  "appointment_cancelled",
  "appointment_rescheduled",
  "appointment_no_show",
] as const;

export class UserNotificationService {
  constructor(
    private readonly repo: UserNotificationRepository = userNotificationRepository,
    private readonly prefRepo: UserNotificationPreferenceRepository = userNotificationPreferenceRepository,
  ) {}

  async listForUser(
    tenantId: string,
    userId: string,
    opts: { period: "7" | "30" | "all"; limit: number },
  ): Promise<{ items: UserNotification[]; unreadCount: number; isManager: boolean; prefs: NotificationPrefs }> {
    const prefsRow = await this.repo.findUserPrefs(tenantId, userId);
    const since =
      opts.period === "all"
        ? undefined
        : new Date(Date.now() - Number(opts.period) * 24 * 60 * 60 * 1000);

    const [items, unreadCount] = await Promise.all([
      this.repo.findManyForUser(tenantId, userId, { since, limit: opts.limit }),
      this.repo.countUnread(tenantId, userId),
    ]);

    return {
      items,
      unreadCount,
      isManager: prefsRow?.role === "OWNER" || prefsRow?.role === "MANAGER",
      prefs: {
        notifyEmailAppointments: prefsRow?.notifyEmailAppointments ?? false,
        notifyOwnAppointments: prefsRow?.notifyOwnAppointments ?? false,
        notifyTeamAppointments: prefsRow?.notifyTeamAppointments ?? true,
      },
    };
  }

  markRead(tenantId: string, userId: string, arg: { id?: string; all?: boolean }): Promise<number> {
    return this.repo.markRead(tenantId, userId, arg);
  }

  // Mantém o boolean legado (ainda lido pelo dispatcher para notifyOwnAppointments/
  // notifyTeamAppointments — ver "Decisão de escopo explícita" no plano) e, quando
  // notifyEmailAppointments muda, espelha em UserNotificationPreference (dual-write)
  // para que o dispatcher novo (que lê a tabela nova) não fique dessincronizado da
  // UI antiga de 3 switches enquanto a aba nova (próximo plano) não substitui a UI.
  async updatePreferences(
    tenantId: string,
    userId: string,
    prefs: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    const updated = await this.repo.updatePrefs(tenantId, userId, prefs);

    if (prefs.notifyEmailAppointments !== undefined) {
      await Promise.all(
        EMAIL_OVERRIDE_EVENTS.map((eventType) =>
          this.prefRepo.upsertEmailOverride(tenantId, userId, eventType, prefs.notifyEmailAppointments!),
        ),
      );
    }

    return updated;
  }
}

export const userNotificationService = new UserNotificationService();
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.service.test.ts`

Expected: PASS (6 testes).

- [ ] **Step 5: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/user-notification.service.ts src/domains/notifications/user-notifications/user-notification.service.test.ts
git commit -m "refactor(notifications): remove disparo antigo do service, mantem leitura e dual-write de prefs"
```

---

### Task 13: Job de e-mail durável (`team-notification-email`)

**Files:**
- Create: `src/shared/queue/jobs/team-notification-email.ts`
- Test: `src/shared/queue/jobs/team-notification-email.test.ts`

**Interfaces:**
- Consumes: `notificationTemplateRepository` (Task 7), `getSystemTemplate`/`renderNotification` (Task 4), `getEmailProvider` (já existe).
- Produces: `TEAM_NOTIFICATION_EMAIL_JOB: string`; `TeamNotificationEmailPayload` type (já referenciado pela Task 10); `handleTeamNotificationEmail(jobs): Promise<void>`.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/shared/queue/jobs/team-notification-email.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "pg-boss";
import { handleTeamNotificationEmail, type TeamNotificationEmailPayload } from "./team-notification-email";

const emailSend = vi.fn();
vi.mock("@/domains/notifications/providers/email.provider", () => ({
  getEmailProvider: () => ({ send: emailSend }),
}));

const findByTenant = vi.fn();
vi.mock("@/domains/notifications/user-notifications/notification-template.repository", () => ({
  notificationTemplateRepository: { findByTenant: (...args: unknown[]) => findByTenant(...args) },
}));

const userFindFirst = vi.fn();
const tenantFindFirst = vi.fn();
vi.mock("@/shared/database/prisma", () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => userFindFirst(...args) },
    tenant: { findFirst: (...args: unknown[]) => tenantFindFirst(...args) },
  },
}));

function makeJob(data: TeamNotificationEmailPayload): Job<TeamNotificationEmailPayload>[] {
  return [{ id: "j1", data } as Job<TeamNotificationEmailPayload>];
}

describe("handleTeamNotificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindFirst.mockResolvedValue({ email: "ana@x.com", name: "Ana" });
    tenantFindFirst.mockResolvedValue({ name: "Estúdio X" });
    findByTenant.mockResolvedValue(null); // sem template próprio -> usa fallback do sistema
  });

  it("renderiza o template padrão do sistema e envia por e-mail", async () => {
    await handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "appointment_created",
      variables: { cliente: "Maria", servico: "Corte", data: "13/07", hora: "14:00" },
    }));

    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({
      to: "ana@x.com",
      subject: "Novo agendamento",
    }));
  });

  it("usa o template do tenant quando existe, em vez do padrão do sistema", async () => {
    findByTenant.mockResolvedValue({ subject: "Assunto custom {{cliente}}", body: "Corpo {{cliente}}" });
    await handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "appointment_created", variables: { cliente: "Maria" },
    }));
    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ subject: "Assunto custom Maria" }));
  });

  it("usuário inexistente (removido após enfileirar) não quebra o job", async () => {
    userFindFirst.mockResolvedValue(null);
    await expect(handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "appointment_created", variables: {},
    }))).resolves.toBeUndefined();
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("evento sem template de e-mail definido (in-app only) não envia nada", async () => {
    await handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "birthday_digest", variables: {},
    }));
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("falha do provedor de e-mail é capturada e não propaga", async () => {
    emailSend.mockRejectedValue(new Error("Resend indisponível"));
    await expect(handleTeamNotificationEmail(makeJob({
      tenantId: "t1", userId: "u1", eventType: "appointment_created", variables: { cliente: "Maria" },
    }))).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/shared/queue/jobs/team-notification-email.test.ts`

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/shared/queue/jobs/team-notification-email.ts
import type { Job } from "pg-boss";
import type { NotificationEventType } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { getEmailProvider } from "@/domains/notifications/providers/email.provider";
import { notificationTemplateRepository } from "@/domains/notifications/user-notifications/notification-template.repository";
import { getSystemTemplate } from "@/domains/notifications/user-notifications/system-default-templates";
import { renderNotification } from "@/domains/notifications/user-notifications/notification-template-engine";

export const TEAM_NOTIFICATION_EMAIL_JOB = "team-notification-email";

export type TeamNotificationEmailPayload = {
  tenantId: string;
  userId: string;
  eventType: NotificationEventType;
  variables: Record<string, string>;
};

export async function handleTeamNotificationEmail(jobs: Job<TeamNotificationEmailPayload>[]): Promise<void> {
  for (const job of jobs) {
    const { tenantId, userId, eventType, variables } = job.data;

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { email: true, name: true } });
    if (!user) continue;

    const [customTemplate, tenant] = await Promise.all([
      notificationTemplateRepository.findByTenant(tenantId, eventType, "EMAIL"),
      prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } }),
    ]);
    const template = customTemplate ?? getSystemTemplate(eventType, "EMAIL");
    if (!template) continue; // evento sem template de e-mail (ex.: eventos in-app-only)

    const rendered = renderNotification(template, { ...variables, negocio: tenant?.name ?? "" }, "EMAIL");

    try {
      await getEmailProvider().send({
        to: user.email,
        subject: rendered.subject || "Nova notificação",
        html: `<p>${rendered.body}</p>`,
      });
    } catch (err) {
      console.error(`[team-notification-email] falha ao enviar para ${user.email}:`, err);
    }
  }
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/shared/queue/jobs/team-notification-email.test.ts`

Expected: PASS (5 testes).

- [ ] **Step 5: Verificar tipos (agora sem pendência da Task 10) e commit**

Run: `npx tsc --noEmit`

Expected: sem erros em todo o projeto.

```bash
git add src/shared/queue/jobs/team-notification-email.ts src/shared/queue/jobs/team-notification-email.test.ts
git commit -m "feat(notifications): job durável de envio de email da equipe via tick"
```

---

### Task 14: Job de resumo diário (`team-daily-digest`)

**Files:**
- Create: `src/shared/queue/jobs/team-daily-digest.ts`
- Test: `src/shared/queue/jobs/team-daily-digest.test.ts`

**Interfaces:**
- Consumes: `userNotificationRepository.findAllForDigest/countTodayAppointmentsFor/findTodayForDigest` (Task 9), `tenantNotificationSettingRepository.findByTenant` (Task 5), `userNotificationPreferenceRepository.findEmailOverridesForUsers` (Task 6), `resolveDelivery` (Task 8), `getEmailProvider` (já existe).
- Produces: `TEAM_DAILY_DIGEST_JOB: string`; `handleTeamDailyDigest(): Promise<void>`.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/shared/queue/jobs/team-daily-digest.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTeamDailyDigest } from "./team-daily-digest";

const emailSend = vi.fn();
vi.mock("@/domains/notifications/providers/email.provider", () => ({
  getEmailProvider: () => ({ send: emailSend }),
}));

const tenantFindMany = vi.fn();
vi.mock("@/shared/database/prisma", () => ({
  prisma: { tenant: { findMany: (...args: unknown[]) => tenantFindMany(...args) } },
}));

const findByTenant = vi.fn();
vi.mock("@/domains/notifications/user-notifications/tenant-notification-setting.repository", () => ({
  tenantNotificationSettingRepository: { findByTenant: (...args: unknown[]) => findByTenant(...args) },
}));

const findEmailOverridesForUsers = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification-preference.repository", () => ({
  userNotificationPreferenceRepository: { findEmailOverridesForUsers: (...args: unknown[]) => findEmailOverridesForUsers(...args) },
}));

const findAllForDigest = vi.fn();
const countTodayAppointmentsFor = vi.fn();
const findTodayForDigest = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification.repository", () => ({
  userNotificationRepository: {
    findAllForDigest: (...args: unknown[]) => findAllForDigest(...args),
    countTodayAppointmentsFor: (...args: unknown[]) => countTodayAppointmentsFor(...args),
    findTodayForDigest: (...args: unknown[]) => findTodayForDigest(...args),
  },
}));

describe("handleTeamDailyDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantFindMany.mockResolvedValue([{ id: "t1", name: "Estúdio X" }]);
    findByTenant.mockResolvedValue(null); // default do sistema: daily_digest habilitado, canal EMAIL
    findEmailOverridesForUsers.mockResolvedValue(new Map());
  });

  it("envia o resumo do dia para usuário em modo realtime com daily_digest habilitado", async () => {
    findAllForDigest.mockResolvedValue([{ id: "u1", email: "u1@x.com", notificationDeliveryMode: "realtime" }]);
    countTodayAppointmentsFor.mockResolvedValue(4);

    await handleTeamDailyDigest();

    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: "u1@x.com", subject: "Resumo do seu dia" }));
  });

  it("usuário em modo digest recebe também o consolidado do dia (anti-fadiga)", async () => {
    findAllForDigest.mockResolvedValue([{ id: "u2", email: "u2@x.com", notificationDeliveryMode: "digest" }]);
    countTodayAppointmentsFor.mockResolvedValue(0);
    findTodayForDigest.mockResolvedValue([
      { type: "appointment_created" }, { type: "appointment_created" }, { type: "customer_created" },
    ]);

    await handleTeamDailyDigest();

    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: "u2@x.com", subject: "Seu resumo de notificações de hoje" }));
  });

  it("modo digest sem notificações hoje não envia o consolidado", async () => {
    findAllForDigest.mockResolvedValue([{ id: "u3", email: "u3@x.com", notificationDeliveryMode: "digest" }]);
    findTodayForDigest.mockResolvedValue([]);

    await handleTeamDailyDigest();

    expect(emailSend).not.toHaveBeenCalledWith(expect.objectContaining({ subject: "Seu resumo de notificações de hoje" }));
  });

  it("sem usuários no tenant, não consulta nada mais", async () => {
    findAllForDigest.mockResolvedValue([]);
    await handleTeamDailyDigest();
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("falha de envio em um usuário não impede o processamento dos demais", async () => {
    findAllForDigest.mockResolvedValue([
      { id: "u1", email: "u1@x.com", notificationDeliveryMode: "realtime" },
      { id: "u2", email: "u2@x.com", notificationDeliveryMode: "realtime" },
    ]);
    countTodayAppointmentsFor.mockResolvedValue(1);
    emailSend.mockRejectedValueOnce(new Error("falha")).mockResolvedValueOnce({});

    await expect(handleTeamDailyDigest()).resolves.toBeUndefined();
    expect(emailSend).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/shared/queue/jobs/team-daily-digest.test.ts`

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/shared/queue/jobs/team-daily-digest.ts
import { prisma } from "@/shared/database/prisma";
import { getEmailProvider } from "@/domains/notifications/providers/email.provider";
import { userNotificationRepository } from "@/domains/notifications/user-notifications/user-notification.repository";
import { tenantNotificationSettingRepository } from "@/domains/notifications/user-notifications/tenant-notification-setting.repository";
import { userNotificationPreferenceRepository } from "@/domains/notifications/user-notifications/user-notification-preference.repository";
import { resolveDelivery } from "@/domains/notifications/user-notifications/notification-channel-resolver";

export const TEAM_DAILY_DIGEST_JOB = "team-daily-digest";

// Eventos que já têm seu próprio resumo periódico — não entram de novo no
// consolidado anti-fadiga do modo digest (evitaria duplicar conteúdo).
const DIGEST_EXCLUDED_TYPES = new Set(["daily_digest", "birthday_digest"]);

export async function handleTeamDailyDigest(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });

  for (const tenant of tenants) {
    const users = await userNotificationRepository.findAllForDigest(tenant.id);
    if (users.length === 0) continue;

    const [dailySetting, overrides] = await Promise.all([
      tenantNotificationSettingRepository.findByTenant(tenant.id, "daily_digest"),
      userNotificationPreferenceRepository.findEmailOverridesForUsers(tenant.id, users.map((u) => u.id), "daily_digest"),
    ]);

    for (const user of users) {
      // (a) Resumo do dia — evento próprio, opt-in igual aos demais.
      const dailyDelivery = resolveDelivery({
        eventType: "daily_digest",
        tenantSetting: dailySetting ? { enabled: dailySetting.enabled, defaultChannels: dailySetting.defaultChannels } : null,
        emailOverrideEnabled: overrides.get(user.id) ?? null,
        prefs: { deliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null },
        now: new Date(),
      });
      if (dailyDelivery.eventEnabled && dailyDelivery.email) {
        const todayCount = await userNotificationRepository.countTodayAppointmentsFor(tenant.id, user.id);
        try {
          await getEmailProvider().send({
            to: user.email,
            subject: "Resumo do seu dia",
            html: `<p>Você tem ${todayCount} agendamento(s) hoje em ${tenant.name}.</p>`,
          });
        } catch (err) {
          console.error(`[team-daily-digest] falha no resumo diário de ${user.email}:`, err);
        }
      }

      // (b) Modo digest (anti-fadiga) — consolida os eventos do dia num único e-mail.
      if (user.notificationDeliveryMode === "digest") {
        const items = await userNotificationRepository.findTodayForDigest(tenant.id, user.id);
        const relevant = items.filter((i) => !DIGEST_EXCLUDED_TYPES.has(i.type));
        if (relevant.length === 0) continue;

        const counts = new Map<string, number>();
        for (const i of relevant) counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
        const summary = Array.from(counts.entries()).map(([type, n]) => `${n}x ${type}`).join(", ");

        try {
          await getEmailProvider().send({
            to: user.email,
            subject: "Seu resumo de notificações de hoje",
            html: `<p>${summary}</p>`,
          });
        } catch (err) {
          console.error(`[team-daily-digest] falha no digest de ${user.email}:`, err);
        }
      }
    }
  }
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/shared/queue/jobs/team-daily-digest.test.ts`

Expected: PASS (5 testes).

- [ ] **Step 5: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/shared/queue/jobs/team-daily-digest.ts src/shared/queue/jobs/team-daily-digest.test.ts
git commit -m "feat(notifications): job de resumo diario e consolidado anti-fadiga do modo digest"
```

---

### Task 15: Registrar os 2 jobs novos no `/api/cron/tick`

**Files:**
- Modify: `src/app/api/cron/tick/route.ts`

**Interfaces:**
- Consumes: `TEAM_NOTIFICATION_EMAIL_JOB`/`handleTeamNotificationEmail` (Task 13), `TEAM_DAILY_DIGEST_JOB`/`handleTeamDailyDigest` (Task 14).

- [ ] **Step 1: Adicionar os imports** (junto aos demais imports de job, após o de `user-birthday-digest`):

```typescript
import {
  TEAM_NOTIFICATION_EMAIL_JOB,
  handleTeamNotificationEmail,
  type TeamNotificationEmailPayload,
} from "@/shared/queue/jobs/team-notification-email";
import { TEAM_DAILY_DIGEST_JOB, handleTeamDailyDigest } from "@/shared/queue/jobs/team-daily-digest";
```

- [ ] **Step 2: Registrar o cron do digest** — adicionar ao array de `boss.schedule(...)` dentro do `Promise.all` (junto aos demais, ex. logo após `USER_BIRTHDAY_DIGEST_JOB`):

```typescript
      boss.schedule(TEAM_DAILY_DIGEST_JOB, "0 8 * * *", {}),
```

Nota: `TEAM_NOTIFICATION_EMAIL_JOB` **não** entra nesse array — é enfileirado ad-hoc via `boss.send()` pelo dispatcher (Task 10), exatamente como `APPOINTMENT_REMINDER_JOB` já funciona hoje (também não aparece nesse array de schedule).

- [ ] **Step 3: Processar os 2 jobs** — adicionar ao segundo `Promise.all` (junto aos demais `runBatch`/`runScheduled`):

```typescript
        runBatch<TeamNotificationEmailPayload>(boss, TEAM_NOTIFICATION_EMAIL_JOB, handleTeamNotificationEmail),
        runScheduled(boss, TEAM_DAILY_DIGEST_JOB, handleTeamDailyDigest),
```

E atualizar a desestruturação correspondente e o objeto `processed` do `Response.json` para incluir `teamEmail`/`teamDigest`:

```typescript
    const [reminders, billing, birthday, dailyStatus, recurring, vip, expiry, snapshot, quota, userBirthday, teamEmail, teamDigest] =
      await Promise.all([
        runBatch<AppointmentReminderPayload>(boss, APPOINTMENT_REMINDER_JOB, handleAppointmentReminder),
        runScheduled(boss, BILLING_EXPIRE_SWEEP_JOB, handleBillingExpireSweep),
        runBatch(boss, BIRTHDAY_REMINDER_JOB, handleBirthdayReminder),
        runBatch(boss, DAILY_STATUS_JOB, handleDailyStatus),
        runBatch(boss, RECURRING_EXPENSE_JOB, handleRecurringExpense),
        runBatch(boss, VIP_SWEEP_JOB, handleVipSweep),
        runBatch(boss, SUBSCRIPTION_EXPIRY_WARNINGS_JOB, handleSubscriptionExpiryWarnings),
        runBatch(boss, USAGE_SNAPSHOT_JOB, handleUsageSnapshot),
        runScheduled(boss, WHATSAPP_QUOTA_CLEANUP_JOB, handleWhatsAppQuotaCleanup),
        runScheduled(boss, USER_BIRTHDAY_DIGEST_JOB, handleUserBirthdayDigest),
        runBatch<TeamNotificationEmailPayload>(boss, TEAM_NOTIFICATION_EMAIL_JOB, handleTeamNotificationEmail),
        runScheduled(boss, TEAM_DAILY_DIGEST_JOB, handleTeamDailyDigest),
      ]);

    return Response.json({
      ok: true,
      processed: {
        reminders, billing, birthday, dailyStatus, recurring, vip, expiry, snapshot, quota, userBirthday,
        teamEmail, teamDigest,
      },
    });
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`

Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/tick/route.ts
git commit -m "feat(notifications): registra os jobs de email da equipe e resumo diario no tick"
```

---

### Task 16: Verificação final, ADR e execução manual do backfill

**Files:**
- Modify: `docs/decisions.md`

**Interfaces:** nenhuma nova — esta task só fecha o ciclo de qualidade e documentação.

- [ ] **Step 1: Suíte completa**

Run: `npx tsc --noEmit && npx vitest run`

Expected: 0 erros de tipo; todos os testes passando (novos + existentes, incluindo os que já passavam antes deste plano — `birthday`, `whatsapp`, etc. não devem ter sido afetados).

- [ ] **Step 2: Registrar a evolução do ADR-015** em `docs/decisions.md` — localizar a entrada do ADR-015 (central de notificações da equipe) e adicionar um parágrafo ao final dela:

```markdown
> **Atualização 2026-07-13:** o disparo evoluiu de `notifyAppointment`
> (fire-and-forget, service único) para um dispatcher genérico orientado a
> `eventType`, com configuração em 3 tabelas novas (`TenantNotificationSetting`,
> `UserNotificationPreference`, `NotificationTemplate`) e entrega de e-mail via
> fila durável `pg-boss` (`team-notification-email`, processada pelo
> `/api/cron/tick` — nunca mais inline após a resposta HTTP). Adicionado
> `daily_digest` (resumo do dia) e modo anti-fadiga (`notificationDeliveryMode`
> realtime/digest + `quietHoursStart/End`). Os 3 booleans legados no `User`
> continuam existindo por compatibilidade (`notifyEmailAppointments` com
> dual-write para a tabela nova; `notifyOwnAppointments`/`notifyTeamAppointments`
> lidos diretamente, sem equivalente na tabela nova — ver plano
> `docs/superpowers/plans/2026-07-13-central-notificacoes-equipe-motor.md`).
> A aba de configuração (UI) é entrega separada.
```

- [ ] **Step 3: Commit da documentação**

```bash
git add docs/decisions.md
git commit -m "docs: atualiza ADR-015 com o motor generico de notificacoes da equipe"
```

- [ ] **Step 4: Nota de execução manual (não é um passo de código — é uma instrução para quem faz o deploy)**

Após o merge e o deploy da migration em produção (`npx prisma migrate deploy` — deploy manual, este projeto não roda migrations no build da Vercel), rodar uma única vez:

```bash
node scripts/backfill-team-notification-preferences.mjs
```

Isso preenche `UserNotificationPreference` com o equivalente de `notifyEmailAppointments` para todos os usuários existentes, evitando que tenants antigos percam a preferência de e-mail que já tinham configurado.

---

## Fora de escopo deste plano (fica para o próximo)

- **UI da aba `Configurações › Notificações`** (sub-abas "Avisos do negócio" e "Minhas preferências", editor de template com chips `{{variavel}}` e preview, matriz de canais) — plano seguinte, consome as rotas de API que ainda não existem (`/api/notifications/team-settings`, `/api/notifications/templates`) e que também ficam para esse próximo plano.
- **Exposição do worklist de pendências via API/UI** — a Task 9 já entrega `findPendingWorklist` testado no repository, mas nenhuma rota HTTP nem componente consome esse método ainda. Fica para o próximo plano, junto da UI (ver `notification-panel.tsx`, que precisará de uma seção nova para renderizar isso).
- **Seed de defaults por cargo** ao criar um tenant novo (dono operacional + resumo + financeiro; profissional só os próprios agendamentos) — hoje o resolvedor cai no `SYSTEM_DEFAULT_TENANT_SETTINGS` genérico (Task 8) para todo tenant sem configuração própria; a diferenciação por cargo é UI + seed, fica com o próximo plano.
- **Digest de pendências por e-mail** e **`customer_inactive`** — Fase 1-b do spec.
- **`agenda_idle`, `monthly_goal`, snooze/"resolver"** — Fase 2 do spec.
- **Remoção dos 3 booleans legados** — só depois que a UI nova (próximo plano) parar de depender deles.
