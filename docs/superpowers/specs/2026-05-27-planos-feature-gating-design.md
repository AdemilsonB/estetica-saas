# Spec: Sistema de Planos e Feature Gating

**Data:** 2026-05-27
**Status:** Aprovado — pronto para implementação
**Domínio:** Billing
**Estimativa:** Médio (1–3h)

---

## Contexto

O sistema atual tem `Tenant.plan: String @default("free")` sem nenhum enforcement. O domínio
`billing` existe como stub com `PLAN_LIMITS` e `PLAN_NAMES` definidos mas sem repository,
service ou model Prisma. O WhatsApp hoje usa Z-API com flags `whatsappEnabled` no Tenant,
sem verificação de plano.

Este spec implementa o sistema completo de planos — sem gateway de pagamento (gestão manual
por enquanto), pronto para integrar Asaas/Stripe na Fase 3.

---

## Planos e Limites

| Feature                    | FREE      | STARTER   | PRO        | ENTERPRISE |
|----------------------------|-----------|-----------|------------|------------|
| Usuários/profissionais     | 2         | 5         | 20         | Ilimitado  |
| Agendamentos/mês           | 50        | 300       | 2.000      | Ilimitado  |
| WhatsApp (Z-API básico)    | ✗         | ✓         | ✓          | ✓          |
| WhatsApp Premium (Meta API)| ✗         | ✗         | ✓          | ✓          |
| Relatórios básicos         | ✓         | ✓         | ✓          | ✓          |
| Relatórios avançados       | ✗         | ✗         | ✓          | ✓          |
| Campanhas de marketing     | ✗         | ✓         | ✓          | ✓          |
| Multi-unidade              | ✗         | ✗         | ✓ (até 3)  | Ilimitado  |
| Trial gratuito             | —         | 14 dias   | 14 dias    | 14 dias    |

**Preços referência (ainda não cobrado automaticamente):**
- Starter: ~R$49/mês
- Pro: ~R$149/mês
- Enterprise: sob consulta

---

## Arquitetura

```
Evento de negócio (criar agendamento, enviar WhatsApp, etc.)
        ↓
Service do domínio chama FeatureGuard
        ↓
FeatureGuard lê Tenant.plan (cache) + Subscription.status
        ↓
  ┌─────────────────────────────┐
  │ canAccess(feature)?         │──→ false → lança PlanFeatureError (403)
  │ assertWithinLimit(count)?   │──→ excede → lança PlanLimitError (402)
  └─────────────────────────────┘
        ↓ (acesso permitido)
Service continua normalmente
```

---

## Schema Prisma

### Novos enums

```prisma
enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}

enum PlanName {
  FREE
  STARTER
  PRO
  ENTERPRISE
}
```

### Novo model: Subscription

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
  externalId         String?            // ID no Asaas/Stripe (fase 3)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  history            SubscriptionHistory[]

  @@index([tenantId])
  @@index([status, currentPeriodEnd])
}
```

### Novo model: SubscriptionHistory

```prisma
model SubscriptionHistory {
  id             String             @id @default(cuid())
  subscriptionId String
  fromPlan       PlanName?
  toPlan         PlanName
  fromStatus     SubscriptionStatus?
  toStatus       SubscriptionStatus
  reason         String?
  changedBy      String?
  createdAt      DateTime           @default(now())

  subscription   Subscription @relation(fields: [subscriptionId], references: [id])

  @@index([subscriptionId])
}
```

### Alteração no model Tenant

Substituir `plan String @default("free")` por:

```prisma
plan         PlanName     @default(FREE)
subscription Subscription?
```

---

## Estrutura de Arquivos

```
src/domains/billing/
├── types.ts                         (atualizar com novos tipos)
├── feature-guard.ts                 (NOVO — central de verificação)
├── billing.service.ts               (NOVO — ciclo de vida da assinatura)
├── billing.repository.ts            (NOVO — acesso ao banco)
└── subscriptions.ts                 (NOVO — job de expiração via pg-boss)

