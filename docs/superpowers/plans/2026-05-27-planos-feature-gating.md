# Planos e Feature Gating — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o sistema de assinaturas (FREE/STARTER/PRO/ENTERPRISE) com FeatureGuard centralizado, trial de 14 dias automático e bloqueio de acesso por plano nos domínios de WhatsApp, Agendamentos, Relatórios e IAM.

**Architecture:** `Subscription` no PostgreSQL via Prisma armazena o estado canônico; `Tenant.plan` é um cache desnormalizado para leitura rápida sem join. `FeatureGuard` é um singleton consultado pelos services antes de qualquer operação bloqueada por plano. Erros tipados (`PlanFeatureError` 403, `PlanLimitError` 402) são capturados pelo handler global de API e pelo frontend via `UpgradeModal`.

**Tech Stack:** Prisma (migrations customizadas), pg-boss (job diário de expiração), Next.js App Router (API Routes), TanStack Query (frontend), Shadcn UI (modal).

---

## Mapa de Arquivos

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | Modificar — enums PlanName + SubscriptionStatus, models Subscription + SubscriptionHistory, alterar Tenant.plan |
| `src/shared/errors/domain-error.ts` | Modificar — adicionar PlanFeatureError + PlanLimitError |
| `src/shared/events/domain-events.ts` | Modificar — adicionar eventos billing.* |
| `src/lib/dates.ts` | Modificar — adicionar helper addDays |
| `src/domains/billing/types.ts` | Modificar — remover tipos locais conflitantes com Prisma, manter PLAN_LIMITS alinhado |
| `src/domains/billing/billing.repository.ts` | Criar — CRUD de Subscription no banco |
| `src/domains/billing/billing.service.ts` | Criar — startTrial, changePlan, runExpireSweep |
| `src/domains/billing/feature-guard.ts` | Criar — canAccess, assertAccess, assertWithinLimit |
| `src/domains/billing/subscriptions.ts` | Criar — registro do job pg-boss billing:expire-sweep |
| `src/app/api/_lib/runtime.ts` | Modificar — registrar job de billing |
| `src/app/api/billing/status/route.ts` | Criar — GET plano atual + features |
| `src/app/api/admin/subscriptions/[tenantId]/route.ts` | Criar — PATCH gestão manual de plano |
| `src/domains/iam/iam.repository.ts` | Modificar — adicionar countActiveUsers |
| `src/domains/iam/iam.service.ts` | Modificar — startTrial no register, assertWithinLimit no createInvite |
| `src/domains/scheduling/appointment.repository.ts` | Modificar — adicionar countThisMonth |
| `src/domains/scheduling/scheduling.service.ts` | Modificar — assertWithinLimit antes de createAppointment |
| `src/domains/reports/reports.service.ts` | Modificar — assertAccess(REPORTS_ADVANCED) em getProfessionalsReport |
| `src/domains/notifications/providers/whatsapp.provider.ts` | Modificar — assertAccess(WHATSAPP_BASIC) antes de enviar |
| `src/hooks/billing/use-billing-status.ts` | Criar — hook TanStack Query para /api/billing/status |
| `src/components/domain/billing/upgrade-modal.tsx` | Criar — modal de upgrade (402/403) |
| `src/app/(app)/configuracoes/planos/page.tsx` | Criar — página de planos em /configuracoes/planos |

---

## Task 1: Branch

- [ ] **Criar branch de feature**

```bash
git checkout main
git pull origin main
git checkout -b feat/planos-feature-gating
```

---

## Task 2: Schema Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Adicionar enums PlanName e SubscriptionStatus antes do modelo Tenant**

Localizar o bloco de enums existentes (após `enum InviteStatus`) e adicionar logo depois:

```prisma
enum PlanName {
  FREE
  STARTER
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}
```

- [ ] **Alterar o campo `plan` no modelo Tenant e adicionar relação**

Substituir:
```prisma
  plan           String            @default("free")
```
por:
```prisma
  plan           PlanName          @default(FREE)
  subscription   Subscription?
```

- [ ] **Adicionar modelo Subscription após o modelo User**

```prisma
model Subscription {
  id                 String             @id @default(cuid())
  tenantId           String             @unique
  plan               PlanName           @default(FREE)
  status             SubscriptionStatus @default(TRIALING)
  trialEndsAt        DateTime?
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelledAt        DateTime?
  externalId         String?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  history            SubscriptionHistory[]

  @@index([tenantId])
  @@index([status, currentPeriodEnd])
}
```

- [ ] **Adicionar modelo SubscriptionHistory após Subscription**

```prisma
model SubscriptionHistory {
  id             String              @id @default(cuid())
  subscriptionId String
  fromPlan       PlanName?
  toPlan         PlanName
  fromStatus     SubscriptionStatus?
  toStatus       SubscriptionStatus
  reason         String?
  changedBy      String?
  createdAt      DateTime            @default(now())

  subscription   Subscription @relation(fields: [subscriptionId], references: [id])

  @@index([subscriptionId])
}
```

