# Notificações Avançadas — Plano de Implementação

> **Para agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar este plano task-by-task. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Implementar config avançada de lembrete, mensagem de aniversário automática, lembrete bulk "todos de hoje" e histórico de notificações no estetica-saas.

**Architecture:** Cinco features no domínio `notifications`: (1) configuração de lead time e janela de envio persistida no Tenant; (2) job pg-boss diário de aniversário com template WhatsApp dedicado; (3) endpoint de bulk reminder para disparos manuais; (4) endpoint paginado de histórico de logs; (5) UI que expõe tudo na aba WhatsApp de Configurações.

**Tech Stack:** Next.js 15 App Router, Prisma, pg-boss, Twilio (WhatsApp), Zod, TanStack Query, Shadcn UI, Vitest

---

## Estrutura de arquivos

| Ação | Arquivo |
|------|---------|
| Modify | `prisma/schema.prisma` — add `birthDate` em Customer; add `reminderLeadHours`, `reminderWindowStart`, `reminderWindowEnd` em Tenant |
| Auto-generated | `prisma/migrations/...` |
| Modify | `src/domains/notifications/notification.repository.ts` — add `findMany` |
| Modify | `src/domains/notifications/types.ts` — add `NotificationLogFilter` |
| Modify | `src/app/api/notifications/settings/route.ts` — incluir reminder config em GET + PATCH |
| Create | `src/app/api/notifications/log/route.ts` |
| Create | `src/app/api/notifications/bulk-reminder/route.ts` |
| Modify | `src/shared/queue/jobs/appointment-reminder.ts` — lead time dinâmico |
| Create | `src/shared/queue/jobs/birthday-reminder.ts` |
| Modify | `src/domains/notifications/providers/whatsapp.provider.ts` — add birthday template |
| Modify | `src/app/api/_lib/runtime.ts` — registrar birthday job |
| Modify | `src/hooks/settings/use-notification-settings.ts` — novos tipos e hooks |
| Modify | `src/components/domain/settings/whatsapp-settings-form.tsx` — config de lembrete + bulk btn |
| Modify | `src/components/domain/settings/whatsapp-template-editor.tsx` — template aniversário |
| Create | `src/components/domain/settings/notification-history.tsx` |
| Modify | `src/app/(app)/configuracoes/page.tsx` — integrar NotificationHistory |
| Modify | `src/domains/notifications/notification.repository.test.ts` (create if absent) |
| Modify | `src/shared/queue/jobs/appointment-reminder.test.ts` (create if absent) |

---

## Task 1: Criar branch

**Files:**
- (git only)

- [ ] **Step 1: Criar a branch de feature**

```bash
git checkout main && git pull origin main
git checkout -b feat/notificacoes-avancadas
```

---

## Task 2: Schema migration — birthDate + config de lembrete

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos ao schema**

Em `prisma/schema.prisma`, no model `Customer` (depois de `consentOrigin`):

```prisma
  birthDate    DateTime?
```

No model `Tenant` (depois de `whatsappTemplateConfig`):

```prisma
  reminderLeadHours    Int     @default(24)
  reminderWindowStart  Int     @default(7)
  reminderWindowEnd    Int     @default(22)
```

- [ ] **Step 2: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name notif-birthday-reminder-config
```

Saída esperada: `The following migration(s) have been applied: ...notif_birthday_reminder_config`

- [ ] **Step 3: Verificar que o Prisma client foi regenerado**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Saída esperada: zero erros (ou apenas os já existentes antes da task).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "chore(db): adiciona birthDate em Customer e config de lembrete em Tenant"
```

---

## Task 3: NotificationRepository — adicionar findMany

**Files:**
- Modify: `src/domains/notifications/notification.repository.ts`
- Create: `src/domains/notifications/notification.repository.test.ts`

- [ ] **Step 1: Adicionar tipo de filtro em `types.ts`**

Em `src/domains/notifications/types.ts`, adicionar ao final do arquivo:

```typescript
export type NotificationLogFilter = {
  template?: string;
  status?: import("@prisma/client").NotificationStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
};
```

- [ ] **Step 2: Escrever o teste que vai falhar**

Crie `src/domains/notifications/notification.repository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { NotificationRepository } from "./notification.repository";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));

describe("NotificationRepository.findMany", () => {
  let repo: NotificationRepository;

  beforeEach(() => {
    repo = new NotificationRepository();
    vi.clearAllMocks();
  });

  it("retorna logs paginados filtrados por tenantId", async () => {
    const fakeLog = {
      id: "log1",
      tenantId: "tenant1",
      appointmentId: null,
      customerId: null,
      channel: "WHATSAPP",
      template: "appointment-created",
      recipient: "+5511999999999",
      status: "SENT",
      provider: "twilio",
      payload: {},
      errorMessage: null,
      externalId: "SM123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.notificationLog.findMany.mockResolvedValue([fakeLog] as never);
    prismaMock.notificationLog.count.mockResolvedValue(1);

    const result = await repo.findMany("tenant1", { page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(prismaMock.notificationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant1" }),
      }),
    );
  });

  it("aplica filtro de template quando fornecido", async () => {
    prismaMock.notificationLog.findMany.mockResolvedValue([]);
    prismaMock.notificationLog.count.mockResolvedValue(0);

    await repo.findMany("tenant1", { template: "birthday", page: 1, limit: 20 });

    expect(prismaMock.notificationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant1", template: "birthday" }),
      }),
    );
  });
});
```