src/shared/errors/
└── plan.errors.ts                   (NOVO — PlanFeatureError, PlanLimitError)

src/app/api/
├── admin/
│   └── subscriptions/
│       └── route.ts                 (NOVO — CRUD manual de planos)
└── billing/
    └── status/
        └── route.ts                 (NOVO — GET plano + features do tenant atual)
```

---

## Feature Guard — Implementação

### Constantes de feature

```typescript
// src/domains/billing/feature-guard.ts

import { PlanName } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import { PlanFeatureError, PlanLimitError } from "@/shared/errors/plan.errors";

export const FEATURES = {
  WHATSAPP_BASIC:      "whatsapp_basic",
  WHATSAPP_PREMIUM:    "whatsapp_premium",
  REPORTS_BASIC:       "reports_basic",
  REPORTS_ADVANCED:    "reports_advanced",
  CAMPAIGNS:           "campaigns",
  MULTI_UNIT:          "multi_unit",
} as const;

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES];

const PLAN_FEATURES: Record<PlanName, Set<FeatureName>> = {
  FREE:       new Set(["reports_basic"]),
  STARTER:    new Set(["reports_basic", "whatsapp_basic", "campaigns"]),
  PRO:        new Set(["reports_basic", "reports_advanced", "whatsapp_basic",
                       "whatsapp_premium", "campaigns", "multi_unit"]),
  ENTERPRISE: new Set(Object.values(FEATURES) as FeatureName[]),
};

// Limite -1 = ilimitado
const PLAN_LIMITS: Record<PlanName, Record<string, number>> = {
  FREE:       { users: 2,  appointments_month: 50    },
  STARTER:    { users: 5,  appointments_month: 300   },
  PRO:        { users: 20, appointments_month: 2000  },
  ENTERPRISE: { users: -1, appointments_month: -1    },
};

// Feature mínima exigida por plano (para mensagem de upgrade)
const FEATURE_MIN_PLAN: Record<FeatureName, PlanName> = {
  whatsapp_basic:     "STARTER",
  whatsapp_premium:   "PRO",
  reports_basic:      "FREE",
  reports_advanced:   "PRO",
  campaigns:          "STARTER",
  multi_unit:         "PRO",
};
```

### Classe FeatureGuard

```typescript
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
    currentCount: number
  ): Promise<void> {
    const { plan, status } = await this.getSubscriptionState(tenantId);
    if (!this.isActive(status)) return; // expirado já bloqueia no middleware de auth
    const limit = PLAN_LIMITS[plan][limitType];
    if (limit !== -1 && currentCount >= limit) {
      throw new PlanLimitError(limitType, limit, currentCount);
    }
  }

  private async getSubscriptionState(tenantId: string) {
    // Tenant.plan é cache — leitura rápida sem join na maioria dos casos
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        plan: true,
        subscription: { select: { status: true, trialEndsAt: true } }
      },
    });

    const status = tenant.subscription?.status ?? "EXPIRED";

    // Se trial vencido, trata como EXPIRED
    if (status === "TRIALING" && tenant.subscription?.trialEndsAt) {
      if (tenant.subscription.trialEndsAt < new Date()) {
        return { plan: "FREE" as PlanName, status: "EXPIRED" as const };
      }
    }

    return { plan: tenant.plan, status };
  }

  private isActive(status: string): boolean {
    // PAST_DUE: grace period de 3 dias — acesso mantido enquanto aguarda retentativa de cobrança
    return ["TRIALING", "ACTIVE", "PAST_DUE"].includes(status);
  }
}

export const featureGuard = new FeatureGuard();
```

---

## Erros Tipados

```typescript
// src/shared/errors/plan.errors.ts

import { DomainError } from "./base";
import type { PlanName } from "@prisma/client";

export class PlanFeatureError extends DomainError {
  readonly code = "PLAN_FEATURE_REQUIRED";
  readonly httpStatus = 403;