---

## Task 3: Migration (com migração de dados)

**Context:** `Tenant.plan` era `String @default("free")` — valores existentes no banco são `"free"`, `"starter"`, `"pro"`, `"enterprise"` (lowercase). O enum do Prisma usa `FREE`, `STARTER`, etc. (uppercase). A migration precisa converter os dados antes de alterar o tipo da coluna, caso contrário o banco rejeita o cast.

**Files:**
- (Prisma gera automaticamente em `prisma/migrations/`)

- [ ] **Criar a migration sem executar ainda**

```bash
npx prisma migrate dev --create-only --name planos-feature-gating
```

Isso cria `prisma/migrations/TIMESTAMP_planos_feature_gating/migration.sql` sem aplicar.

- [ ] **Editar o arquivo `migration.sql` gerado**

Abrir o arquivo criado. Antes do `ALTER TABLE "Tenant" ALTER COLUMN "plan"`, inserir o bloco de atualização de dados:

```sql
-- Converte valores lowercase existentes para uppercase antes de criar o enum
UPDATE "Tenant" SET plan = UPPER(plan) WHERE plan IN ('free', 'starter', 'pro', 'enterprise');
```

O arquivo final deve ter esta ordem:
1. `CREATE TYPE "PlanName" AS ENUM (...)` — gerado pelo Prisma
2. `CREATE TYPE "SubscriptionStatus" AS ENUM (...)` — gerado pelo Prisma
3. `UPDATE "Tenant" SET plan = UPPER(plan) ...` — adicionado manualmente
4. `ALTER TABLE "Tenant" ALTER COLUMN "plan" TYPE "PlanName" USING plan::"PlanName"` — gerado pelo Prisma
5. `ALTER TABLE "Tenant" ALTER COLUMN "plan" SET DEFAULT 'FREE'::"PlanName"` — gerado pelo Prisma
6. `CREATE TABLE "Subscription" (...)` — gerado pelo Prisma
7. `CREATE TABLE "SubscriptionHistory" (...)` — gerado pelo Prisma

- [ ] **Aplicar a migration e gerar o Prisma Client**

```bash
npx prisma migrate dev
```

Saída esperada: `Database migrated successfully. Generated Prisma Client.`

- [ ] **Verificar que os tipos foram gerados**

```bash
node -e "const { PlanName, SubscriptionStatus } = require('@prisma/client'); console.log(PlanName, SubscriptionStatus)"
```

Saída esperada: `{ FREE: 'FREE', STARTER: 'STARTER', ... } { TRIALING: 'TRIALING', ... }`

---

## Task 4: Erros Tipados de Plano

**Files:**
- Modify: `src/shared/errors/domain-error.ts`

- [ ] **Adicionar PlanFeatureError e PlanLimitError no final de `domain-error.ts`**

```typescript
// --- Billing ---

import type { PlanName } from "@prisma/client";

export class PlanFeatureError extends DomainError {
  constructor(
    public readonly feature: string,
    public readonly requiredPlan: PlanName,
  ) {
    super(
      `Feature "${feature}" requer plano ${requiredPlan} ou superior`,
      "PLAN_FEATURE_REQUIRED",
      403,
      { feature, requiredPlan },
    );
  }
}

export class PlanLimitError extends DomainError {
  constructor(
    public readonly limitType: string,
    public readonly limit: number,
    public readonly current: number,
  ) {
    super(
      `Limite de ${limitType} atingido (${current}/${limit})`,
      "PLAN_LIMIT_EXCEEDED",
      402,
      { limitType, limit, current },
    );
  }
}
```

> **Nota:** `DomainError` já é capturado pelo `handleApiError` via `error instanceof DomainError`, então `PlanFeatureError` e `PlanLimitError` são serializados automaticamente com `error.code`, `error.statusCode` e `error.details`. Não há nenhuma alteração necessária no `handleApiError`.

- [ ] **Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/shared/errors/domain-error.ts
git commit -m "feat(billing): schema de planos + erros tipados PlanFeatureError e PlanLimitError"
```

---

## Task 5: Helper addDays e Eventos de Billing

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `src/shared/events/domain-events.ts`

- [ ] **Adicionar `addDays` ao final de `src/lib/dates.ts`**

```typescript
export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
```

- [ ] **Adicionar eventos de billing em `src/shared/events/domain-events.ts`**

Adicionar ao tipo `DomainEvent` (após o evento `notifications.notification.logged`):

```typescript
  | {
      type: "billing.trial.expired";
      payload: { tenantId: string };
    }
  | {
      type: "billing.subscription.upgraded";
      payload: {
        tenantId: string;
        fromPlan: import("@prisma/client").PlanName | undefined;
        toPlan: import("@prisma/client").PlanName;
      };
    };