- [ ] **Step 3: Verificar que o teste falha**

```bash
npx vitest run src/domains/notifications/notification.repository.test.ts
```

Saída esperada: `FAIL` — `repo.findMany is not a function`

- [ ] **Step 4: Implementar `findMany` no repository**

Em `src/domains/notifications/notification.repository.ts`, substituir o conteúdo completo por:

```typescript
import type { Prisma, NotificationStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import type { NotificationLogFilter } from "./types";

export class NotificationRepository {
  async createLog(
    tenantId: string,
    data: Omit<Prisma.NotificationLogUncheckedCreateInput, "tenantId">,
  ) {
    return prisma.notificationLog.create({
      data: { ...data, tenantId },
    });
  }

  async findMany(tenantId: string, filter: NotificationLogFilter) {
    const { template, status, startDate, endDate, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationLogWhereInput = {
      tenantId,
      ...(template && { template }),
      ...(status && { status }),
      ...(startDate || endDate
        ? { createdAt: { ...(startDate && { gte: startDate }), ...(endDate && { lte: endDate }) } }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}

export const notificationRepository = new NotificationRepository();
```

- [ ] **Step 5: Verificar que o teste passa**

```bash
npx vitest run src/domains/notifications/notification.repository.test.ts
```

Saída esperada: `PASS` — 2 testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/notification.repository.ts src/domains/notifications/notification.repository.test.ts src/domains/notifications/types.ts
git commit -m "feat(notifications): adiciona findMany paginado ao NotificationRepository"
```

---

## Task 4: API settings — incluir config de lembrete

**Files:**
- Modify: `src/app/api/notifications/settings/route.ts`

- [ ] **Step 1: Atualizar o arquivo**

Substituir o conteúdo de `src/app/api/notifications/settings/route.ts`:

```typescript
import { z } from "zod";

import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { ForbiddenError } from "@/shared/errors";

const SUPPORTED_TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Maceio",
  "America/Bahia",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
] as const;

const REMINDER_LEAD_HOURS = [2, 4, 8, 12, 24, 48] as const;

const updateNotificationSettingsSchema = z.object({
  whatsappEnabled: z.boolean().optional(),
  timezone: z.enum(SUPPORTED_TIMEZONES).optional(),
  reminderLeadHours: z.number().int().refine((v) => (REMINDER_LEAD_HOURS as readonly number[]).includes(v)).optional(),
  reminderWindowStart: z.number().int().min(0).max(23).optional(),
  reminderWindowEnd: z.number().int().min(0).max(23).optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: {
        whatsappEnabled: true,
        timezone: true,
        plan: true,
        reminderLeadHours: true,
        reminderWindowStart: true,
        reminderWindowEnd: true,
      },
    });

    return Response.json(
      tenant ?? {
        whatsappEnabled: false,
        timezone: "America/Sao_Paulo",
        plan: "FREE",
        reminderLeadHours: 24,
        reminderWindowStart: 7,
        reminderWindowEnd: 22,
      },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const input = await validateInput(request, updateNotificationSettingsSchema);

    if (input.whatsappEnabled === true) {
      const hasAccess = await featureGuard.canAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);
      if (!hasAccess) {
        throw new ForbiddenError("WhatsApp requer plano STARTER ou superior.");
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: session.tenantId },
      data: input,
      select: {
        whatsappEnabled: true,
        timezone: true,
        plan: true,
        reminderLeadHours: true,
        reminderWindowStart: true,
        reminderWindowEnd: true,
      },
    });

    return Response.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "settings/route"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/settings/route.ts
