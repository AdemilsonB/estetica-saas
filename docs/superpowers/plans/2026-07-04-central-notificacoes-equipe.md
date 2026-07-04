# Central de notificações da equipe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada membro da equipe uma central de notificações in-app (sino com alerta) para novos agendamentos, cancelamentos, novos clientes e aniversariantes da semana, com e-mail opcional para agendamentos.

**Architecture:** Nova tabela `UserNotification` (uma linha por destinatário). Um submódulo do domínio `notifications` assina eventos do event bus (`scheduling.appointment.created/cancelled`, `crm.customer.created`) e um job semanal pg-boss, calcula destinatários (profissional do atendimento + gestores OWNER/MANAGER, com regras de auto-skip e opt-in), grava as notificações e dispara e-mail opcional via Resend. O frontend expõe um sino (`<NotificationBell>`) no `AppShell` (desktop) e `MobileHeader` (mobile) com polling de 30s via TanStack Query.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma, PostgreSQL (Supabase), pg-boss, Zod, TanStack Query, Vitest, Shadcn UI.

## Global Constraints

- Todo output em Português do Brasil (código, comentários, mensagens, UI).
- `tenantId` e `userId` **sempre** do token (`getSessionContext`), nunca do body/URL.
- Todo model de negócio tem `tenantId` + `@@index([tenantId])`; repository filtra `tenantId` em todas as queries.
- Sem `any`, sem `as unknown as`; `npx tsc --noEmit` deve dar zero erros.
- Erros de domínio tipados de `src/shared/errors/`; nunca `throw new Error('string')`.
- Zod para validação de input em toda API Route.
- Domínios não se importam diretamente; comunicação entre domínios via `eventBus`.
- Falha de notificação nunca quebra o fluxo principal (try/catch + log).
- "Gestor" = `User.role ∈ { OWNER, MANAGER }` (enum `UserRole` no schema).
- Central liberada para todos (sem feature gate). E-mail é transacional (Resend), não a automação paga de WhatsApp.
- Tipos válidos de `UserNotification.type`: `appointment_created`, `appointment_cancelled`, `customer_created`, `birthday_digest`.
- `notifyOwnAppointments` (auto-skip) aplica-se **só** ao tipo `appointment_created`.
- Componentes com loading/empty/error; checklist mobile-first do `agent-mobile` antes da entrega de UI.

---

## File Structure

**Backend / domínio:**
- `prisma/schema.prisma` — model `UserNotification` + 3 campos de preferência no `User` (modificar)
- `src/domains/notifications/user-notifications/types.ts` — tipos do submódulo (criar)
- `src/domains/notifications/user-notifications/user-notification.repository.ts` — acesso a dados (criar)
- `src/domains/notifications/user-notifications/user-notification.service.ts` — regras/destinatários (criar)
- `src/domains/notifications/user-notifications/user-notifications.subscriptions.ts` — assinaturas de eventos (criar)
- `src/domains/notifications/providers/email-templates.ts` — templates de e-mail p/ profissional (modificar)
- `src/domains/notifications/notification.service.ts` — mapa `EMAIL_SUBJECTS`/`buildEmailHtml` (modificar) OU e-mail próprio no service novo (ver Task 3)
- `src/shared/queue/jobs/user-birthday-digest.ts` — job semanal (criar)
- `src/app/api/cron/tick/route.ts` — registrar/rodar o novo job (modificar)
- `src/app/api/_lib/runtime.ts` — registrar as novas subscriptions (modificar)

**API:**
- `src/app/api/notifications/me/route.ts` — GET feed + unreadCount (criar)
- `src/app/api/notifications/me/read/route.ts` — POST marcar lida (criar)
- `src/app/api/notifications/me/prefs/route.ts` — PATCH preferências (criar)

**Frontend:**
- `src/domains/notifications/user-notifications/notification-view.ts` — funções puras (agrupar/filtrar) (criar)
- `src/hooks/notifications/use-user-notifications.ts` — hook TanStack Query (criar)
- `src/components/domain/notifications/notification-bell.tsx` (criar)
- `src/components/domain/notifications/notification-panel.tsx` (criar)
- `src/components/domain/notifications/notification-item.tsx` (criar)
- `src/components/domain/notifications/notification-preferences.tsx` (criar)
- `src/components/app/app-shell.tsx` — inserir sino no topo da sidebar (modificar)
- `src/components/app/mobile-header.tsx` — inserir sino à esquerda da logo (modificar)

---

## Task 1: Schema — model `UserNotification` + preferências no `User`

**Files:**
- Modify: `prisma/schema.prisma` (model `User` ~261-289; adicionar model novo perto de `NotificationLog` ~516)

**Interfaces:**
- Produces: model Prisma `UserNotification` (campos: `id, tenantId, userId, type, title, body, data Json, readAt DateTime?, createdAt`); campos `User.notifyEmailAppointments`, `User.notifyOwnAppointments`, `User.notifyTeamAppointments`; relação `User.userNotifications` e `Tenant.userNotifications`.

- [ ] **Step 1: Adicionar os 3 campos de preferência e a relação no model `User`**

No model `User` (após a linha `showOnPublicPage Boolean @default(true)`), adicionar:

```prisma
  notifyEmailAppointments Boolean @default(false)
  notifyOwnAppointments   Boolean @default(false)
  notifyTeamAppointments  Boolean @default(true)
```

E na seção de relações do `User` (junto de `notifications NotificationLog[]`), adicionar:

```prisma
  userNotifications UserNotification[]
```

- [ ] **Step 2: Adicionar a relação no model `Tenant`**

No model `Tenant`, junto das demais relações (onde há outros `[]` como `notifications`), adicionar:

```prisma
  userNotifications UserNotification[]
```

- [ ] **Step 3: Adicionar o model `UserNotification`** (logo após o model `NotificationLog`)

```prisma
model UserNotification {
  id        String    @id @default(cuid())
  tenantId  String
  userId    String
  type      String
  title     String
  body      String
  data      Json
  readAt    DateTime?
  createdAt DateTime  @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId, readAt])
  @@index([tenantId, userId, createdAt])
}
```

- [ ] **Step 4: Formatar e validar o schema**

Run: `npx prisma format && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Gerar a migration e o client**

Run: `npx prisma migrate dev --name add_user_notifications`
Expected: migration criada em `prisma/migrations/`, `Prisma Client` regenerado, sem erros.
(Se o ambiente não tiver banco de dev acessível, usar `npx prisma db push` + `npx prisma generate` e criar a migration manualmente depois — a migration é 100% aditiva, sem `DROP`.)

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros (o Prisma Client agora conhece `UserNotification` e os campos novos).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(notifications): schema UserNotification + preferências de notificação no User"
```

---

## Task 2: `UserNotificationRepository`