```

---

## Task 6: Atualizar billing/types.ts

**Files:**
- Modify: `src/domains/billing/types.ts`

**Context:** `billing/types.ts` tem uma `PlanName` e `SubscriptionStatus` locais que agora existem no Prisma Client. Se os dois coexistirem, há conflito de tipo. O Prisma usa uppercase (`FREE`, `STARTER`); o arquivo atual usa lowercase.

- [ ] **Substituir o conteúdo completo de `src/domains/billing/types.ts`**

```typescript
import { z } from "zod";
import { PlanName, SubscriptionStatus } from "@prisma/client";

export { PlanName, SubscriptionStatus };

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  FREE:       { maxUsers: 2,   maxAppointmentsPerMonth: 50,   maxNotificationsPerMonth: 0,    maxUnits: 1 },
  STARTER:    { maxUsers: 5,   maxAppointmentsPerMonth: 300,  maxNotificationsPerMonth: 200,  maxUnits: 1 },
  PRO:        { maxUsers: 20,  maxAppointmentsPerMonth: 2000, maxNotificationsPerMonth: 2000, maxUnits: 3 },
  ENTERPRISE: { maxUsers: -1,  maxAppointmentsPerMonth: -1,   maxNotificationsPerMonth: -1,   maxUnits: -1 },
} as const;

export type PlanLimits = {
  maxUsers: number;
  maxAppointmentsPerMonth: number;
  maxNotificationsPerMonth: number;
  maxUnits: number;
};