git commit -m "feat(notifications): expõe config de lembrete no endpoint de settings"
```

---

## Task 5: Job appointment-reminder — lead time dinâmico + janela de envio

**Files:**
- Modify: `src/shared/queue/jobs/appointment-reminder.ts`
- Create: `src/shared/queue/jobs/appointment-reminder.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Crie `src/shared/queue/jobs/appointment-reminder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";

vi.mock("@/shared/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/shared/queue/pg-boss", () => ({
  getPgBoss: () => ({ send: vi.fn(), findJobs: vi.fn().mockResolvedValue([]), cancel: vi.fn() }),
}));

import { scheduleAppointmentReminder } from "./appointment-reminder";

describe("scheduleAppointmentReminder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("usa reminderLeadHours do tenant para calcular sendAt", async () => {
    const startsAt = new Date(Date.now() + 50 * 3600 * 1000); // 50h no futuro
    prismaMock.tenant.findFirst.mockResolvedValue({
      reminderLeadHours: 12,
      reminderWindowStart: 7,
      reminderWindowEnd: 22,
      timezone: "America/Sao_Paulo",
    } as never);

    const boss = (await import("@/shared/queue/pg-boss")).getPgBoss();
    await scheduleAppointmentReminder("tenant1", "appt1", startsAt);

    const callArg = (boss.send as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentOptions = callArg[2] as { startAfter: Date };
    const expectedSendAt = new Date(startsAt.getTime() - 12 * 3600 * 1000);

    expect(Math.abs(sentOptions.startAfter.getTime() - expectedSendAt.getTime())).toBeLessThan(60_000);
  });

  it("não agenda lembrete se o sendAt já passou", async () => {
    const startsAt = new Date(Date.now() + 2 * 3600 * 1000); // 2h no futuro
    prismaMock.tenant.findFirst.mockResolvedValue({
      reminderLeadHours: 24,
      reminderWindowStart: 7,
      reminderWindowEnd: 22,
      timezone: "America/Sao_Paulo",
    } as never);

    const boss = (await import("@/shared/queue/pg-boss")).getPgBoss();
    await scheduleAppointmentReminder("tenant1", "appt1", startsAt);

    expect(boss.send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verificar que os testes falham**

```bash
npx vitest run src/shared/queue/jobs/appointment-reminder.test.ts
```

Saída esperada: `FAIL` — testes falham pois `scheduleAppointmentReminder` não usa config do tenant.

- [ ] **Step 3: Implementar lead time dinâmico**

Substituir o conteúdo de `src/shared/queue/jobs/appointment-reminder.ts`:

```typescript
import type { Job } from "pg-boss";

import { prisma } from "@/shared/database/prisma";
import { NotificationChannel } from "@prisma/client";

import { getPgBoss } from "@/shared/queue/pg-boss";

export const APPOINTMENT_REMINDER_JOB = "appointment-reminder";

export type AppointmentReminderPayload = {
  appointmentId: string;
  tenantId: string;
};

function adjustToWindow(sendAt: Date, windowStart: number, windowEnd: number, tz: string): Date {
  const hour = parseInt(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(sendAt),
    10,
  );
  if (hour < windowStart) {
    return new Date(sendAt.getTime() + (windowStart - hour) * 3600_000);
  }
  if (hour >= windowEnd) {
    return new Date(sendAt.getTime() + (24 - hour + windowStart) * 3600_000);
  }
  return sendAt;
}

export async function handleAppointmentReminder(
  jobs: Job<AppointmentReminderPayload>[],
): Promise<void> {
  for (const job of jobs) {
    const { appointmentId, tenantId } = job.data;

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { customer: true, service: true },
    });

    if (!appointment || appointment.status === "CANCELLED") continue;
    if (!appointment.customer.phone) continue;

    const { notificationService } = await import("@/domains/notifications/notification.service");

    await notificationService.logAndDispatch({
      tenantId,
      appointmentId,
      customerId: appointment.customerId,
      channel: NotificationChannel.WHATSAPP,
      template: "appointment-reminder",
      recipient: appointment.customer.phone,
      provider: "twilio",
      payload: {
        appointmentId,
        startsAt: appointment.startsAt.toISOString(),
        customerName: appointment.customer.name,
        serviceName: appointment.service.name,
      },
    });
  }
}

export async function scheduleAppointmentReminder(
  tenantId: string,
  appointmentId: string,
  startsAt: Date,
): Promise<void> {
  const tenantConfig = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { reminderLeadHours: true, reminderWindowStart: true, reminderWindowEnd: true, timezone: true },
  });

  const leadHours = tenantConfig?.reminderLeadHours ?? 24;
  const windowStart = tenantConfig?.reminderWindowStart ?? 7;
  const windowEnd = tenantConfig?.reminderWindowEnd ?? 22;
  const tz = tenantConfig?.timezone ?? "America/Sao_Paulo";

  let sendAt = new Date(startsAt.getTime() - leadHours * 3600_000);
  if (sendAt <= new Date()) return;

  sendAt = adjustToWindow(sendAt, windowStart, windowEnd, tz);
  if (sendAt <= new Date()) return;

  const boss = getPgBoss();
  await boss.send(
    APPOINTMENT_REMINDER_JOB,
    { appointmentId, tenantId },
    {
      startAfter: sendAt,
      singletonKey: appointmentId,
      retryLimit: 2,
      retryDelay: 300,
    },
  );
}

export async function cancelAppointmentReminder(appointmentId: string): Promise<void> {
  try {
    const boss = getPgBoss();
    const jobs = await boss.findJobs(APPOINTMENT_REMINDER_JOB, { key: appointmentId });
    const ids = jobs.map((j) => j.id);
    if (ids.length > 0) {
      await boss.cancel(APPOINTMENT_REMINDER_JOB, ids);
    }
  } catch {
    // Silencia erros — o handler já verifica o status do appointment
  }
}
```

- [ ] **Step 4: Verificar que os testes passam**

```bash
npx vitest run src/shared/queue/jobs/appointment-reminder.test.ts
```

Saída esperada: `PASS` — 2 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/shared/queue/jobs/appointment-reminder.ts src/shared/queue/jobs/appointment-reminder.test.ts
git commit -m "feat(notifications): lembrete usa lead time e janela de envio configuráveis do tenant"
```