  constructor(
    public readonly feature: string,
    public readonly requiredPlan: PlanName
  ) {
    super(`Feature "${feature}" requer plano ${requiredPlan} ou superior`);
  }
}

export class PlanLimitError extends DomainError {
  readonly code = "PLAN_LIMIT_EXCEEDED";
  readonly httpStatus = 402;

  constructor(
    public readonly limitType: string,
    public readonly limit: number,
    public readonly current: number
  ) {
    super(`Limite de ${limitType} atingido (${current}/${limit})`);
  }
}
```

---

## BillingService — Ciclo de vida

```typescript
// src/domains/billing/billing.service.ts

export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly events: DomainEventBus
  ) {}

  // Chamado no registro de novo tenant
  async startTrial(tenantId: string): Promise<Subscription> {
    const trialEndsAt = addDays(new Date(), 14);
    const sub = await this.repo.createSubscription({
      tenantId,
      plan: "STARTER",        // trial começa com Starter
      status: "TRIALING",
      trialEndsAt,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndsAt,
    });
    return sub;
  }

  // Chamado pela API admin (ou futuramente pelo webhook do gateway)
  async changePlan(
    tenantId: string,
    newPlan: PlanName,
    newStatus: SubscriptionStatus,
    changedBy: string,
    reason: string
  ): Promise<Subscription> {
    const current = await this.repo.getSubscription(tenantId);

    const updated = await this.repo.updateSubscription(tenantId, {
      plan: newPlan,
      status: newStatus,
      currentPeriodStart: new Date(),
      currentPeriodEnd: addDays(new Date(), 30),
    });

    // Registra histórico
    await this.repo.addHistory({
      subscriptionId: updated.id,
      fromPlan: current?.plan,
      toPlan: newPlan,
      fromStatus: current?.status,
      toStatus: newStatus,
      reason,
      changedBy,
    });

    // Atualiza cache no Tenant
    await this.repo.updateTenantPlanCache(tenantId, newPlan);

    this.events.publish({
      type: "billing.subscription.upgraded",
      payload: { tenantId, fromPlan: current?.plan, toPlan: newPlan }
    });

    return updated;
  }

  // Job diário: expira trials e períodos vencidos
  async runExpireSweep(): Promise<void> {
    const now = new Date();

    // Trials vencidos
    const expiredTrials = await this.repo.findExpiredTrials(now);
    for (const sub of expiredTrials) {
      await this.changePlan(sub.tenantId, "FREE", "EXPIRED", "system", "trial_expired");
      this.events.publish({ type: "billing.trial.expired", payload: { tenantId: sub.tenantId } });
    }

    // Períodos ativos vencidos (para quando houver gateway)
    const expiredActive = await this.repo.findExpiredActive(now);
    for (const sub of expiredActive) {
      await this.changePlan(sub.tenantId, sub.plan, "EXPIRED", "system", "period_expired");
    }
  }
}
```

---

## Job de Expiração (pg-boss)

```typescript
// src/domains/billing/subscriptions.ts

import PgBoss from "pg-boss";
import { billingService } from "./billing.service";