export const updateSubscriptionSchema = z.object({
  plan: z.nativeEnum(PlanName),
  status: z.nativeEnum(SubscriptionStatus),
  reason: z.string().min(1),
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
```

---

## Task 7: BillingRepository

**Files:**
- Create: `src/domains/billing/billing.repository.ts`

- [ ] **Criar `src/domains/billing/billing.repository.ts`**

```typescript
import { PlanName, SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

type CreateSubscriptionData = {
  tenantId: string;
  plan: PlanName;
  status: SubscriptionStatus;
  trialEndsAt?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
};

type UpdateSubscriptionData = {
  plan?: PlanName;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date | null;
};

type CreateHistoryData = {
  subscriptionId: string;
  fromPlan?: PlanName | null;
  toPlan: PlanName;
  fromStatus?: SubscriptionStatus | null;
  toStatus: SubscriptionStatus;
  reason?: string;
  changedBy?: string;
};

export class BillingRepository {
  async createSubscription(data: CreateSubscriptionData) {
    return prisma.subscription.create({ data });
  }

  async getSubscription(tenantId: string) {
    return prisma.subscription.findUnique({ where: { tenantId } });
  }

  async updateSubscription(tenantId: string, data: UpdateSubscriptionData) {
    return prisma.subscription.update({ where: { tenantId }, data });
  }

  async addHistory(data: CreateHistoryData) {
    return prisma.subscriptionHistory.create({ data });
  }

  async updateTenantPlanCache(tenantId: string, plan: PlanName) {
    await prisma.tenant.update({ where: { id: tenantId }, data: { plan } });
  }

  async findExpiredTrials(now: Date) {
    return prisma.subscription.findMany({
      where: { status: "TRIALING", trialEndsAt: { lt: now } },
    });
  }

  async findExpiredActive(now: Date) {
    return prisma.subscription.findMany({
      where: { status: "ACTIVE", currentPeriodEnd: { lt: now } },
    });
  }
}

export const billingRepository = new BillingRepository();
```

---

## Task 8: BillingService

**Files:**
- Create: `src/domains/billing/billing.service.ts`

- [ ] **Criar `src/domains/billing/billing.service.ts`**

```typescript
import { PlanName, SubscriptionStatus } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";
import { addDays } from "@/lib/dates";

import { billingRepository } from "./billing.repository";

export class BillingService {
  async startTrial(tenantId: string) {
    const now = new Date();
    const trialEndsAt = addDays(now, 14);

    const sub = await billingRepository.createSubscription({
      tenantId,
      plan: PlanName.STARTER,
      status: SubscriptionStatus.TRIALING,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    });

    await billingRepository.updateTenantPlanCache(tenantId, PlanName.STARTER);

    return sub;
  }

  async changePlan(
    tenantId: string,
    newPlan: PlanName,
    newStatus: SubscriptionStatus,
    changedBy: string,
    reason: string,
  ) {
    const current = await billingRepository.getSubscription(tenantId);
    const now = new Date();

    const updated = await billingRepository.updateSubscription(tenantId, {
      plan: newPlan,
      status: newStatus,
      currentPeriodStart: now,
      currentPeriodEnd: addDays(now, 30),
      ...(newStatus === SubscriptionStatus.CANCELLED ? { cancelledAt: now } : {}),
    });

    await billingRepository.addHistory({
      subscriptionId: updated.id,
      fromPlan: current?.plan ?? null,
      toPlan: newPlan,
      fromStatus: current?.status ?? null,
      toStatus: newStatus,
      reason,
      changedBy,
    });

    await billingRepository.updateTenantPlanCache(tenantId, newPlan);

    eventBus.publish({
      type: "billing.subscription.upgraded",
      payload: { tenantId, fromPlan: current?.plan, toPlan: newPlan },
    });

    return updated;
  }

  async runExpireSweep() {
    const now = new Date();

    const expiredTrials = await billingRepository.findExpiredTrials(now);
    for (const sub of expiredTrials) {
      await this.changePlan(sub.tenantId, PlanName.FREE, SubscriptionStatus.EXPIRED, "system", "trial_expired");
      eventBus.publish({ type: "billing.trial.expired", payload: { tenantId: sub.tenantId } });
    }

    const expiredActive = await billingRepository.findExpiredActive(now);
    for (const sub of expiredActive) {
      await this.changePlan(sub.tenantId, sub.plan, SubscriptionStatus.EXPIRED, "system", "period_expired");
    }
  }
}

export const billingService = new BillingService();
```

---

## Task 9: FeatureGuard

**Files:**
- Create: `src/domains/billing/feature-guard.ts`

- [ ] **Criar `src/domains/billing/feature-guard.ts`**

```typescript
import { PlanName, SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { PlanFeatureError, PlanLimitError } from "@/shared/errors";

export const FEATURES = {
  WHATSAPP_BASIC:   "whatsapp_basic",
  WHATSAPP_PREMIUM: "whatsapp_premium",
  REPORTS_BASIC:    "reports_basic",
  REPORTS_ADVANCED: "reports_advanced",
  CAMPAIGNS:        "campaigns",
  MULTI_UNIT:       "multi_unit",
} as const;

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES];

const PLAN_FEATURES: Record<PlanName, Set<FeatureName>> = {
  FREE:       new Set(["reports_basic"]),
  STARTER:    new Set(["reports_basic", "whatsapp_basic", "campaigns"]),
  PRO:        new Set(["reports_basic", "reports_advanced", "whatsapp_basic", "whatsapp_premium", "campaigns", "multi_unit"]),
  ENTERPRISE: new Set(Object.values(FEATURES) as FeatureName[]),
};

const PLAN_LIMITS: Record<PlanName, Record<string, number>> = {
  FREE:       { users: 2,   appointments_month: 50   },
  STARTER:    { users: 5,   appointments_month: 300  },
  PRO:        { users: 20,  appointments_month: 2000 },
  ENTERPRISE: { users: -1,  appointments_month: -1   },
};

const FEATURE_MIN_PLAN: Record<FeatureName, PlanName> = {
  whatsapp_basic:    PlanName.STARTER,
  whatsapp_premium:  PlanName.PRO,
  reports_basic:     PlanName.FREE,
  reports_advanced:  PlanName.PRO,
  campaigns:         PlanName.STARTER,
  multi_unit:        PlanName.PRO,
};

export class FeatureGuard {
  async canAccess(tenantId: string, feature: FeatureName): Promise<boolean> {
    const { plan, status } = await this.getSubscriptionState(tenantId);
    if (!this.isActive(status)) return false;
    return PLAN_FEATURES[plan].has(feature);
  }

  async assertAccess(tenantId: string, feature: FeatureName): Promise<void> {
    const has = await this.canAccess(tenantId, feature);
    if (!has) {
      throw new PlanFeatureError(feature, FEATURE_MIN_PLAN[feature]);
    }
  }

  async assertWithinLimit(
    tenantId: string,
    limitType: "users" | "appointments_month",
    currentCount: number,
  ): Promise<void> {
    const { plan, status } = await this.getSubscriptionState(tenantId);
    if (!this.isActive(status)) return;
    const limit = PLAN_LIMITS[plan][limitType];
    if (limit !== -1 && currentCount >= limit) {
      throw new PlanLimitError(limitType, limit, currentCount);
    }
  }

  async getSubscriptionState(tenantId: string): Promise<{ plan: PlanName; status: string }> {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        plan: true,
        subscription: { select: { status: true, trialEndsAt: true } },
      },
    });

    const status = tenant.subscription?.status ?? SubscriptionStatus.EXPIRED;

    if (status === SubscriptionStatus.TRIALING && tenant.subscription?.trialEndsAt) {
      if (tenant.subscription.trialEndsAt < new Date()) {
        return { plan: PlanName.FREE, status: SubscriptionStatus.EXPIRED };
      }
    }

    return { plan: tenant.plan, status };
  }

  private isActive(status: string): boolean {
    return [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE].includes(status as SubscriptionStatus);
  }
}