---

## Task 6: Provider WhatsApp — adicionar template aniversário

**Files:**
- Modify: `src/domains/notifications/providers/whatsapp.provider.ts`

- [ ] **Step 1: Adicionar env var de birthday ao check de inicialização e ao mapa de SIDs**

Em `src/domains/notifications/providers/whatsapp.provider.ts`:

1. No array `required` dentro do `if (process.env.NODE_ENV !== "test"...)`, adicionar:
```typescript
"TWILIO_TPL_BIRTHDAY",
```

2. Em `TEMPLATE_SIDS`, adicionar:
```typescript
"birthday": process.env.TWILIO_TPL_BIRTHDAY ?? "",
```

3. Em `TEMPLATE_TO_CONFIG_KEY`, adicionar:
```typescript
"birthday": "aniversario",
```

4. Em `TEMPLATE_DEFAULTS`, adicionar:
```typescript
aniversario: { mensagemPrincipal: "Feliz aniversário! Temos um presente especial para você.", mensagemFinal: "Venha nos visitar em breve!" },
```

5. No tipo `AppointmentNotificationPayload`, adicionar campo opcional:
```typescript
type BirthdayNotificationPayload = {
  customerName: string;
};
```

6. Na função `buildTemplateParams`, adicionar o case de birthday após o `else if (template === "appointment-reminder")`:

```typescript
} else if (template === "birthday") {
  const bPayload = payload as unknown as BirthdayNotificationPayload;
  contentVariables = {
    "1": bPayload.customerName,
    "2": principal,
    "3": tenant.name,
    "4": final,
  };
}
```

- [ ] **Step 2: Adicionar `.env.local` — variável de birthday**

Abra `.env.local` e adicione (com o SID real do template Twilio após criá-lo no console):

```
TWILIO_TPL_BIRTHDAY=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Nota:** Crie o template no Twilio Console → Messaging → Content Template Builder com variáveis: `{{1}}` (nome do cliente), `{{2}}` (mensagem principal), `{{3}}` (nome do salão), `{{4}}` (mensagem final).

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "whatsapp.provider"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 4: Commit**

```bash
git add src/domains/notifications/providers/whatsapp.provider.ts
git commit -m "feat(notifications): adiciona suporte ao template de aniversário no WhatsApp provider"
```

---

## Task 7: Job birthday-reminder — cron diário às 9h

**Files:**
- Create: `src/shared/queue/jobs/birthday-reminder.ts`

- [ ] **Step 1: Criar o job**

Crie `src/shared/queue/jobs/birthday-reminder.ts`:

```typescript
import type { PgBoss, Job } from "pg-boss";

import { prisma } from "@/shared/database/prisma";
import { NotificationChannel } from "@prisma/client";

export const BIRTHDAY_REMINDER_JOB = "birthday-reminder";

export async function handleBirthdayReminder(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate(); // 1-31

  // Busca clientes aniversariantes hoje em tenants com WhatsApp ativo
  const customers = await prisma.$queryRaw<
    { id: string; tenantId: string; name: string; phone: string }[]
  >`
    SELECT c.id, c."tenantId", c.name, c.phone
    FROM "Customer" c
    INNER JOIN "Tenant" t ON t.id = c."tenantId"
    WHERE c."birthDate" IS NOT NULL
      AND EXTRACT(MONTH FROM c."birthDate") = ${month}
      AND EXTRACT(DAY FROM c."birthDate") = ${day}
      AND c."consentGiven" = true
      AND c.phone IS NOT NULL
      AND t."whatsappEnabled" = true
  `;

  if (customers.length === 0) return;

  const { notificationService } = await import("@/domains/notifications/notification.service");

  for (const customer of customers) {
    await notificationService.logAndDispatch({
      tenantId: customer.tenantId,
      customerId: customer.id,
      channel: NotificationChannel.WHATSAPP,
      template: "birthday",
      recipient: customer.phone,
      provider: "twilio",
      payload: { customerName: customer.name },
    });
  }
}