**Files:**
- Create: `src/domains/notifications/user-notifications/types.ts`
- Create: `src/domains/notifications/user-notifications/user-notification.repository.ts`
- Test: `src/domains/notifications/user-notifications/user-notification.repository.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/shared/database/prisma`; `prismaMock` de `@/shared/test/prisma-mock`.
- Produces:
  - Tipo `UserNotificationType = "appointment_created" | "appointment_cancelled" | "customer_created" | "birthday_digest"`.
  - Tipo `NotificationPrefs = { notifyEmailAppointments: boolean; notifyOwnAppointments: boolean; notifyTeamAppointments: boolean }`.
  - Tipo `CreateUserNotificationInput = { userId: string; type: UserNotificationType; title: string; body: string; data: Prisma.InputJsonValue }`.
  - Classe `UserNotificationRepository` com:
    - `createMany(tenantId: string, rows: CreateUserNotificationInput[]): Promise<number>`
    - `findManyForUser(tenantId: string, userId: string, opts: { since?: Date; limit: number }): Promise<UserNotification[]>`
    - `countUnread(tenantId: string, userId: string): Promise<number>`
    - `markRead(tenantId: string, userId: string, arg: { id?: string; all?: boolean }): Promise<number>`
    - `findManagers(tenantId: string): Promise<{ id: string; email: string; name: string; notifyEmailAppointments: boolean; notifyOwnAppointments: boolean; notifyTeamAppointments: boolean }[]>`
    - `findUserPrefs(tenantId: string, userId: string): Promise<(NotificationPrefs & { id: string; email: string; name: string; role: UserRole }) | null>`
    - `updatePrefs(tenantId: string, userId: string, prefs: Partial<NotificationPrefs>): Promise<NotificationPrefs>`
  - Instância exportada `userNotificationRepository`.

- [ ] **Step 1: Criar `types.ts`**

```typescript
import type { Prisma, UserRole } from "@prisma/client";

export type UserNotificationType =
  | "appointment_created"
  | "appointment_cancelled"
  | "customer_created"
  | "birthday_digest";

export type NotificationPrefs = {
  notifyEmailAppointments: boolean;
  notifyOwnAppointments: boolean;
  notifyTeamAppointments: boolean;
};

export type CreateUserNotificationInput = {
  userId: string;
  type: UserNotificationType;
  title: string;
  body: string;
  data: Prisma.InputJsonValue;
};

export type ManagerRecipient = {
  id: string;
  email: string;
  name: string;
} & NotificationPrefs;

export type UserPrefsRow = NotificationPrefs & {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};
```

- [ ] **Step 2: Escrever o teste que falha**

Arquivo `user-notification.repository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { UserNotificationRepository } from "./user-notification.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("UserNotificationRepository", () => {
  let repo: UserNotificationRepository;

  beforeEach(() => {
    repo = new UserNotificationRepository();
    vi.clearAllMocks();
  });

  it("createMany insere linhas com tenantId injetado", async () => {
    prismaMock.userNotification.createMany.mockResolvedValue({ count: 2 } as never);

    const count = await repo.createMany("t1", [
      { userId: "u1", type: "appointment_created", title: "a", body: "b", data: {} },
      { userId: "u2", type: "appointment_created", title: "a", body: "b", data: {} },
    ]);

    expect(count).toBe(2);
    expect(prismaMock.userNotification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ tenantId: "t1", userId: "u1" }),
        expect.objectContaining({ tenantId: "t1", userId: "u2" }),
      ],
    });
  });

  it("findManyForUser filtra por tenant e user e aplica since/limit", async () => {
    prismaMock.userNotification.findMany.mockResolvedValue([] as never);
    const since = new Date("2026-07-01");

    await repo.findManyForUser("t1", "u1", { since, limit: 50 });

    expect(prismaMock.userNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", userId: "u1", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });

  it("countUnread conta readAt null do usuário", async () => {
    prismaMock.userNotification.count.mockResolvedValue(3);
    const n = await repo.countUnread("t1", "u1");
    expect(n).toBe(3);
    expect(prismaMock.userNotification.count).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "u1", readAt: null },
    });
  });

  it("markRead com all=true marca todas as não-lidas do usuário", async () => {
    prismaMock.userNotification.updateMany.mockResolvedValue({ count: 4 } as never);
    const n = await repo.markRead("t1", "u1", { all: true });
    expect(n).toBe(4);
    expect(prismaMock.userNotification.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "u1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it("markRead com id marca apenas aquela notificação do usuário", async () => {
    prismaMock.userNotification.updateMany.mockResolvedValue({ count: 1 } as never);
    const n = await repo.markRead("t1", "u1", { id: "n9" });
    expect(n).toBe(1);
    expect(prismaMock.userNotification.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "u1", id: "n9", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it("findManagers busca OWNER e MANAGER do tenant", async () => {
    prismaMock.user.findMany.mockResolvedValue([] as never);
    await repo.findManagers("t1");
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", role: { in: ["OWNER", "MANAGER"] } },
      }),
    );
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.repository.test.ts`
Expected: FAIL (módulo `./user-notification.repository` não existe).

- [ ] **Step 4: Implementar o repository**

```typescript
import type { Prisma, UserNotification } from "@prisma/client";
import { UserRole } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import type {
  CreateUserNotificationInput,
  ManagerRecipient,
  NotificationPrefs,
  UserPrefsRow,
} from "./types";

export class UserNotificationRepository {
  async createMany(tenantId: string, rows: CreateUserNotificationInput[]): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await prisma.userNotification.createMany({
      data: rows.map((r) => ({ ...r, tenantId })),
    });
    return result.count;
  }

  async findManyForUser(
    tenantId: string,
    userId: string,
    opts: { since?: Date; limit: number },
  ): Promise<UserNotification[]> {
    const where: Prisma.UserNotificationWhereInput = {
      tenantId,
      userId,
      ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
    };
    return prisma.userNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
    });
  }

  async countUnread(tenantId: string, userId: string): Promise<number> {
    return prisma.userNotification.count({
      where: { tenantId, userId, readAt: null },
    });
  }

  async markRead(
    tenantId: string,
    userId: string,
    arg: { id?: string; all?: boolean },
  ): Promise<number> {
    const where: Prisma.UserNotificationWhereInput = {
      tenantId,
      userId,
      readAt: null,
      ...(arg.id ? { id: arg.id } : {}),
    };
    const result = await prisma.userNotification.updateMany({
      where,
      data: { readAt: new Date() },
    });
    return result.count;
  }

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
      },
    });
  }

  async findUserPrefs(tenantId: string, userId: string): Promise<UserPrefsRow | null> {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        notifyEmailAppointments: true,
        notifyOwnAppointments: true,
        notifyTeamAppointments: true,
      },
    });
  }

  async updatePrefs(
    tenantId: string,
    userId: string,
    prefs: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: prefs,
      select: {
        notifyEmailAppointments: true,
        notifyOwnAppointments: true,
        notifyTeamAppointments: true,
      },
    });
    return updated;
  }
}

export const userNotificationRepository = new UserNotificationRepository();
```

Nota: `updatePrefs` usa `update` por `id` (o `userId` já veio validado do token); o `tenantId` é mantido na assinatura por consistência e uso futuro em auditoria.

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.repository.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/user-notifications/types.ts src/domains/notifications/user-notifications/user-notification.repository.ts src/domains/notifications/user-notifications/user-notification.repository.test.ts
git commit -m "feat(notifications): UserNotificationRepository com feed, contador e preferências"
```

---

## Task 3: Templates de e-mail para o profissional

**Files:**
- Modify: `src/domains/notifications/providers/email-templates.ts`
- Test: `src/domains/notifications/providers/email-templates.test.ts` (criar se não existir; senão adicionar `describe`)

**Interfaces:**
- Produces: funções `professionalNewAppointmentHtml(data)` e `professionalCancelledAppointmentHtml(data)`, ambas `(data: { professionalName: string; customerName: string; serviceName: string; dateTime: string; tenantName: string }) => string`.

- [ ] **Step 1: Escrever o teste que falha**

Em `email-templates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  professionalNewAppointmentHtml,
  professionalCancelledAppointmentHtml,
} from "./email-templates";

const data = {
  professionalName: "Ana",
  customerName: "Maria",
  serviceName: "Corte",
  dateTime: "hoje às 14h",
  tenantName: "Salão da Ana",
};