export const featureGuard = new FeatureGuard();
```

- [ ] **Commit**

```bash
git add src/lib/dates.ts src/shared/events/domain-events.ts src/domains/billing/
git commit -m "feat(billing): BillingRepository, BillingService, FeatureGuard e eventos"
```

---

## Task 10: Job pg-boss de Expiração + Runtime

**Files:**
- Create: `src/domains/billing/subscriptions.ts`
- Modify: `src/app/api/_lib/runtime.ts`

- [ ] **Criar `src/domains/billing/subscriptions.ts`**

```typescript
import type { PgBoss } from "pg-boss";

import { billingService } from "./billing.service";

export const BILLING_EXPIRE_SWEEP_JOB = "billing:expire-sweep";

export function registerBillingJobs(boss: PgBoss) {
  void boss.schedule(BILLING_EXPIRE_SWEEP_JOB, "0 5 * * *", {});
  void boss.work(BILLING_EXPIRE_SWEEP_JOB, async () => {
    await billingService.runExpireSweep();
  });
}
```

- [ ] **Atualizar `src/app/api/_lib/runtime.ts` para registrar o job de billing**

Adicionar import e chamada no `startPgBoss().then(...)`:

```typescript
import { registerFinancialSubscriptions } from "@/domains/financial/subscriptions";
import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";
import { registerBillingJobs } from "@/domains/billing/subscriptions";
import { startPgBoss } from "@/shared/queue/pg-boss";
import {
  APPOINTMENT_REMINDER_JOB,
  handleAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";

let initialized = false;

export function initializeDomainRuntime() {
  if (initialized) {
    return;
  }

  registerFinancialSubscriptions();
  registerNotificationSubscriptions();

  startPgBoss().then((boss) => {
    boss.work(APPOINTMENT_REMINDER_JOB, handleAppointmentReminder);
    registerBillingJobs(boss);
  }).catch(console.error);

  initialized = true;
}
```

---

## Task 11: API Route — GET /api/billing/status

**Files:**
- Create: `src/app/api/billing/status/route.ts`

- [ ] **Criar `src/app/api/billing/status/route.ts`**

```typescript
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { billingRepository } from "@/domains/billing/billing.repository";
import { PLAN_LIMITS } from "@/domains/billing/types";
import { prisma } from "@/shared/database/prisma";
import { startOfMonth, endOfDay } from "@/lib/dates";

export async function GET(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    const { plan, status } = await featureGuard.getSubscriptionState(session.tenantId);
    const sub = await billingRepository.getSubscription(session.tenantId);

    const limits = PLAN_LIMITS[plan];

    const [userCount, appointmentCount] = await Promise.all([
      prisma.user.count({ where: { tenantId: session.tenantId } }),
      prisma.appointment.count({
        where: {
          tenantId: session.tenantId,
          startsAt: { gte: startOfMonth(new Date()), lte: endOfDay(new Date()) },
        },
      }),
    ]);

    const activeFeatures: Record<string, boolean> = {};
    for (const f of Object.values(FEATURES)) {
      activeFeatures[f] = await featureGuard.canAccess(session.tenantId, f);
    }

    return Response.json({
      plan,
      status,
      trialEndsAt: sub?.trialEndsAt ?? null,
      features: activeFeatures,
      limits: {
        users:              { current: userCount,       max: limits.maxUsers },
        appointments_month: { current: appointmentCount, max: limits.maxAppointmentsPerMonth },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

> **Nota de simplificação:** O cálculo de features acima chama `featureGuard.canAccess` em loop, o que faz múltiplas queries. Para produção, refatorar para uma única leitura do estado e cálculo local. Para o MVP, é aceitável — o endpoint é chamado raramente (carregamento da página de configurações).

---

## Task 12: API Route — PATCH /api/admin/subscriptions/[tenantId]

**Files:**
- Create: `src/app/api/admin/subscriptions/[tenantId]/route.ts`

**Context:** Endpoint de gestão manual. Protegido por `Authorization: Bearer ADMIN_SECRET` (variável `ADMIN_API_SECRET` no `.env`). Não usa sessão do tenant — é uma rota de backoffice.

- [ ] **Criar `src/app/api/admin/subscriptions/[tenantId]/route.ts`**

```typescript
import { billingService } from "@/domains/billing/billing.service";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { UnauthorizedError } from "@/shared/errors";
import { updateSubscriptionSchema } from "@/domains/billing/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const secret = process.env.ADMIN_API_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      throw new UnauthorizedError("Acesso restrito a administradores.");
    }

    const { tenantId } = await params;
    const input = await validateInput(request, updateSubscriptionSchema);

    const updated = await billingService.changePlan(
      tenantId,
      input.plan,
      input.status,
      "admin",
      input.reason,
    );

    return Response.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Adicionar `ADMIN_API_SECRET` ao `.env.local` (se não existir)**

```bash
# Adicionar no .env.local:
ADMIN_API_SECRET=dev-admin-secret-alterar-em-producao
```

- [ ] **Testar o endpoint manualmente**

```bash
curl -X PATCH http://localhost:3000/api/admin/subscriptions/SEU_TENANT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-admin-secret-alterar-em-producao" \
  -d '{"plan": "PRO", "status": "ACTIVE", "reason": "teste_manual"}'
```

Saída esperada: objeto da subscription atualizada com `plan: "PRO"` e `status: "ACTIVE"`.

- [ ] **Commit**

```bash
git add src/domains/billing/subscriptions.ts src/app/api/_lib/runtime.ts src/app/api/billing/ src/app/api/admin/
git commit -m "feat(billing): job pg-boss expire-sweep, rotas GET /billing/status e PATCH /admin/subscriptions"
```

---

## Task 13: Integração — WhatsApp Provider

**Files:**
- Modify: `src/domains/notifications/providers/whatsapp.provider.ts`

- [ ] **Adicionar `assertAccess` antes de enviar mensagem**

No método `send()`, antes do bloco `try { const res = await fetch(...)`, adicionar:

```typescript
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";

// ... (dentro do método send, antes do bloco try)
await featureGuard.assertAccess(draft.tenantId, FEATURES.WHATSAPP_BASIC);
```

O início do método `send()` ficará assim:

```typescript
  async send(draft: NotificationDraft): Promise<NotificationDeliveryResult> {
    if (!draft.recipient) {
      return { status: NotificationStatus.FAILED, errorMessage: "Destinatario sem telefone." };
    }

    await featureGuard.assertAccess(draft.tenantId, FEATURES.WHATSAPP_BASIC);

    const tenant = await prisma.tenant.findFirst({
      where: { id: draft.tenantId },
      select: { zApiInstanceId: true, zApiToken: true, whatsappEnabled: true },
    });
    // ... resto inalterado
```

> **Nota:** `PlanFeatureError` lança código 403 e é capturado pelo chamador — o `notificationService.logAndDispatch` faz `try/catch` e registra o erro no `NotificationLog`. O tenant sem plano adequado não recebe a mensagem e o status fica `FAILED` com a mensagem do erro de plano.

---

## Task 14: Integração — Agendamentos (limite mensal)

**Files:**
- Modify: `src/domains/scheduling/appointment.repository.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts`

- [ ] **Adicionar `countThisMonth` ao `appointment.repository.ts`**

Adicionar o método na classe `AppointmentRepository` (ou no objeto exportado, seguindo o padrão existente):

```typescript
import { startOfMonth, endOfDay } from "@/lib/dates";

async countThisMonth(tenantId: string): Promise<number> {
  return prisma.appointment.count({
    where: {
      tenantId,
      startsAt: { gte: startOfMonth(new Date()), lte: endOfDay(new Date()) },
    },
  });
}
```

- [ ] **Verificar o padrão de exportação do `appointment.repository.ts`**

Abrir o arquivo e verificar se a classe é instanciada e exportada como singleton (ex: `export const appointmentRepository = new AppointmentRepository()`). Seguir o mesmo padrão.

- [ ] **Adicionar `assertWithinLimit` em `scheduling.service.ts` antes de criar agendamento**

No método `createAppointment`, logo após `ensurePermission` e antes da criação do Service/Customer, adicionar:

```typescript
import { featureGuard } from "@/domains/billing/feature-guard";
import { appointmentRepository } from "./appointment.repository";

// ... dentro de createAppointment, antes de qualquer query:
const appointmentCount = await appointmentRepository.countThisMonth(tenantId);
await featureGuard.assertWithinLimit(tenantId, "appointments_month", appointmentCount);
```

---

## Task 15: Integração — Relatórios Avançados

**Files:**
- Modify: `src/domains/reports/reports.service.ts`

- [ ] **Adicionar `assertAccess(REPORTS_ADVANCED)` em `getProfessionalsReport`**

No início do método `getProfessionalsReport`, antes do `const from = ...`:

```typescript
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";

// ... dentro de getProfessionalsReport:
await featureGuard.assertAccess(tenantId, FEATURES.REPORTS_ADVANCED);
```

> **Decisão:** Os relatórios de profissionais são classificados como "avançados" pois exibem análises individuais de performance, comissão implícita e comparativos. Os relatórios financeiro, de agendamentos e de clientes são "básicos" (disponíveis a partir do plano FREE).

---

## Task 16: Integração — IAM (limite de usuários + startTrial no registro)

**Files:**
- Modify: `src/domains/iam/iam.repository.ts`
- Modify: `src/domains/iam/iam.service.ts`

- [ ] **Adicionar `countActiveUsers` ao `iam.repository.ts`**

Na classe `IamRepository`, adicionar:

```typescript
async countActiveUsers(tenantId: string): Promise<number> {
  return prisma.user.count({ where: { tenantId } });
}
```

- [ ] **Chamar `startTrial` após criar o tenant em `iam.service.ts`**

No método `register`, após o bloco `await supabaseAdmin.auth.admin.updateUserById(...)`, adicionar:

```typescript
import { billingService } from "@/domains/billing/billing.service";

// ... após updateUserById:
await billingService.startTrial(createResult.tenant.id);
```

- [ ] **Adicionar verificação de limite antes de criar convite em `iam.service.ts`**

No método `createInvite`, antes de `const invite = await iamRepository.createInvite(...)`, adicionar:

```typescript
import { featureGuard } from "@/domains/billing/feature-guard";

// ... no início de createInvite:
const userCount = await iamRepository.countActiveUsers(tenantId);
await featureGuard.assertWithinLimit(tenantId, "users", userCount);
```

- [ ] **Commit**

```bash
git add src/domains/notifications/ src/domains/scheduling/ src/domains/reports/ src/domains/iam/
git commit -m "feat(billing): integra FeatureGuard em WhatsApp, Agendamentos, Relatórios e IAM"
```

---

## Task 17: Hook Frontend — useBillingStatus

**Files:**
- Create: `src/hooks/billing/use-billing-status.ts`

- [ ] **Criar `src/hooks/billing/use-billing-status.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";

type BillingStatus = {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  features: Record<string, boolean>;
  limits: {
    users: { current: number; max: number };
    appointments_month: { current: number; max: number };
  };
};

async function fetchBillingStatus(): Promise<BillingStatus> {
  const res = await fetch("/api/billing/status");
  if (!res.ok) throw new Error("Erro ao buscar status do plano");
  return res.json();
}

export function useBillingStatus() {
  return useQuery({
    queryKey: ["billing", "status"],
    queryFn: fetchBillingStatus,
    staleTime: 5 * 60 * 1000,
  });
}
```

> **Nota:** Se `use-current-user` exporta o hook com nome diferente (ex: `useCurrentUser`), remova a importação de `useSession` — o hook de billing não depende diretamente do usuário atual, só faz um GET autenticado via cookie de sessão.

---

## Task 18: UpgradeModal Component

**Files:**
- Create: `src/components/domain/billing/upgrade-modal.tsx`

**Context:** O Shadcn UI neste projeto usa o preset "Nova". Todos os componentes do Shadcn já estão em `src/components/ui/`. Para usar o Dialog, importe de lá. Não re-instale componentes.

- [ ] **Verificar que Dialog está disponível**

```bash
ls src/components/ui/ | grep dialog
```

Se não existir: `npx shadcn@latest add dialog`

- [ ] **Criar `src/components/domain/billing/upgrade-modal.tsx`**

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type UpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  requiredPlan?: string;
};

const PLAN_LABEL: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const FEATURE_LABEL: Record<string, string> = {
  whatsapp_basic:   "WhatsApp (envio de mensagens)",
  whatsapp_premium: "WhatsApp Premium (Meta Cloud API)",
  reports_advanced: "Relatórios avançados",
  campaigns:        "Campanhas de marketing",
  multi_unit:       "Multi-unidade",
};

export function UpgradeModal({ open, onOpenChange, feature, requiredPlan }: UpgradeModalProps) {
  const featureLabel = feature ? (FEATURE_LABEL[feature] ?? feature) : "esta funcionalidade";
  const planLabel = requiredPlan ? (PLAN_LABEL[requiredPlan] ?? requiredPlan) : "um plano superior";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade necessário</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{featureLabel}</span> requer o plano{" "}
            <Badge variant="secondary">{planLabel}</Badge> ou superior.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Faça upgrade do seu plano para desbloquear esta e outras funcionalidades:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>WhatsApp automático de confirmação e lembrete</li>
            <li>Relatórios avançados por profissional</li>
            <li>Campanhas de marketing segmentadas</li>
          </ul>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" asChild>
            <a
              href="https://wa.me/5500000000000?text=Quero+fazer+upgrade+do+meu+plano"
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar com suporte
            </a>
          </Button>
          <Button asChild>
            <a href="/configuracoes/planos">Ver planos</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

> **Importante:** Substituir o número do WhatsApp de suporte no href pelo número real antes de ir para produção.

---

## Task 19: Página de Planos — /configuracoes/planos

**Files:**
- Create: `src/app/(app)/configuracoes/planos/page.tsx`

- [ ] **Verificar se existe o arquivo `src/app/(app)/configuracoes/page.tsx`**

O arquivo deve existir (configurações com tabs). A página de planos será uma rota separada em `/configuracoes/planos`.

- [ ] **Criar `src/app/(app)/configuracoes/planos/page.tsx`**

```tsx
import { Suspense } from "react";
import { BillingPlansContent } from "@/components/domain/billing/billing-plans-content";

export default function PlanosPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Planos</h1>
        <p className="text-muted-foreground">Gerencie sua assinatura e veja os recursos disponíveis.</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <BillingPlansContent />
      </Suspense>
    </div>
  );
}
```

- [ ] **Criar `src/components/domain/billing/billing-plans-content.tsx`**

```tsx
"use client";

import { useBillingStatus } from "@/hooks/billing/use-billing-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const PLAN_FEATURES_TABLE = [
  { feature: "Agendamentos/mês",   free: "50",        starter: "300",     pro: "2.000" },
  { feature: "Usuários",           free: "2",         starter: "5",       pro: "20"   },
  { feature: "WhatsApp básico",    free: "—",         starter: "✓",       pro: "✓"    },
  { feature: "Relatórios básicos", free: "✓",         starter: "✓",       pro: "✓"    },
  { feature: "Relatórios avançados", free: "—",       starter: "—",       pro: "✓"    },
  { feature: "Campanhas",          free: "—",         starter: "✓",       pro: "✓"    },
];

const STATUS_LABEL: Record<string, string> = {
  TRIALING:  "Trial ativo",
  ACTIVE:    "Ativo",
  PAST_DUE:  "Pagamento pendente",
  CANCELLED: "Cancelado",
  EXPIRED:   "Expirado",
};

export function BillingPlansContent() {
  const { data, isLoading } = useBillingStatus();

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  if (!data) return null;

  const trialDaysLeft = data.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Plano atual: {data.plan}
            <Badge variant={data.status === "ACTIVE" || data.status === "TRIALING" ? "default" : "destructive"}>
              {STATUS_LABEL[data.status] ?? data.status}
            </Badge>
          </CardTitle>
          {trialDaysLeft !== null && data.status === "TRIALING" && (
            <CardDescription>
              {trialDaysLeft > 0
                ? `Trial termina em ${trialDaysLeft} dia(s)`
                : "Trial encerrado"}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Agendamentos este mês</p>
            <p className="font-medium">
              {data.limits.appointments_month.current} /{" "}
              {data.limits.appointments_month.max === -1 ? "Ilimitado" : data.limits.appointments_month.max}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Usuários</p>
            <p className="font-medium">
              {data.limits.users.current} /{" "}
              {data.limits.users.max === -1 ? "Ilimitado" : data.limits.users.max}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium">Recurso</th>
              <th className="p-3 text-center font-medium">Free</th>
              <th className="p-3 text-center font-medium">Starter</th>
              <th className="p-3 text-center font-medium">Pro</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES_TABLE.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-3">{row.feature}</td>
                <td className="p-3 text-center text-muted-foreground">{row.free}</td>
                <td className="p-3 text-center">{row.starter}</td>
                <td className="p-3 text-center">{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground">
        Para fazer upgrade do seu plano, entre em contato com o suporte via WhatsApp.
      </p>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add src/hooks/billing/ src/components/domain/billing/ src/app/(app)/configuracoes/planos/
git commit -m "feat(billing): UpgradeModal, página de planos e hook useBillingStatus"
```

---

## Task 20: Teste de ponta a ponta + PR

- [ ] **Verificar que o build TypeScript passa sem erros**

```bash
npx tsc --noEmit
```

Corrigir qualquer erro de tipo antes de prosseguir.

- [ ] **Subir o servidor de desenvolvimento e testar o fluxo manual**

```bash
npm run dev
```

1. Criar um novo tenant via `/onboarding` → verificar que `Subscription` foi criada no banco com `status: TRIALING`
2. Acessar `/configuracoes/planos` → verificar que exibe plano, status e limites corretos
3. Tentar criar um agendamento com tenant FREE com 50+ agendamentos → verificar que retorna 402
4. Chamar `PATCH /api/admin/subscriptions/:tenantId` com PRO → verificar que plano atualiza

- [ ] **Criar PR para main**

```bash
git push origin feat/planos-feature-gating
```

Abrir PR: `feat(fase5): sistema de planos, subscriptions e feature gating`

---

## Notas de Implementação

### Dados de trial existentes
Tenants criados antes desta feature não terão `Subscription`. Ao chamarem qualquer endpoint protegido por `FeatureGuard`, `getSubscriptionState` lança `PrismaClientKnownRequestError` porque `findUniqueOrThrow` não encontrará o tenant (ou encontrará sem subscription). Para migrar tenants existentes de desenvolvimento, rodar manualmente:

```sql
-- Para cada tenant existente sem subscription, criar uma trial já expirada (free)
-- ou uma trial ativa (teste):
INSERT INTO "Subscription" (id, "tenantId", plan, status, "trialEndsAt", "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt")
SELECT gen_random_uuid(), id, 'STARTER', 'TRIALING',
       NOW() + INTERVAL '14 days', NOW(), NOW() + INTERVAL '14 days',
       NOW(), NOW()
FROM "Tenant"
WHERE id NOT IN (SELECT "tenantId" FROM "Subscription");
```

### Sem framework de testes
O projeto não tem Jest/Vitest configurado. A verificação de comportamento é feita via:
1. `npx tsc --noEmit` — garante tipos corretos
2. Testes manuais via `npm run dev` + curl/browser
3. Verificação direta no banco Supabase via SQL Editor