export async function registerBirthdayReminder(boss: PgBoss): Promise<void> {
  // Roda todo dia às 9h (America/Sao_Paulo = UTC-3, então 12h UTC)
  await boss.schedule(BIRTHDAY_REMINDER_JOB, "0 12 * * *", {});
  boss.work(BIRTHDAY_REMINDER_JOB, handleBirthdayReminder);
}
```

- [ ] **Step 2: Registrar o job no runtime**

Em `src/app/api/_lib/runtime.ts`, adicionar import e registro:

```typescript
import { registerFinancialSubscriptions } from "@/domains/financial/subscriptions";
import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";
import { registerBillingJobs } from "@/domains/billing/subscriptions";
import { startPgBoss } from "@/shared/queue/pg-boss";
import {
  APPOINTMENT_REMINDER_JOB,
  handleAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";
import { registerWhatsAppQuotaCleanup } from "@/shared/queue/jobs/whatsapp-quota-reset";
import { registerBirthdayReminder } from "@/shared/queue/jobs/birthday-reminder";

let initialized = false;

export function initializeDomainRuntime() {
  if (initialized) {
    return;
  }

  registerFinancialSubscriptions();
  registerNotificationSubscriptions();

  startPgBoss().then(async (boss) => {
    boss.work(APPOINTMENT_REMINDER_JOB, handleAppointmentReminder);
    registerBillingJobs(boss);
    await registerWhatsAppQuotaCleanup(boss);
    await registerBirthdayReminder(boss);
  }).catch(console.error);

  initialized = true;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "birthday|runtime"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 4: Commit**

```bash
git add src/shared/queue/jobs/birthday-reminder.ts src/app/api/_lib/runtime.ts
git commit -m "feat(notifications): cron diário de aniversário via pg-boss às 9h"
```

---

## Task 8: API — GET /api/notifications/log (histórico paginado)

**Files:**
- Create: `src/app/api/notifications/log/route.ts`

- [ ] **Step 1: Criar o endpoint**

Crie `src/app/api/notifications/log/route.ts`:

```typescript
import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { notificationRepository } from "@/domains/notifications/notification.repository";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  template: z.string().optional(),
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const query = querySchema.parse(params);

    const result = await notificationRepository.findMany(session.tenantId, {
      page: query.page,
      limit: query.limit,
      template: query.template,
      status: query.status as import("@prisma/client").NotificationStatus | undefined,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "notifications/log"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/log/route.ts
git commit -m "feat(notifications): endpoint GET /api/notifications/log com paginação e filtros"
```

---

## Task 9: API — POST /api/notifications/bulk-reminder

**Files:**
- Create: `src/app/api/notifications/bulk-reminder/route.ts`

- [ ] **Step 1: Criar o endpoint**

Crie `src/app/api/notifications/bulk-reminder/route.ts`:

```typescript
import { NotificationChannel } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { notificationService } from "@/domains/notifications/notification.service";

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId: session.tenantId,
        startsAt: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["CANCELLED"] },
      },
      include: {
        customer: { select: { id: true, phone: true, name: true, consentGiven: true } },
        service: { select: { name: true } },
      },
    });

    const eligible = appointments.filter(
      (a) => a.customer.phone && a.customer.consentGiven,
    );

    await Promise.all(
      eligible.map((a) =>
        notificationService.logAndDispatch({
          tenantId: session.tenantId,
          appointmentId: a.id,
          customerId: a.customerId,
          channel: NotificationChannel.WHATSAPP,
          template: "appointment-reminder",
          recipient: a.customer.phone!,
          provider: "twilio",
          payload: {
            appointmentId: a.id,
            startsAt: a.startsAt.toISOString(),
            customerName: a.customer.name,
            serviceName: a.service.name,
          },
        }),
      ),
    );

    return Response.json({ sent: eligible.length });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "bulk-reminder"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/bulk-reminder/route.ts
git commit -m "feat(notifications): endpoint POST /api/notifications/bulk-reminder para lembretes em massa"
```

---

## Task 10: Frontend — atualizar hook de notification settings

**Files:**
- Modify: `src/hooks/settings/use-notification-settings.ts`

- [ ] **Step 1: Atualizar tipos e adicionar hooks novos**

Substituir o conteúdo de `src/hooks/settings/use-notification-settings.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NotificationStatus } from "@prisma/client";

export type NotificationSettings = {
  whatsappEnabled: boolean;
  timezone: string;
  plan: string;
  reminderLeadHours: number;
  reminderWindowStart: number;
  reminderWindowEnd: number;
};

type UpdateNotificationSettings = {
  whatsappEnabled?: boolean;
  timezone?: string;
  reminderLeadHours?: number;
  reminderWindowStart?: number;
  reminderWindowEnd?: number;
};

async function fetchNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch("/api/notifications/settings");
  if (!res.ok) throw new Error("Erro ao buscar configurações");
  return res.json() as Promise<NotificationSettings>;
}

async function updateNotificationSettings(
  input: UpdateNotificationSettings,
): Promise<NotificationSettings> {
  const res = await fetch("/api/notifications/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao salvar configurações");
  return res.json() as Promise<NotificationSettings>;
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification-settings"],
    queryFn: fetchNotificationSettings,
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    },
  });
}

export type WhatsAppUsage = {
  used: number;
  limit: number;
  resetDate: string;
  plan: string;
};

async function fetchWhatsAppUsage(): Promise<WhatsAppUsage> {
  const res = await fetch("/api/whatsapp/usage");
  if (!res.ok) throw new Error("Erro ao buscar uso WhatsApp");
  return res.json() as Promise<WhatsAppUsage>;
}

export function useWhatsAppUsage() {
  return useQuery({
    queryKey: ["whatsapp-usage"],
    queryFn: fetchWhatsAppUsage,
  });
}

export type TemplateConfig = {
  mensagemPrincipal: string;
  mensagemFinal: string;
};

export type WhatsAppTemplates = Record<string, TemplateConfig>;

async function fetchWhatsAppTemplates(): Promise<WhatsAppTemplates> {
  const res = await fetch("/api/whatsapp/templates");
  if (!res.ok) throw new Error("Erro ao buscar templates");
  return res.json() as Promise<WhatsAppTemplates>;
}

async function updateWhatsAppTemplate(input: {
  template: string;
  mensagemPrincipal: string;
  mensagemFinal: string;
}): Promise<void> {
  const res = await fetch("/api/whatsapp/templates", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Erro ao salvar template");
}

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: fetchWhatsAppTemplates,
  });
}

export function useUpdateWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateWhatsAppTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
}

// --- Bulk reminder ---

async function sendBulkReminder(): Promise<{ sent: number }> {
  const res = await fetch("/api/notifications/bulk-reminder", { method: "POST" });
  if (!res.ok) throw new Error("Erro ao enviar lembretes em massa");
  return res.json() as Promise<{ sent: number }>;
}

export function useBulkReminder() {
  return useMutation({ mutationFn: sendBulkReminder });
}

// --- Notification history ---

export type NotificationLogEntry = {
  id: string;
  template: string;
  recipient: string;
  status: NotificationStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type NotificationLogPage = {
  data: NotificationLogEntry[];
  total: number;
  page: number;
  limit: number;
};

type NotificationLogFilter = {
  page?: number;
  template?: string;
  status?: string;
};

async function fetchNotificationLog(filter: NotificationLogFilter): Promise<NotificationLogPage> {
  const params = new URLSearchParams();
  if (filter.page) params.set("page", String(filter.page));
  if (filter.template) params.set("template", filter.template);
  if (filter.status) params.set("status", filter.status);
  const res = await fetch(`/api/notifications/log?${params.toString()}`);
  if (!res.ok) throw new Error("Erro ao buscar histórico de notificações");
  return res.json() as Promise<NotificationLogPage>;
}

export function useNotificationLog(filter: NotificationLogFilter = {}) {
  return useQuery({
    queryKey: ["notification-log", filter],
    queryFn: () => fetchNotificationLog(filter),
  });
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "use-notification-settings"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/settings/use-notification-settings.ts
git commit -m "feat(notifications): atualiza hook de settings com config de lembrete, bulk e histórico"
```

---

## Task 11: Frontend — config avançada de lembrete + botão bulk no WhatsAppSettingsForm

**Files:**
- Modify: `src/components/domain/settings/whatsapp-settings-form.tsx`

- [ ] **Step 1: Atualizar o componente**

Substituir o conteúdo de `src/components/domain/settings/whatsapp-settings-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { MessageCircle, Lock, Send, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  useBulkReminder,
} from "@/hooks/settings/use-notification-settings";
import { WhatsAppUsageCard } from "./whatsapp-usage-card";
import { WhatsAppTemplateEditor } from "./whatsapp-template-editor";

const TIMEZONES = [
  { value: "America/Sao_Paulo",   label: "Brasília (UTC-3)" },
  { value: "America/Manaus",      label: "Manaus (UTC-4)" },
  { value: "America/Belem",       label: "Belém (UTC-3)" },
  { value: "America/Fortaleza",   label: "Fortaleza (UTC-3)" },
  { value: "America/Recife",      label: "Recife (UTC-3)" },
  { value: "America/Maceio",      label: "Maceió (UTC-3)" },
  { value: "America/Bahia",       label: "Salvador (UTC-3)" },
  { value: "America/Porto_Velho", label: "Porto Velho (UTC-4)" },
  { value: "America/Boa_Vista",   label: "Boa Vista (UTC-4)" },
  { value: "America/Rio_Branco",  label: "Rio Branco (UTC-5)" },
  { value: "America/Noronha",     label: "Fernando de Noronha (UTC-2)" },
];

const LEAD_HOURS_OPTIONS = [
  { value: "2",  label: "2 horas antes" },
  { value: "4",  label: "4 horas antes" },
  { value: "8",  label: "8 horas antes" },
  { value: "12", label: "12 horas antes" },
  { value: "24", label: "24 horas antes (padrão)" },
  { value: "48", label: "48 horas antes" },
];

const WINDOW_HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, "0")}:00`,
}));