describe("templates de e-mail do profissional", () => {
  it("novo agendamento inclui cliente, serviço e horário", () => {
    const html = professionalNewAppointmentHtml(data);
    expect(html).toContain("Maria");
    expect(html).toContain("Corte");
    expect(html).toContain("hoje às 14h");
  });

  it("cancelamento sinaliza o cancelamento", () => {
    const html = professionalCancelledAppointmentHtml(data);
    expect(html.toLowerCase()).toContain("cancel");
    expect(html).toContain("Maria");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/providers/email-templates.test.ts`
Expected: FAIL (funções não exportadas).

- [ ] **Step 3: Implementar os templates** (adicionar ao final de `email-templates.ts`, reusando o estilo/wrapper já existente no arquivo)

```typescript
type ProfessionalEmailData = {
  professionalName: string;
  customerName: string;
  serviceName: string;
  dateTime: string;
  tenantName: string;
};

export function professionalNewAppointmentHtml(data: ProfessionalEmailData): string {
  return `
    <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">Novo agendamento</h2>
      <p>Olá, ${data.professionalName}!</p>
      <p><strong>${data.customerName}</strong> agendou <strong>${data.serviceName}</strong> para <strong>${data.dateTime}</strong>.</p>
      <p style="color: #666; font-size: 13px;">${data.tenantName}</p>
    </div>
  `;
}

export function professionalCancelledAppointmentHtml(data: ProfessionalEmailData): string {
  return `
    <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Agendamento cancelado</h2>
      <p>Olá, ${data.professionalName}!</p>
      <p>O agendamento de <strong>${data.customerName}</strong> (${data.serviceName}) para <strong>${data.dateTime}</strong> foi cancelado.</p>
      <p style="color: #666; font-size: 13px;">${data.tenantName}</p>
    </div>
  `;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domains/notifications/providers/email-templates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/providers/email-templates.ts src/domains/notifications/providers/email-templates.test.ts
git commit -m "feat(notifications): templates de e-mail de agendamento para o profissional"
```

---

## Task 4: `UserNotificationService` (regra de destinatários)

**Files:**
- Create: `src/domains/notifications/user-notifications/user-notification.service.ts`
- Test: `src/domains/notifications/user-notifications/user-notification.service.test.ts`

**Interfaces:**
- Consumes: `userNotificationRepository` (Task 2); `getEmailProvider` de `@/domains/notifications/providers/email.provider`; templates da Task 3; `AppointmentEventPayload` (shape do `scheduling.appointment.created` em `domain-events.ts`: `{ tenantId, appointment, customer, service, professional }`, onde `appointment.createdByUserId: string | null`).
- Produces: instância `userNotificationService` com:
  - `notifyAppointment(payload: AppointmentEventPayload, kind: "created" | "cancelled"): Promise<void>`
  - `notifyCustomerCreated(payload: { tenantId: string; customer: { id: string; name: string } }): Promise<void>`
  - `listForUser(tenantId: string, userId: string, opts: { period: "7" | "30" | "all"; limit: number }): Promise<{ items: UserNotification[]; unreadCount: number; isManager: boolean; prefs: NotificationPrefs }>`
  - `markRead(tenantId: string, userId: string, arg: { id?: string; all?: boolean }): Promise<number>`
  - `updatePreferences(tenantId: string, userId: string, prefs: Partial<NotificationPrefs>): Promise<NotificationPrefs>`

- [ ] **Step 1: Escrever o teste que falha** (foco na regra de destinatários)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserNotificationService } from "./user-notification.service";

const repo = {
  createMany: vi.fn(),
  findManagers: vi.fn(),
  findManyForUser: vi.fn(),
  countUnread: vi.fn(),
  findUserPrefs: vi.fn(),
  markRead: vi.fn(),
  updatePrefs: vi.fn(),
};

const emailSend = vi.fn();
vi.mock("@/domains/notifications/providers/email.provider", () => ({
  getEmailProvider: () => ({ send: emailSend }),
}));

function makePayload(over: Partial<{ createdByUserId: string | null; profId: string; profEmail: string }> = {}) {
  return {
    tenantId: "t1",
    appointment: {
      id: "a1",
      createdByUserId: over.createdByUserId ?? null,
      startsAt: new Date("2026-07-04T14:00:00Z"),
    },
    customer: { id: "c1", name: "Maria", phone: null, email: null },
    service: { id: "s1", name: "Corte", duration: 30 },
    professional: { id: over.profId ?? "prof1", name: "Ana", email: over.profEmail ?? "ana@x.com" },
  } as never;
}

describe("UserNotificationService.notifyAppointment", () => {
  let service: UserNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never);
    repo.findManagers.mockResolvedValue([]);
    repo.createMany.mockResolvedValue(1);
  });

  it("agendamento público (createdByUserId null) notifica o profissional", async () => {
    await service.notifyAppointment(makePayload(), "created");
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows.map((r: { userId: string }) => r.userId)).toContain("prof1");
    expect(rows[0].type).toBe("appointment_created");
  });

  it("auto-agendamento sem opt-in NÃO notifica o próprio criador", async () => {
    // profissional é o próprio criador e não optou por se notificar
    repo.findManagers.mockResolvedValue([]);
    await service.notifyAppointment(
      makePayload({ createdByUserId: "prof1", profId: "prof1" }),
      "created",
    );
    // prof1 é o único candidato e deve ser pulado -> createMany não chamado ou sem prof1
    const called = repo.createMany.mock.calls.length > 0;
    const rows = called ? repo.createMany.mock.calls[0][1] : [];
    expect(rows.find((r: { userId: string }) => r.userId === "prof1")).toBeUndefined();
  });

  it("gestor com notifyTeamAppointments=false não recebe agendamento de outro profissional", async () => {
    repo.findManagers.mockResolvedValue([
      { id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: false },
    ]);
    await service.notifyAppointment(makePayload(), "created");
    const rows = repo.createMany.mock.calls[0]?.[1] ?? [];
    expect(rows.find((r: { userId: string }) => r.userId === "owner1")).toBeUndefined();
    expect(rows.find((r: { userId: string }) => r.userId === "prof1")).toBeDefined();
  });

  it("dedup: profissional que também é gestor recebe uma única notificação", async () => {
    repo.findManagers.mockResolvedValue([
      { id: "prof1", email: "ana@x.com", name: "Ana", notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: true },
    ]);
    await service.notifyAppointment(makePayload(), "created");
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows.filter((r: { userId: string }) => r.userId === "prof1")).toHaveLength(1);
  });

  it("envia e-mail apenas para quem tem notifyEmailAppointments=true", async () => {
    repo.findManagers.mockResolvedValue([
      { id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: true, notifyOwnAppointments: false, notifyTeamAppointments: true },
    ]);
    await service.notifyAppointment(makePayload(), "created");
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: "o@x.com" }));
  });

  it("cancelamento ignora a regra de auto-skip (sempre notifica o profissional)", async () => {
    await service.notifyAppointment(
      makePayload({ createdByUserId: "prof1", profId: "prof1" }),
      "cancelled",
    );
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows.find((r: { userId: string }) => r.userId === "prof1")).toBeDefined();
    expect(rows[0].type).toBe("appointment_cancelled");
  });
});

describe("UserNotificationService.notifyCustomerCreated", () => {
  let service: UserNotificationService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never);
    repo.createMany.mockResolvedValue(1);
  });

  it("notifica apenas gestores, sem e-mail", async () => {
    repo.findManagers.mockResolvedValue([
      { id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: true, notifyOwnAppointments: false, notifyTeamAppointments: true },
    ]);
    await service.notifyCustomerCreated({ tenantId: "t1", customer: { id: "c1", name: "João" } });
    const rows = repo.createMany.mock.calls[0][1];
    expect(rows[0].userId).toBe("owner1");
    expect(rows[0].type).toBe("customer_created");
    expect(emailSend).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.service.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar o service**

```typescript
import type { UserNotification } from "@prisma/client";

import { getEmailProvider } from "@/domains/notifications/providers/email.provider";
import {
  professionalNewAppointmentHtml,
  professionalCancelledAppointmentHtml,
} from "@/domains/notifications/providers/email-templates";
import { userNotificationRepository, UserNotificationRepository } from "./user-notification.repository";
import type {
  CreateUserNotificationInput,
  ManagerRecipient,
  NotificationPrefs,
  UserNotificationType,
} from "./types";

type AppointmentPayload = {
  tenantId: string;
  appointment: { id: string; createdByUserId: string | null; startsAt: Date };
  customer: { id: string; name: string };
  service: { id: string; name: string };
  professional: { id: string; name: string; email: string };
};

// Destinatário candidato normalizado (profissional do atendimento ou gestor).
type Candidate = {
  id: string;
  name: string;
  email: string;
  isProfessional: boolean; // é o profissional do atendimento
  isManager: boolean; // OWNER/MANAGER
} & NotificationPrefs;

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export class UserNotificationService {
  constructor(private readonly repo: UserNotificationRepository = userNotificationRepository) {}

  async notifyAppointment(payload: AppointmentPayload, kind: "created" | "cancelled"): Promise<void> {
    const { tenantId, appointment, customer, service, professional } = payload;
    const managers = await this.repo.findManagers(tenantId);

    // Monta candidatos: profissional do atendimento + gestores, deduplicado por id.
    const byId = new Map<string, Candidate>();

    const proProfile = managers.find((m) => m.id === professional.id);
    byId.set(professional.id, {
      id: professional.id,
      name: professional.name,
      email: professional.email,
      isProfessional: true,
      isManager: Boolean(proProfile),
      notifyEmailAppointments: proProfile?.notifyEmailAppointments ?? false,
      notifyOwnAppointments: proProfile?.notifyOwnAppointments ?? false,
      notifyTeamAppointments: proProfile?.notifyTeamAppointments ?? true,
    });

    for (const m of managers) {
      if (byId.has(m.id)) continue;
      byId.set(m.id, {
        id: m.id,
        name: m.name,
        email: m.email,
        isProfessional: false,
        isManager: true,
        notifyEmailAppointments: m.notifyEmailAppointments,
        notifyOwnAppointments: m.notifyOwnAppointments,
        notifyTeamAppointments: m.notifyTeamAppointments,
      });
    }

    const dateTime = formatDateTime(appointment.startsAt);
    const type: UserNotificationType =
      kind === "created" ? "appointment_created" : "appointment_cancelled";

    const rows: CreateUserNotificationInput[] = [];
    const emailTargets: Candidate[] = [];

    for (const c of byId.values()) {
      // Auto-skip: só em criação, quando o candidato é o criador e não optou por se avisar.
      if (kind === "created" && appointment.createdByUserId === c.id && !c.notifyOwnAppointments) {
        continue;
      }
      // Gestor puro (não é o profissional do atendimento) que desligou avisos da equipe.
      if (!c.isProfessional && c.isManager && !c.notifyTeamAppointments) {
        continue;
      }

      const isSelfCreator = appointment.createdByUserId === c.id;
      const title =
        kind === "cancelled"
          ? "Agendamento cancelado"
          : isSelfCreator
            ? "Você marcou um horário"
            : appointment.createdByUserId === null
              ? "Novo agendamento pela vitrine"
              : "Novo agendamento na sua agenda";
      const body =
        kind === "cancelled"
          ? `O agendamento de ${customer.name} (${service.name}) para ${dateTime} foi cancelado.`
          : `${customer.name} • ${service.name} • ${dateTime}`;

      rows.push({
        userId: c.id,
        type,
        title,
        body,
        data: {
          appointmentId: appointment.id,
          customerName: customer.name,
          serviceName: service.name,
          startsAt: appointment.startsAt.toISOString(),
        },
      });

      if (c.notifyEmailAppointments) emailTargets.push(c);
    }

    await this.repo.createMany(tenantId, rows);

    // E-mail transacional (opt-in). Falhas não quebram o fluxo.
    for (const c of emailTargets) {
      const html =
        kind === "created"
          ? professionalNewAppointmentHtml({
              professionalName: c.name,
              customerName: customer.name,
              serviceName: service.name,
              dateTime,
              tenantName: "",
            })
          : professionalCancelledAppointmentHtml({
              professionalName: c.name,
              customerName: customer.name,
              serviceName: service.name,
              dateTime,
              tenantName: "",
            });
      const subject = kind === "created" ? "Novo agendamento" : "Agendamento cancelado";
      try {
        await getEmailProvider().send({ to: c.email, subject, html });
      } catch (err) {
        console.error("[user-notifications] falha ao enviar e-mail:", err);
      }
    }
  }

  async notifyCustomerCreated(payload: { tenantId: string; customer: { id: string; name: string } }): Promise<void> {
    const managers = await this.repo.findManagers(payload.tenantId);
    if (managers.length === 0) return;

    const rows: CreateUserNotificationInput[] = managers.map((m: ManagerRecipient) => ({
      userId: m.id,
      type: "customer_created",
      title: "Novo cliente cadastrado",
      body: `${payload.customer.name} acabou de se cadastrar.`,
      data: { customerId: payload.customer.id, customerName: payload.customer.name },
    }));

    await this.repo.createMany(payload.tenantId, rows);
  }

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

  updatePreferences(
    tenantId: string,
    userId: string,
    prefs: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    return this.repo.updatePrefs(tenantId, userId, prefs);
  }
}

export const userNotificationService = new UserNotificationService();
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.service.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/user-notifications/user-notification.service.ts src/domains/notifications/user-notifications/user-notification.service.test.ts
git commit -m "feat(notifications): UserNotificationService com regra de destinatários e e-mail opt-in"
```

---

## Task 5: Job semanal de aniversariantes

**Files:**
- Create: `src/shared/queue/jobs/user-birthday-digest.ts`
- Test: `src/shared/queue/jobs/user-birthday-digest.test.ts`
- Modify: `src/app/api/cron/tick/route.ts`

**Interfaces:**
- Consumes: `prisma` (raw query); `userNotificationRepository` (`findManagers`, `createMany`).
- Produces:
  - const `USER_BIRTHDAY_DIGEST_JOB = "user-birthday-digest"`.
  - `handleUserBirthdayDigest(): Promise<void>` — varre aniversariantes da semana (todos os tenants), agrupa por tenant, cria uma notificação-resumo por gestor.
  - `registerUserBirthdayDigest(boss: PgBoss): Promise<void>`.

- [ ] **Step 1: Escrever o teste que falha**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

const createMany = vi.fn();
const findManagers = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification.repository", () => ({
  userNotificationRepository: { createMany: (...a: unknown[]) => createMany(...a), findManagers: (...a: unknown[]) => findManagers(...a) },
}));

import { handleUserBirthdayDigest } from "./user-birthday-digest";

describe("handleUserBirthdayDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMany.mockResolvedValue(1);
  });

  it("cria uma notificação-resumo por gestor quando há aniversariantes", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { tenantId: "t1", id: "c1", name: "Maria", phone: "+55...", birthDate: new Date("1990-07-05") },
      { tenantId: "t1", id: "c2", name: "João", phone: null, birthDate: new Date("1985-07-06") },
    ] as never);
    findManagers.mockResolvedValue([{ id: "owner1", email: "o@x.com", name: "Dono", notifyEmailAppointments: false, notifyOwnAppointments: false, notifyTeamAppointments: true }]);

    await handleUserBirthdayDigest();

    expect(findManagers).toHaveBeenCalledWith("t1");
    const [tenantId, rows] = createMany.mock.calls[0];
    expect(tenantId).toBe("t1");
    expect(rows[0].type).toBe("birthday_digest");
    expect(rows[0].userId).toBe("owner1");
    expect(rows[0].title).toContain("2");
  });

  it("não cria nada quando não há aniversariantes", async () => {
    prismaMock.$queryRaw.mockResolvedValue([] as never);
    await handleUserBirthdayDigest();
    expect(createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/shared/queue/jobs/user-birthday-digest.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar o job**

```typescript
import type { PgBoss } from "pg-boss";

import { prisma } from "@/shared/database/prisma";
import { userNotificationRepository } from "@/domains/notifications/user-notifications/user-notification.repository";
import type { CreateUserNotificationInput } from "@/domains/notifications/user-notifications/types";

export const USER_BIRTHDAY_DIGEST_JOB = "user-birthday-digest";

type BirthdayRow = {
  tenantId: string;
  id: string;
  name: string;
  phone: string | null;
  birthDate: Date;
};

// Constrói o conjunto de "MM-DD" dos próximos 7 dias (inclui hoje), cobrindo virada de mês.
function nextSevenDaysMMDD(now: Date): string[] {
  const set: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    set.push(`${mm}-${dd}`);
  }
  return set;
}

export async function handleUserBirthdayDigest(): Promise<void> {
  const days = nextSevenDaysMMDD(new Date());

  const rows = await prisma.$queryRaw<BirthdayRow[]>`
    SELECT c."tenantId", c.id, c.name, c.phone, c."birthDate"
    FROM "Customer" c
    WHERE c."birthDate" IS NOT NULL
      AND to_char(c."birthDate", 'MM-DD') = ANY(${days})
    ORDER BY to_char(c."birthDate", 'MM-DD') ASC
  `;

  if (rows.length === 0) return;

  // Agrupa por tenant.
  const byTenant = new Map<string, BirthdayRow[]>();
  for (const r of rows) {
    const list = byTenant.get(r.tenantId) ?? [];
    list.push(r);
    byTenant.set(r.tenantId, list);
  }

  for (const [tenantId, birthdays] of byTenant) {
    const managers = await userNotificationRepository.findManagers(tenantId);
    if (managers.length === 0) continue;

    const birthdayData = birthdays.map((b) => ({
      customerId: b.id,
      name: b.name,
      phone: b.phone,
      day: `${String(b.birthDate.getMonth() + 1).padStart(2, "0")}-${String(b.birthDate.getDate()).padStart(2, "0")}`,
    }));

    const notifRows: CreateUserNotificationInput[] = managers.map((m) => ({
      userId: m.id,
      type: "birthday_digest",
      title: `${birthdays.length} aniversariantes esta semana`,
      body: `${birthdays.length} cliente(s) fazem aniversário nos próximos 7 dias.`,
      data: { birthdays: birthdayData },
    }));

    await userNotificationRepository.createMany(tenantId, notifRows);
  }
}

export async function registerUserBirthdayDigest(boss: PgBoss): Promise<void> {
  await boss.schedule(USER_BIRTHDAY_DIGEST_JOB, "0 8 * * 1", {});
  boss.work(USER_BIRTHDAY_DIGEST_JOB, handleUserBirthdayDigest);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/shared/queue/jobs/user-birthday-digest.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Registrar o job no `cron/tick`**

Em `src/app/api/cron/tick/route.ts`:
1. Adicionar o import (junto dos demais jobs):
```typescript
import { USER_BIRTHDAY_DIGEST_JOB, handleUserBirthdayDigest } from "@/shared/queue/jobs/user-birthday-digest";
```
2. No bloco `Promise.all([ ... boss.schedule ... ])`, adicionar:
```typescript
      boss.schedule(USER_BIRTHDAY_DIGEST_JOB, "0 8 * * 1", {}),
```
3. No `Promise.all` de execução, adicionar ao array e ao destructuring:
```typescript
        runScheduled(boss, USER_BIRTHDAY_DIGEST_JOB, handleUserBirthdayDigest),
```
Incluir `userBirthday` no destructuring e no objeto `processed` do `Response.json`.

- [ ] **Step 6: Verificar tipos e testes**

Run: `npx tsc --noEmit && npx vitest run src/shared/queue/jobs/user-birthday-digest.test.ts`
Expected: zero erros TS; PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/queue/jobs/user-birthday-digest.ts src/shared/queue/jobs/user-birthday-digest.test.ts src/app/api/cron/tick/route.ts
git commit -m "feat(notifications): job semanal de aniversariantes para gestores"
```

---

## Task 6: Assinaturas de eventos + bootstrap

**Files:**
- Create: `src/domains/notifications/user-notifications/user-notifications.subscriptions.ts`
- Modify: `src/app/api/_lib/runtime.ts`

**Interfaces:**
- Consumes: `eventBus` de `@/shared/events/event-bus`; `userNotificationService` (Task 4).
- Produces: `registerUserNotificationSubscriptions(): void` (idempotente).

- [ ] **Step 1: Implementar as subscriptions** (espelhando `subscriptions.ts` existente, com guard de idempotência)

```typescript
import { eventBus } from "@/shared/events/event-bus";
import { userNotificationService } from "./user-notification.service";

let registered = false;

export function registerUserNotificationSubscriptions(): void {
  if (registered) return;
  registered = true;

  eventBus.subscribe("scheduling.appointment.created", async (payload) => {
    try {
      await userNotificationService.notifyAppointment(payload, "created");
    } catch (err) {
      console.error("[user-notifications] created:", err);
    }
  });

  eventBus.subscribe("scheduling.appointment.cancelled", async (payload) => {
    try {
      await userNotificationService.notifyAppointment(payload, "cancelled");
    } catch (err) {
      console.error("[user-notifications] cancelled:", err);
    }
  });

  eventBus.subscribe("crm.customer.created", async (payload) => {
    try {
      await userNotificationService.notifyCustomerCreated({
        tenantId: payload.tenantId,
        customer: { id: payload.customer.id, name: payload.customer.name },
      });
    } catch (err) {
      console.error("[user-notifications] customer.created:", err);
    }
  });
}
```

- [ ] **Step 2: Registrar no runtime**

Em `src/app/api/_lib/runtime.ts`:
1. Import:
```typescript
import { registerUserNotificationSubscriptions } from "@/domains/notifications/user-notifications/user-notifications.subscriptions";
```
2. Dentro do `try` de `initializeDomainRuntime`, adicionar:
```typescript
    registerUserNotificationSubscriptions();
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros. (Confirma que os payloads dos eventos batem com as assinaturas do service — em especial `appointment.createdByUserId` e `professional`.)

- [ ] **Step 4: Rodar a suíte de notifications**

Run: `npx vitest run src/domains/notifications`
Expected: PASS (repository + service + templates).

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/user-notifications/user-notifications.subscriptions.ts src/app/api/_lib/runtime.ts
git commit -m "feat(notifications): assina eventos de agendamento e novo cliente para a central da equipe"
```

---

## Task 7: Rotas da API (`/api/notifications/me`)

**Files:**
- Create: `src/app/api/notifications/me/route.ts`
- Create: `src/app/api/notifications/me/read/route.ts`
- Create: `src/app/api/notifications/me/prefs/route.ts`
- Test: `src/app/api/notifications/me/route.test.ts`

**Interfaces:**
- Consumes: `getSessionContext` de `@/shared/auth/session` (retorna `{ tenantId, userId, ... }`); `handleApiError` de `@/shared/http/handle-api-error`; `initializeDomainRuntime`; `userNotificationService` (Task 4).
- Produces:
  - `GET /api/notifications/me?period=7|30|all` → `{ items, unreadCount, isManager, prefs }`.
  - `POST /api/notifications/me/read` body `{ id?: string; all?: boolean }` → `{ unreadCount }`.
  - `PATCH /api/notifications/me/prefs` body `{ notifyEmailAppointments?, notifyOwnAppointments?, notifyTeamAppointments? }` → `{ prefs }`.

- [ ] **Step 1: Escrever o teste que falha** (foco: sessão + validação)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const listForUser = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification.service", () => ({
  userNotificationService: { listForUser: (...a: unknown[]) => listForUser(...a) },
}));
vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: () => {} }));
const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...a: unknown[]) => getSessionContext(...a) }));

import { GET } from "./route";

describe("GET /api/notifications/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({ tenantId: "t1", userId: "u1" });
    listForUser.mockResolvedValue({ items: [], unreadCount: 0, isManager: false, prefs: {} });
  });

  it("usa tenantId/userId do token e period=30 por padrão", async () => {
    const res = await GET(new Request("http://x/api/notifications/me"));
    expect(res.status).toBe(200);
    expect(listForUser).toHaveBeenCalledWith("t1", "u1", { period: "30", limit: 50 });
  });

  it("aceita period=all da query", async () => {
    await GET(new Request("http://x/api/notifications/me?period=all"));
    expect(listForUser).toHaveBeenCalledWith("t1", "u1", { period: "all", limit: 50 });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/app/api/notifications/me/route.test.ts`
Expected: FAIL (`./route` não existe).

- [ ] **Step 3: Implementar `me/route.ts`**

```typescript
import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { userNotificationService } from "@/domains/notifications/user-notifications/user-notification.service";

const querySchema = z.object({
  period: z.enum(["7", "30", "all"]).default("30"),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const { searchParams } = new URL(request.url);
    const { period } = querySchema.parse({
      period: searchParams.get("period") ?? undefined,
    });

    const result = await userNotificationService.listForUser(session.tenantId, session.userId, {
      period,
      limit: 50,
    });
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4: Implementar `me/read/route.ts`**

```typescript
import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { userNotificationService } from "@/domains/notifications/user-notifications/user-notification.service";

const bodySchema = z
  .object({ id: z.string().optional(), all: z.boolean().optional() })
  .refine((v) => Boolean(v.id) || v.all === true, {
    message: "Informe 'id' ou 'all: true'.",
  });

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const body = bodySchema.parse(await request.json());
    await userNotificationService.markRead(session.tenantId, session.userId, body);
    const { unreadCount } = await userNotificationService.listForUser(
      session.tenantId,
      session.userId,
      { period: "all", limit: 1 },
    );
    return Response.json({ unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5: Implementar `me/prefs/route.ts`**

```typescript
import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { userNotificationService } from "@/domains/notifications/user-notifications/user-notification.service";

const bodySchema = z.object({
  notifyEmailAppointments: z.boolean().optional(),
  notifyOwnAppointments: z.boolean().optional(),
  notifyTeamAppointments: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const prefs = bodySchema.parse(await request.json());
    const updated = await userNotificationService.updatePreferences(
      session.tenantId,
      session.userId,
      prefs,
    );
    return Response.json({ prefs: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npx vitest run src/app/api/notifications/me/route.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/notifications/me
git commit -m "feat(notifications): rotas /api/notifications/me (feed, marcar lida, preferências)"
```

---

## Task 8: Funções puras de visão + hook de dados

**Files:**
- Create: `src/domains/notifications/user-notifications/notification-view.ts`
- Test: `src/domains/notifications/user-notifications/notification-view.test.ts`
- Create: `src/hooks/notifications/use-user-notifications.ts`

**Interfaces:**
- Consumes: `useQuery`/`useMutation`/`useQueryClient` de `@tanstack/react-query`.
- Produces:
  - Tipo `NotificationDTO = { id: string; type: UserNotificationType; title: string; body: string; data: Record<string, unknown>; readAt: string | null; createdAt: string }`.
  - Tipo `TypeFilter = "todas" | "agenda" | "clientes" | "aniversarios"`.
  - `filterByType(items: NotificationDTO[], filter: TypeFilter): NotificationDTO[]`.
  - `groupByDate(items: NotificationDTO[], now: Date): { label: string; items: NotificationDTO[] }[]` (labels: "Hoje", "Ontem", "Esta semana", "Mais antigas").
  - `hasUnread(items: NotificationDTO[]): boolean`.
  - `useUserNotifications()` → `{ items, unreadCount, isManager, prefs, isLoading, isError, markRead, markAllRead, updatePrefs, period, setPeriod }`.

- [ ] **Step 1: Escrever o teste que falha (funções puras)**

```typescript
import { describe, it, expect } from "vitest";
import { filterByType, groupByDate, hasUnread, type NotificationDTO } from "./notification-view";

function item(over: Partial<NotificationDTO>): NotificationDTO {
  return { id: "x", type: "appointment_created", title: "t", body: "b", data: {}, readAt: null, createdAt: new Date().toISOString(), ...over };
}

describe("filterByType", () => {
  it("'agenda' inclui created e cancelled", () => {
    const items = [item({ type: "appointment_created" }), item({ type: "appointment_cancelled" }), item({ type: "customer_created" })];
    expect(filterByType(items, "agenda")).toHaveLength(2);
  });
  it("'clientes' inclui só customer_created", () => {
    const items = [item({ type: "customer_created" }), item({ type: "birthday_digest" })];
    expect(filterByType(items, "clientes")).toHaveLength(1);
  });
  it("'todas' retorna tudo", () => {
    const items = [item({}), item({ type: "birthday_digest" })];
    expect(filterByType(items, "todas")).toHaveLength(2);
  });
});

describe("groupByDate", () => {
  it("separa Hoje e Ontem", () => {
    const now = new Date("2026-07-04T12:00:00Z");
    const hoje = item({ createdAt: "2026-07-04T09:00:00Z" });
    const ontem = item({ createdAt: "2026-07-03T09:00:00Z" });
    const groups = groupByDate([hoje, ontem], now);
    expect(groups[0].label).toBe("Hoje");
    expect(groups[1].label).toBe("Ontem");
  });
});

describe("hasUnread", () => {
  it("true quando há readAt null", () => {
    expect(hasUnread([item({ readAt: null })])).toBe(true);
  });
  it("false quando todas lidas", () => {
    expect(hasUnread([item({ readAt: "2026-07-04T00:00:00Z" })])).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-view.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `notification-view.ts`**

```typescript
import type { UserNotificationType } from "./types";

export type NotificationDTO = {
  id: string;
  type: UserNotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type TypeFilter = "todas" | "agenda" | "clientes" | "aniversarios";

const TYPE_MAP: Record<Exclude<TypeFilter, "todas">, UserNotificationType[]> = {
  agenda: ["appointment_created", "appointment_cancelled"],
  clientes: ["customer_created"],
  aniversarios: ["birthday_digest"],
};

export function filterByType(items: NotificationDTO[], filter: TypeFilter): NotificationDTO[] {
  if (filter === "todas") return items;
  const allowed = TYPE_MAP[filter];
  return items.filter((i) => allowed.includes(i.type));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function groupByDate(
  items: NotificationDTO[],
  now: Date,
): { label: string; items: NotificationDTO[] }[] {
  const today = startOfDay(now).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const buckets: Record<string, NotificationDTO[]> = {
    Hoje: [],
    Ontem: [],
    "Esta semana": [],
    "Mais antigas": [],
  };

  for (const it of items) {
    const created = startOfDay(new Date(it.createdAt)).getTime();
    const diffDays = Math.round((today - created) / oneDay);
    if (diffDays <= 0) buckets["Hoje"].push(it);
    else if (diffDays === 1) buckets["Ontem"].push(it);
    else if (diffDays <= 7) buckets["Esta semana"].push(it);
    else buckets["Mais antigas"].push(it);
  }

  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}

export function hasUnread(items: NotificationDTO[]): boolean {
  return items.some((i) => i.readAt === null);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar o hook `use-user-notifications.ts`** (sem teste unitário — validação pela build e uso na UI)

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { NotificationDTO } from "@/domains/notifications/user-notifications/notification-view";
import type { NotificationPrefs } from "@/domains/notifications/user-notifications/types";

type Period = "7" | "30" | "all";

type FeedResponse = {
  items: NotificationDTO[];
  unreadCount: number;
  isManager: boolean;
  prefs: NotificationPrefs;
};

async function fetchFeed(period: Period): Promise<FeedResponse> {
  const res = await fetch(`/api/notifications/me?period=${period}`);
  if (!res.ok) throw new Error("Falha ao carregar notificações");
  return res.json();
}

export function useUserNotifications() {
  const [period, setPeriod] = useState<Period>("30");
  const qc = useQueryClient();
  const key = ["user-notifications", period];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchFeed(period),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (arg: { id?: string; all?: boolean }) => {
      const res = await fetch("/api/notifications/me/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      });
      if (!res.ok) throw new Error("Falha ao marcar como lida");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  const updatePrefs = useMutation({
    mutationFn: async (prefs: Partial<NotificationPrefs>) => {
      const res = await fetch("/api/notifications/me/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Falha ao salvar preferências");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  return {
    items: query.data?.items ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isManager: query.data?.isManager ?? false,
    prefs: query.data?.prefs ?? {
      notifyEmailAppointments: false,
      notifyOwnAppointments: false,
      notifyTeamAppointments: true,
    },
    isLoading: query.isLoading,
    isError: query.isError,
    markRead: (id: string) => markRead.mutate({ id }),
    markAllRead: () => markRead.mutate({ all: true }),
    updatePrefs: (prefs: Partial<NotificationPrefs>) => updatePrefs.mutate(prefs),
    period,
    setPeriod,
  };
}
```

- [ ] **Step 6: Verificar tipos e testes**

Run: `npx tsc --noEmit && npx vitest run src/domains/notifications/user-notifications/notification-view.test.ts`
Expected: zero erros; PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domains/notifications/user-notifications/notification-view.ts src/domains/notifications/user-notifications/notification-view.test.ts src/hooks/notifications/use-user-notifications.ts
git commit -m "feat(notifications): funções de visão (filtro/agrupamento) e hook useUserNotifications"
```

---

## Task 9: Componentes do sino, painel, item e preferências

**Files:**
- Create: `src/components/domain/notifications/notification-item.tsx`
- Create: `src/components/domain/notifications/notification-preferences.tsx`
- Create: `src/components/domain/notifications/notification-panel.tsx`
- Create: `src/components/domain/notifications/notification-bell.tsx`

**Interfaces:**
- Consumes: `useUserNotifications` (Task 8); `filterByType`, `groupByDate`, `hasUnread` (Task 8); componentes Shadcn `Sheet`, `Button`, `Switch` (verificar em `src/components/ui/`); ícones `lucide-react` (`Bell`, `Calendar`, `CalendarX`, `UserPlus`, `Cake`, `Settings`, `Check`).
- Produces: `<NotificationBell />` (default export ou nomeado) — botão de sino com bolinha de alerta que abre o `<NotificationPanel>`.

- [ ] **Step 1: `notification-item.tsx`** — bloco-resumo colapsável

```tsx
"use client";

import { useState } from "react";
import { Calendar, CalendarX, UserPlus, Cake } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/domains/notifications/user-notifications/notification-view";

const ICON = {
  appointment_created: Calendar,
  appointment_cancelled: CalendarX,
  customer_created: UserPlus,
  birthday_digest: Cake,
} as const;

const ICON_COLOR = {
  appointment_created: "text-violet-600",
  appointment_cancelled: "text-red-600",
  customer_created: "text-emerald-600",
  birthday_digest: "text-pink-600",
} as const;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationItem({
  notification,
  onRead,
}: {
  notification: NotificationDTO;
  onRead: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON[notification.type];
  const unread = notification.readAt === null;
  const appointmentId = typeof notification.data.appointmentId === "string" ? notification.data.appointmentId : null;
  const customerId = typeof notification.data.customerId === "string" ? notification.data.customerId : null;

  function toggle() {
    setExpanded((v) => !v);
    if (unread) onRead(notification.id);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors",
        unread ? "bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-center gap-2.5">
        {unread && <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="Não lida" />}
        <Icon className={cn("size-4 shrink-0", ICON_COLOR[notification.type])} />
        <span className="flex-1 truncate text-sm font-medium text-foreground">{notification.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(notification.createdAt)}</span>
      </div>
      <p className={cn("pl-9 text-xs text-muted-foreground", expanded ? "" : "line-clamp-1")}>
        {notification.body}
      </p>
      {expanded && appointmentId && (
        <Link href="/agenda" className="pl-9 text-xs font-medium text-primary hover:underline">
          Ver na agenda →
        </Link>
      )}
      {expanded && customerId && (
        <Link href={`/clientes/${customerId}`} className="pl-9 text-xs font-medium text-primary hover:underline">
          Ver cliente →
        </Link>
      )}
    </button>
  );
}
```

- [ ] **Step 2: `notification-preferences.tsx`** — toggles (verificar existência de `src/components/ui/switch.tsx`; se não existir, usar `<input type="checkbox">` estilizado)

```tsx
"use client";

import { Switch } from "@/components/ui/switch";
import type { NotificationPrefs } from "@/domains/notifications/user-notifications/types";

export function NotificationPreferences({
  prefs,
  isManager,
  onChange,
}: {
  prefs: NotificationPrefs;
  isManager: boolean;
  onChange: (p: Partial<NotificationPrefs>) => void;
}) {
  return (
    <div className="space-y-3 px-3 py-2">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Receber e-mail sobre meus agendamentos (novos e cancelados)</span>
        <Switch
          checked={prefs.notifyEmailAppointments}
          onCheckedChange={(v) => onChange({ notifyEmailAppointments: v })}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Me avisar também quando eu mesmo marco um horário</span>
        <Switch
          checked={prefs.notifyOwnAppointments}
          onCheckedChange={(v) => onChange({ notifyOwnAppointments: v })}
        />
      </label>
      {isManager && (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Receber avisos de agendamentos da equipe</span>
          <Switch
            checked={prefs.notifyTeamAppointments}
            onCheckedChange={(v) => onChange({ notifyTeamAppointments: v })}
          />
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `notification-panel.tsx`** — Sheet com chips, período, agrupamento, preferências

```tsx
"use client";

import { useState } from "react";
import { Settings, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  filterByType,
  groupByDate,
  type TypeFilter,
} from "@/domains/notifications/user-notifications/notification-view";
import { useUserNotifications } from "@/hooks/notifications/use-user-notifications";
import { NotificationItem } from "./notification-item";
import { NotificationPreferences } from "./notification-preferences";

const CHIPS: { key: TypeFilter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "agenda", label: "Agenda" },
  { key: "clientes", label: "Clientes" },
  { key: "aniversarios", label: "Aniversários" },
];

export function NotificationPanel({
  open,
  onOpenChange,
  feed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feed: ReturnType<typeof useUserNotifications>;
}) {
  const [filter, setFilter] = useState<TypeFilter>("todas");
  const [showPrefs, setShowPrefs] = useState(false);

  const filtered = filterByType(feed.items, filter);
  const groups = groupByDate(filtered, new Date());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
          <SheetTitle>Notificações</SheetTitle>
          <Button variant="ghost" size="icon" onClick={() => setShowPrefs((v) => !v)} aria-label="Preferências">
            <Settings className="size-4" />
          </Button>
        </SheetHeader>

        {showPrefs ? (
          <NotificationPreferences prefs={feed.prefs} isManager={feed.isManager} onChange={feed.updatePrefs} />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
              {CHIPS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilter(c.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filter === c.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between border-b px-4 py-2">
              <select
                value={feed.period}
                onChange={(e) => feed.setPeriod(e.target.value as "7" | "30" | "all")}
                className="rounded-md border bg-background px-2 py-1 text-xs"
                aria-label="Período"
              >
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="all">Tudo</option>
              </select>
              <button onClick={feed.markAllRead} className="flex items-center gap-1 text-xs text-primary">
                <Check className="size-3" /> Marcar todas como lidas
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {feed.isLoading ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : feed.isError ? (
                <p className="px-3 py-8 text-center text-sm text-destructive">Não foi possível carregar.</p>
              ) : groups.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação por aqui ainda.
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.label} className="mb-3">
                    <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </p>
                    {g.items.map((n) => (
                      <NotificationItem key={n.id} notification={n} onRead={feed.markRead} />
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: `notification-bell.tsx`** — botão + bolinha de alerta

```tsx
"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserNotifications } from "@/hooks/notifications/use-user-notifications";
import { NotificationPanel } from "./notification-panel";

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const feed = useUserNotifications();
  const hasUnread = feed.unreadCount > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasUnread ? "Notificações (há novas)" : "Notificações"}
        className={cn("relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted", className)}
      >
        <Bell className="size-5" />
        {hasUnread && (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
        )}
      </button>
      <NotificationPanel open={open} onOpenChange={setOpen} feed={feed} />
    </>
  );
}
```

- [ ] **Step 5: Verificar componentes Shadcn disponíveis e tipos**

Run: `ls src/components/ui/switch.tsx src/components/ui/sheet.tsx; npx tsc --noEmit`
Expected: arquivos existem (se `switch.tsx` não existir, adicionar via `npx shadcn@latest add switch` ou trocar por checkbox nativo no Step 2); zero erros TS.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/notifications
git commit -m "feat(notifications): sino, painel, item e preferências da central da equipe"
```

---

## Task 10: Integração no `AppShell` (desktop) e `MobileHeader` (mobile)

**Files:**
- Modify: `src/components/app/app-shell.tsx` (topo da sidebar, ao lado de `LogoBrand`)
- Modify: `src/components/app/mobile-header.tsx` (à esquerda do nome/logo)

**Interfaces:**
- Consumes: `<NotificationBell />` (Task 9).

- [ ] **Step 1: Inserir o sino no `MobileHeader`**

Em `src/components/app/mobile-header.tsx`, importar:
```tsx
import { NotificationBell } from '@/components/domain/notifications/notification-bell'
```
Envolver o cluster logo/nome (o `<Link href="/dashboard">`) num container flex e colocar o sino imediatamente à esquerda dele:
```tsx
      <div className="flex items-center gap-1">
        <NotificationBell />
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          aria-label="Ir para o Dashboard"
        >
          {/* ...conteúdo existente do Link... */}
        </Link>
      </div>
```
(Manter o botão de menu/voltar à esquerda inalterado; o `justify-between` do header mantém o grupo à direita.)

- [ ] **Step 2: Inserir o sino no topo da sidebar (desktop) no `AppShell`**

Em `src/components/app/app-shell.tsx`, importar:
```tsx
import { NotificationBell } from '@/components/domain/notifications/notification-bell'
```
Localizar onde `<LogoBrand />` é renderizado no topo da `aside` (desktop). Envolver num container e adicionar o sino ao lado, respeitando o estado `collapsed` (quando colapsado, o sino vai abaixo do ícone; quando expandido, à direita do nome):
```tsx
        <div className={cn('flex items-center gap-2 px-3 py-3', collapsed ? 'flex-col' : 'justify-between')}>
          <LogoBrand size={collapsed ? 'small' : 'normal'} />
          <NotificationBell />
        </div>
```
(Ajustar às classes/estrutura reais do bloco do topo da sidebar já existente — o objetivo é o sino aparecer ao lado da marca.)

- [ ] **Step 3: Verificar build e tipos**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -20`
Expected: zero erros de TS; build sem erros. (Alternativa mais rápida: `npx next lint` + `npx tsc --noEmit`.)

- [ ] **Step 4: Checklist mobile-first (`agent-mobile`)**

Revisar: sino com alvo de toque ≥ 40px, painel como bottom/side-sheet utilizável no mobile, chips com wrap, contraste da bolinha vermelha, sem overflow horizontal no header. Ajustar se necessário.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/app-shell.tsx src/components/app/mobile-header.tsx
git commit -m "feat(notifications): integra sino de notificações no header mobile e na sidebar desktop"
```

---

## Task 11: Verificação final e PR

- [ ] **Step 1: Suíte completa + tipos**

Run: `npx tsc --noEmit && npx vitest run`
Expected: zero erros TS; toda a suíte verde.

- [ ] **Step 2: Security review dos novos endpoints**

Verificar manualmente: `tenantId`/`userId` sempre do token; nenhum dado sensível de outro tenant/usuário acessível; Zod em todas as rotas; nenhuma query sem filtro de tenant. Rodar `/security-review` se disponível.

- [ ] **Step 3: Atualizar documentação**

Atualizar `CLAUDE.md` (linha do domínio Notifications e/ou nova linha "Central da equipe"), `AGENTS.md`/`CODEX.md` e `docs/decisions.md` (ADR curto: central in-app da equipe, tipos suportados, gestor = OWNER/MANAGER). Commit:
```bash
git add CLAUDE.md AGENTS.md CODEX.md docs/decisions.md
git commit -m "docs(notifications): registra central de notificações da equipe"
```

- [ ] **Step 4: Push e PR**

```bash
git push -u origin feat/central-notificacoes-equipe
gh pr create --base main --title "feat(notifications): central de notificações da equipe" --body "..."
```

---

## Notas de implementação

- **`prismaMock`**: se `prismaMock.userNotification` não existir automaticamente após o `prisma generate`, garantir que o `DeepMock` em `src/shared/test/prisma-mock.ts` cobre o novo model (normalmente cobre por reflexão do client; caso contrário, adicionar).
- **`crm.customer.created` no cadastro público**: confirmar (Task 6, Step 3 via tsc + teste manual) que o evento é publicado também no fluxo público da vitrine/portal, não só no CRM interno. Se não for, abrir subtarefa para publicar o evento no serviço de cadastro público (fora do escopo se já publicar).
- **Fuso do digest de aniversário**: janela calculada no fuso do servidor (simplificação v1 registrada no spec).
- **`notifyOwnAppointments`** só afeta `appointment_created` (auto-skip); cancelamento sempre notifica o profissional.