export function registerBillingJobs(boss: PgBoss) {
  // Roda todo dia às 02:00 (horário de Brasília = 05:00 UTC)
  boss.schedule("billing:expire-sweep", "0 5 * * *", {});
  boss.work("billing:expire-sweep", async () => {
    await billingService.runExpireSweep();
  });
}
```

---

## API Routes

### GET /api/billing/status
Retorna o plano atual e features disponíveis para o frontend exibir.

```typescript
// Resposta:
{
  plan: "STARTER",
  status: "TRIALING",
  trialEndsAt: "2026-06-10T00:00:00Z",
  features: {
    whatsapp_basic: true,
    whatsapp_premium: false,
    reports_advanced: false,
    campaigns: true,
    multi_unit: false,
  },
  limits: {
    users: { current: 3, max: 5 },
    appointments_month: { current: 47, max: 300 }
  }
}
```

### PATCH /api/admin/subscriptions/:tenantId
Protegido por secret interno (`Authorization: Bearer ADMIN_SECRET`).

```typescript
// Body:
{ plan: "PRO", status: "ACTIVE", reason: "pagamento_confirmado_manual" }
```

---

## Pontos de Integração nos Domínios Existentes

### WhatsApp (whatsapp.provider.ts)
```typescript
// Antes de enviar qualquer mensagem:
await featureGuard.assertAccess(draft.tenantId, FEATURES.WHATSAPP_BASIC);
```

### Agendamentos (scheduling.service.ts)
```typescript
// Antes de criar agendamento:
const count = await repo.countThisMonth(tenantId);
await featureGuard.assertWithinLimit(tenantId, "appointments_month", count);
```

### Relatórios (reports.service.ts)
```typescript
// Nas queries avançadas (analytics de profissional, período longo, exportação):
await featureGuard.assertAccess(tenantId, FEATURES.REPORTS_ADVANCED);
```

### Usuários/Profissionais (iam.service.ts)
```typescript
// Antes de criar novo usuário:
const count = await iamRepo.countActiveUsers(tenantId);
await featureGuard.assertWithinLimit(tenantId, "users", count);
```

---

## Resposta de Erro no Frontend

Quando a API retorna `402` (`PlanLimitError`) ou `403` (`PlanFeatureError`), o frontend
exibe um `UpgradeModal` com:

- Feature que foi bloqueada e qual plano a libera
- Tabela comparativa de planos (Free / Starter / Pro)
- Botão "Falar com suporte" → link WhatsApp do suporte
- Botão "Ver planos" → `/settings/billing`

```typescript
// Hook global de error handling (TanStack Query):
if (error.code === "PLAN_FEATURE_REQUIRED" || error.code === "PLAN_LIMIT_EXCEEDED") {
  openUpgradeModal({ feature: error.feature, requiredPlan: error.requiredPlan });
}
```

---

## Ciclo de Vida Completo

```
Tenant se registra
      ↓
billing.startTrial() → Subscription(STARTER, TRIALING, 14 dias)
      ↓
Usa o sistema por 14 dias com features do Starter
      ↓ (job diário às 02h)
Trial vencido → Subscription(FREE, EXPIRED)
      ↓ (evento billing.trial.expired)
Email/WhatsApp: "Seu trial expirou. Ative um plano para continuar."
      ↓ (admin confirma pagamento manualmente)
PATCH /api/admin/subscriptions → Subscription(PRO, ACTIVE, +30 dias)
      ↓ (evento billing.subscription.upgraded)
Tenant tem acesso pleno ao Pro imediatamente
```

---

## Checklist de Implementação

- [ ] Migração Prisma: enums PlanName + SubscriptionStatus, models Subscription + SubscriptionHistory, alterar Tenant.plan
- [ ] `src/shared/errors/plan.errors.ts` — PlanFeatureError + PlanLimitError
- [ ] `src/domains/billing/billing.repository.ts`
- [ ] `src/domains/billing/billing.service.ts`
- [ ] `src/domains/billing/feature-guard.ts`
- [ ] `src/domains/billing/subscriptions.ts` — job pg-boss
- [ ] `src/app/api/billing/status/route.ts`
- [ ] `src/app/api/admin/subscriptions/route.ts`
- [ ] Integração: `whatsapp.provider.ts` → assertAccess(WHATSAPP_BASIC)
- [ ] Integração: `scheduling.service.ts` → assertWithinLimit(appointments_month)
- [ ] Integração: `reports.service.ts` → assertAccess(REPORTS_ADVANCED)
- [ ] Integração: `iam.service.ts` → assertWithinLimit(users)
- [ ] Frontend: `UpgradeModal` component
- [ ] Frontend: página `/settings/billing` com tabela de planos
- [ ] startTrial() chamado no onboarding de novo tenant