export function WhatsAppSettingsForm() {
  const { data, isLoading } = useNotificationSettings();
  const { mutate, isPending } = useUpdateNotificationSettings();
  const { mutate: sendBulk, isPending: isSending, data: bulkResult } = useBulkReminder();
  const [bulkSent, setBulkSent] = useState(false);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />;
  }

  const isFree = data?.plan === "FREE";
  const isEnabled = data?.whatsappEnabled ?? false;

  if (isFree) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <Lock className="mt-0.5 size-5 shrink-0 text-slate-400" />
        <div>
          <p className="font-medium text-slate-700">WhatsApp não disponível no plano Free</p>
          <p className="mt-1 text-sm text-slate-500">
            Faça upgrade para o plano Starter ou superior para ativar notificações automáticas via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  function handleBulkSend() {
    sendBulk(undefined, {
      onSuccess: () => setBulkSent(true),
    });
  }

  return (
    <div className="space-y-6">
      {/* Toggle WhatsApp */}
      <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/85 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <p className="font-medium text-slate-950">Notificações WhatsApp</p>
            <p className="text-xs text-slate-500">Confirmações e lembretes automáticos via Twilio</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
            {isEnabled ? "Ativo" : "Inativo"}
          </Badge>
          <Button
            variant={isEnabled ? "destructive" : "default"}
            size="sm"
            onClick={() => mutate({ whatsappEnabled: !isEnabled })}
            disabled={isPending}
          >
            {isEnabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>

      {isEnabled && (
        <>
          <WhatsAppUsageCard />

          {/* Lembrete bulk */}
          <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/85 px-5 py-4 shadow-sm">
            <div>
              <p className="font-medium text-slate-950">Lembretes de hoje</p>
              <p className="text-xs text-slate-500">
                Envia lembrete agora para todos os agendamentos de hoje que ainda não foram cancelados.
              </p>
              {bulkSent && bulkResult && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="size-3" />
                  {bulkResult.sent} lembrete{bulkResult.sent !== 1 ? "s" : ""} enviado{bulkResult.sent !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkSend}
              disabled={isSending}
              className="gap-2"
            >
              <Send className="size-4" />
              {isSending ? "Enviando..." : "Enviar agora"}
            </Button>
          </div>

          {/* Config de lembrete */}
          <div className="space-y-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Configuração do lembrete automático</p>

            <div className="space-y-2">
              <Label>Quando enviar o lembrete</Label>
              <Select
                value={String(data?.reminderLeadHours ?? 24)}
                onValueChange={(v) => mutate({ reminderLeadHours: parseInt(v) })}
                disabled={isPending}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_HOURS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Não enviar antes de</Label>
                <Select
                  value={String(data?.reminderWindowStart ?? 7)}
                  onValueChange={(v) => mutate({ reminderWindowStart: parseInt(v) })}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_HOURS.slice(0, 12).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Não enviar depois de</Label>
                <Select
                  value={String(data?.reminderWindowEnd ?? 22)}
                  onValueChange={(v) => mutate({ reminderWindowEnd: parseInt(v) })}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_HOURS.slice(12).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              O lembrete será ajustado para ficar dentro da janela configurada.
            </p>
          </div>

          <WhatsAppTemplateEditor />
        </>
      )}

      {/* Fuso horário */}
      <div className="space-y-2">
        <Label htmlFor="timezone">Fuso horário do negócio</Label>
        <Select
          value={data?.timezone ?? "America/Sao_Paulo"}
          onValueChange={(v) => mutate({ timezone: v })}
          disabled={isPending}
        >
          <SelectTrigger id="timezone" className="w-full sm:w-72">
            <SelectValue placeholder="Selecione o fuso horário" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-400">
          Usado para formatar datas e horários nas mensagens enviadas ao cliente.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "whatsapp-settings-form"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/whatsapp-settings-form.tsx
git commit -m "feat(notifications): UI de config avançada de lembrete e botão de envio em massa"
```

---

## Task 12: Frontend — template aniversário no WhatsAppTemplateEditor

**Files:**
- Modify: `src/components/domain/settings/whatsapp-template-editor.tsx`

- [ ] **Step 1: Adicionar aniversário à lista de templates**

Em `src/components/domain/settings/whatsapp-template-editor.tsx`:

1. Adicionar `"aniversario"` ao tipo `TemplateName`:

```typescript
type TemplateName =
  | "confirmacao"
  | "confirmado"
  | "lembrete"
  | "cancelamento"
  | "nao_comparecimento"
  | "aniversario";
```

2. Adicionar ao `TEMPLATE_LABELS`:

```typescript
aniversario: "Mensagem de aniversário",
```

3. Adicionar ao `buildPreview` (dentro do switch):

```typescript
case "aniversario":
  return `🎂 Olá, ${c.nome}! ${principal} ${c.salao}. ${final}`;
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "whatsapp-template-editor"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/whatsapp-template-editor.tsx
git commit -m "feat(notifications): adiciona template de aniversário ao editor de mensagens"
```

---

## Task 13: Frontend — componente NotificationHistory

**Files:**
- Create: `src/components/domain/settings/notification-history.tsx`

- [ ] **Step 1: Criar o componente**

Crie `src/components/domain/settings/notification-history.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotificationLog } from "@/hooks/settings/use-notification-settings";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TEMPLATE_LABELS: Record<string, string> = {
  "appointment-created":   "Confirmação",
  "appointment-confirmed": "Confirmado",
  "appointment-reminder":  "Lembrete",
  "appointment-cancelled": "Cancelamento",
  "appointment-no-show":   "Não compareceu",
  "birthday":              "Aniversário",
};

const STATUS_BADGE: Record<string, string> = {
  SENT:    "bg-emerald-100 text-emerald-700",
  FAILED:  "bg-red-100 text-red-700",
  PENDING: "bg-slate-100 text-slate-500",
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export function NotificationHistory() {
  const [page, setPage] = useState(1);
  const [template, setTemplate] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();

  const { data, isLoading } = useNotificationLog({ page, template, status });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">Histórico de notificações</p>

      {/* Filtros */}
      <div className="flex gap-2">
        <Select
          value={template ?? "all"}
          onValueChange={(v) => { setTemplate(v === "all" ? undefined : v); setPage(1); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status ?? "all"}
          onValueChange={(v) => { setStatus(v === "all" ? undefined : v); setPage(1); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="SENT">Enviado</SelectItem>
            <SelectItem value="FAILED">Falhou</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : !data?.data.length ? (
        <p className="py-8 text-center text-sm text-slate-400">Nenhuma notificação encontrada.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {data.data.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-800">
                  {TEMPLATE_LABELS[entry.template] ?? entry.template}
                </p>
                <p className="text-xs text-slate-400">{entry.recipient} · {fmt(entry.createdAt)}</p>
                {entry.errorMessage && (
                  <p className="text-xs text-red-500">{entry.errorMessage}</p>
                )}
              </div>
              <Badge className={STATUS_BADGE[entry.status] ?? "bg-slate-100 text-slate-500"}>
                {entry.status === "SENT" ? "Enviado" : entry.status === "FAILED" ? "Falhou" : "Pendente"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            {data?.total} resultado{(data?.total ?? 0) !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="flex items-center px-3 text-xs text-slate-600">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "notification-history"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/notification-history.tsx
git commit -m "feat(notifications): componente NotificationHistory com filtros e paginação"
```

---

## Task 14: Frontend — integrar NotificationHistory na página de Configurações

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Step 1: Adicionar import e renderização**

Em `src/app/(app)/configuracoes/page.tsx`:

1. Adicionar import no topo (junto com os outros imports de componentes):

```typescript
import { NotificationHistory } from '@/components/domain/settings/notification-history'
```

2. Dentro do `<TabsContent value="whatsapp" ...>`, após `<WhatsAppSettingsForm />`, adicionar:

```tsx
<NotificationHistory />
```

O bloco completo da aba whatsapp ficará:

```tsx
<TabsContent value="whatsapp" className="mt-6">
  <div className="space-y-6">
    <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-950">
        Notificações WhatsApp
      </h2>
      <WhatsAppSettingsForm />
    </div>
    <NotificationHistory />
  </div>
</TabsContent>
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "configuracoes/page"
```

Saída esperada: nenhuma linha de erro.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/configuracoes/page.tsx
git commit -m "feat(notifications): integra histórico de notificações na aba WhatsApp de Configurações"
```

---

## Task 15: Verificação final e PR

**Files:**
- (verificação apenas)

- [ ] **Step 1: Rodar TypeScript check completo**

```bash
npx tsc --noEmit
```

Saída esperada: zero erros.

- [ ] **Step 2: Rodar todos os testes**

```bash
npx vitest run
```

Saída esperada: todos passando (verificar especialmente `notification.repository.test.ts` e `appointment-reminder.test.ts`).

- [ ] **Step 3: Abrir PR para main**

```bash
gh pr create \
  --title "feat(notifications): notificações avançadas — lembrete config, aniversário, bulk e histórico" \
  --body "## O que essa PR entrega

- Config avançada de lembrete: lead time configurável (2h–48h) + janela de envio (não incomoda clientes à noite)
- Mensagem de aniversário automática via WhatsApp — job pg-boss diário às 9h
- Lembrete bulk 'todos de hoje' — botão na aba WhatsApp de Configurações
- Histórico de notificações — log paginado com filtros por tipo e status
- Template de aniversário editável na UI de personalização de mensagens

## Como testar

1. Settings → WhatsApp → configurar janela de lembrete e verificar que agendamentos criados respeitam o novo lead time
2. Adicionar data de nascimento a um cliente de teste e verificar job de aniversário (testar manualmente via endpoint)
3. Clicar em 'Enviar agora' e verificar contagem de enviados
4. Verificar histórico de notificações na aba WhatsApp" \
  --base main
```

---

## Notas de ambiente

Antes de mergear, verificar que `.env.local` (e variáveis de produção no Vercel) contém:

```
TWILIO_TPL_BIRTHDAY=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Criar o template no Twilio Console → Messaging → Content Template Builder:
- Nome: `birthday_message`
- Variáveis: `{{1}}` nome do cliente, `{{2}}` mensagem principal, `{{3}}` nome do salão, `{{4}}` mensagem final
