# Painel de Administração do Sistema — Plano de Implementação

> **Para agentes:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar task por task. Steps usam checkbox (`- [ ]`) para rastreamento.

**Goal:** Criar painel admin em `/admin/*` com gerenciamento de planos, limites parametrizados e lista de tenants; eliminar todos os hardcodes de limites do código.

**Architecture:** Route group `(admin)` dentro do Next.js app, protegido por middleware que verifica `isSystemAdmin` no `app_metadata` do Supabase. Tabelas `Plan` e `PlanLimitConfig` novas + extensão de `PlanFeatureConfig` com billing features. `PlanLimitsService` substitui `ROLE_LIMITS`, `PLAN_LIMITS` e `PLAN_FEATURES` hardcoded. Três PRs sequenciais: schema+service → hardcodes+backend → frontend.

**Tech Stack:** Next.js 15 App Router, Prisma, Supabase Auth, Zod, TanStack Query, Shadcn UI, Vitest

---

## Mapa de Arquivos

### PR 1 — Infraestrutura
| Arquivo | Responsabilidade |
|---|---|
| `src/shared/permissions/limit-registry.ts` | Catálogo de todos os limites do sistema com defaults por plano |
| `src/domains/billing/plan-limits.service.ts` | Lê PlanLimitConfig do banco; fallback para LIMIT_REGISTRY.defaults |
| `src/domains/billing/plan-limits.service.test.ts` | Testes unitários do PlanLimitsService |
| `scripts/seed-admin-data.ts` | Seed idempotente: Plan × 4, PlanLimitConfig × 24, billing features em PlanFeatureConfig |
| `prisma/schema.prisma` | +`Plan`, +`PlanLimitConfig` |

### PR 2 — Remoção de Hardcodes + Backend Admin
| Arquivo | Responsabilidade |
|---|---|
| `src/domains/billing/feature-guard.ts` | Remove `PLAN_FEATURES`, `PLAN_LIMITS`, `FEATURE_MIN_PLAN`; usa banco e planLimitsService |
| `src/domains/billing/feature-guard.test.ts` | Testes para novos métodos `canAccess` e `assertAccess` |
| `src/domains/billing/types.ts` | Remove `PLAN_LIMITS` e `PlanLimits` duplicados |
| `src/domains/notifications/quota/whatsapp-quota.service.ts` | Usa `planLimitsService.get` em vez de `PLAN_LIMITS` |
| `src/domains/iam/role.service.ts` | Remove `ROLE_LIMITS`; usa `planLimitsService.assertWithinLimit` |
| `src/domains/iam/role.service.test.ts` | Atualiza mock para `planLimitsService` |
| `src/shared/auth/admin-context.ts` | `getAdminContext` verifica `isSystemAdmin` no app_metadata |
| `middleware.ts` | Protege rotas `/admin/*` |
| `src/app/api/admin/plans/route.ts` | GET lista planos |
| `src/app/api/admin/plans/[planName]/route.ts` | PUT metadados do plano |
| `src/app/api/admin/plans/[planName]/features/route.ts` | GET + PUT feature flags |
| `src/app/api/admin/plans/[planName]/limits/route.ts` | GET + PUT limites numéricos |
| `src/app/api/admin/tenants/route.ts` | GET lista tenants com resumo |

### PR 3 — Frontend Admin
| Arquivo | Responsabilidade |
|---|---|
| `src/hooks/admin/use-plans.ts` | usePlans, useUpdatePlan |
| `src/hooks/admin/use-plan-features.ts` | usePlanFeatures, useUpdatePlanFeatures |
| `src/hooks/admin/use-plan-limits.ts` | usePlanLimits, useUpdatePlanLimits |
| `src/hooks/admin/use-admin-tenants.ts` | useAdminTenants |
| `src/app/(admin)/layout.tsx` | AdminShell: sidebar + banner modo admin |
| `src/app/(admin)/page.tsx` | /admin/ visão geral |
| `src/app/(admin)/planos/page.tsx` | /admin/planos lista de planos |
| `src/app/(admin)/planos/[planName]/page.tsx` | /admin/planos/[planName] editor com 3 abas |
| `src/app/(admin)/tenants/page.tsx` | /admin/tenants lista de tenants |

---

## PR 1 — Schema + LIMIT_REGISTRY + PlanLimitsService

Criar branch: `git checkout -b feat/admin-panel-pr1`

---

### Task 1: LIMIT_REGISTRY

**Files:**
- Create: `src/shared/permissions/limit-registry.ts`

- [ ] **Criar `src/shared/permissions/limit-registry.ts`**

```ts
import { PlanName } from '@prisma/client'

export const LIMIT_REGISTRY = {
  max_roles: {
    label: 'Máximo de cargos',
    unit: 'cargos',
    defaults: { FREE: 3, STARTER: 3, PRO: 5, ENTERPRISE: 999 } as Record<PlanName, number>,
  },
  max_users: {
    label: 'Máximo de usuários',
    unit: 'usuários',
    defaults: { FREE: 2, STARTER: 5, PRO: 20, ENTERPRISE: 999 } as Record<PlanName, number>,
  },
  max_units: {
    label: 'Máximo de unidades',
    unit: 'unidades',
    defaults: { FREE: 1, STARTER: 1, PRO: 3, ENTERPRISE: 999 } as Record<PlanName, number>,
  },
  max_appointments_month: {
    label: 'Agendamentos/mês',
    unit: 'agend.',
    defaults: { FREE: 50, STARTER: 300, PRO: 2000, ENTERPRISE: 999999 } as Record<PlanName, number>,
  },
  max_whatsapp_month: {
    label: 'WhatsApp/mês',
    unit: 'msgs',
    defaults: { FREE: 0, STARTER: 500, PRO: 2000, ENTERPRISE: 5000 } as Record<PlanName, number>,
  },
  max_email_month: {
    label: 'E-mails/mês',
    unit: 'e-mails',
    defaults: { FREE: 100, STARTER: 500, PRO: 5000, ENTERPRISE: 999999 } as Record<PlanName, number>,
  },
} as const

export type LimitKey = keyof typeof LIMIT_REGISTRY
```

- [ ] **Commit**

```bash
git add src/shared/permissions/limit-registry.ts
git commit -m "feat(admin): adiciona LIMIT_REGISTRY como catálogo de limites por plano"
```

---

### Task 2: Prisma schema — tabelas Plan e PlanLimitConfig

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Adicionar model `Plan` após o enum `PlanName`** (linha ~77)

```prisma
model Plan {
  id           String   @id @default(cuid())
  name         PlanName @unique
  displayName  String
  price        Decimal  @default(0) @db.Decimal(10, 2)
  description  String?
  isActive     Boolean  @default(true)
  displayOrder Int      @default(0)
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Adicionar model `PlanLimitConfig` após `Plan`**

```prisma
model PlanLimitConfig {
  id        String   @id @default(cuid())
  plan      PlanName
  limitKey  String
  value     Int
  updatedAt DateTime @updatedAt

  @@unique([plan, limitKey])
  @@index([plan])
}
```

- [ ] **Rodar migration**

```bash
npx prisma migrate dev --name add_plan_and_plan_limit_config
```

Esperado: migration criada sem erros, PrismaClient regenerado com `prisma.plan` e `prisma.planLimitConfig`.

- [ ] **Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(admin): adiciona tabelas Plan e PlanLimitConfig ao schema"
```

---

### Task 3: Seed de dados iniciais

**Files:**
- Create: `scripts/seed-admin-data.ts`

- [ ] **Criar `scripts/seed-admin-data.ts`**

```ts
import { PrismaClient, PlanName } from '@prisma/client'
import { LIMIT_REGISTRY } from '../src/shared/permissions/limit-registry'

const prisma = new PrismaClient()

const PLANS = [
  { name: PlanName.FREE,       displayName: 'Free',       price: 0,      description: 'Grátis para sempre',             isActive: true, displayOrder: 0 },
  { name: PlanName.STARTER,    displayName: 'Starter',    price: 49.90,  description: 'Para negócios em crescimento',   isActive: true, displayOrder: 1 },
  { name: PlanName.PRO,        displayName: 'Pro',        price: 149.90, description: 'Para negócios consolidados',     isActive: true, displayOrder: 2 },
  { name: PlanName.ENTERPRISE, displayName: 'Enterprise', price: 0,      description: 'Para grandes operações',         isActive: true, displayOrder: 3 },
]

// Billing features: sectionKey → enabled por plano
const BILLING_FEATURES: Array<{ sectionKey: string; plans: Partial<Record<PlanName, boolean>> }> = [
  { sectionKey: 'reports_basic',     plans: { FREE: true,  STARTER: true,  PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'whatsapp_basic',    plans: { FREE: false, STARTER: true,  PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'campaigns',         plans: { FREE: false, STARTER: true,  PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'reports_advanced',  plans: { FREE: false, STARTER: false, PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'whatsapp_premium',  plans: { FREE: false, STARTER: false, PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'multi_unit',        plans: { FREE: false, STARTER: false, PRO: true,  ENTERPRISE: true  } },
]

async function main() {
  // 1. Seed tabela Plan
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: { displayName: plan.displayName, price: plan.price, description: plan.description, displayOrder: plan.displayOrder },
      create: plan,
    })
  }
  console.log('Plan: 4 planos inseridos/atualizados')

  // 2. Seed PlanLimitConfig
  const limitKeys = Object.keys(LIMIT_REGISTRY) as Array<keyof typeof LIMIT_REGISTRY>
  const planNames = [PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE]
  for (const planName of planNames) {
    for (const limitKey of limitKeys) {
      const value = LIMIT_REGISTRY[limitKey].defaults[planName]
      await prisma.planLimitConfig.upsert({
        where: { plan_limitKey: { plan: planName, limitKey } },
        update: {},
        create: { plan: planName, limitKey, value },
      })
    }
  }
  console.log('PlanLimitConfig: 24 registros inseridos/atualizados')

  // 3. Seed billing features em PlanFeatureConfig
  for (const { sectionKey, plans } of BILLING_FEATURES) {
    for (const planName of planNames) {
      const enabled = plans[planName] ?? false
      await prisma.planFeatureConfig.upsert({
        where: { plan_sectionKey: { plan: planName, sectionKey } },
        update: { enabled },
        create: { plan: planName, sectionKey, enabled },
      })
    }
  }
  console.log('PlanFeatureConfig billing features: 24 registros inseridos/atualizados')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Adicionar script ao `package.json`**

Em `scripts`, adicionar:
```json
"seed:admin": "npx ts-node --project tsconfig.json scripts/seed-admin-data.ts"
```

- [ ] **Rodar seed**

```bash
npm run seed:admin
```

Esperado: `Plan: 4 planos inseridos/atualizados`, `PlanLimitConfig: 24 registros inseridos/atualizados`, `PlanFeatureConfig billing features: 24 registros inseridos/atualizados`

- [ ] **Commit**

```bash
git add scripts/seed-admin-data.ts package.json
git commit -m "feat(admin): seed de Plan, PlanLimitConfig e billing features"
```

---

### Task 4: PlanLimitsService (TDD)

**Files:**
- Create: `src/domains/billing/plan-limits.service.test.ts`
- Create: `src/domains/billing/plan-limits.service.ts`

- [ ] **Criar `src/domains/billing/plan-limits.service.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { PlanLimitsService } from './plan-limits.service'
import { PlanLimitError } from '@/shared/errors'
import { LIMIT_REGISTRY } from '@/shared/permissions/limit-registry'

const TENANT_ID = 'tenant-abc'

const activeTenant = (plan: PlanName) => ({
  plan,
  subscription: { status: SubscriptionStatus.ACTIVE, trialEndsAt: null },
})

describe('PlanLimitsService', () => {
  let service: PlanLimitsService

  beforeEach(() => {
    service = new PlanLimitsService()
    vi.clearAllMocks()
  })

  describe('get', () => {
    it('retorna valor do PlanLimitConfig quando existe no banco', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.PRO) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 10 } as any)

      const result = await service.get(TENANT_ID, 'max_roles')
      expect(result).toBe(10)
      expect(prismaMock.planLimitConfig.findFirst).toHaveBeenCalledWith({
        where: { plan: PlanName.PRO, limitKey: 'max_roles' },
      })
    })

    it('retorna fallback do LIMIT_REGISTRY quando registro não existe no banco', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.FREE) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue(null)

      const result = await service.get(TENANT_ID, 'max_roles')
      expect(result).toBe(LIMIT_REGISTRY.max_roles.defaults.FREE)
    })

    it('usa plano FREE quando subscription está expirada', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue({
        plan: PlanName.PRO,
        subscription: { status: SubscriptionStatus.EXPIRED, trialEndsAt: null },
      } as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue(null)

      await service.get(TENANT_ID, 'max_roles')
      expect(prismaMock.planLimitConfig.findFirst).toHaveBeenCalledWith({
        where: { plan: PlanName.FREE, limitKey: 'max_roles' },
      })
    })

    it('usa plano FREE quando trial está expirado', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue({
        plan: PlanName.STARTER,
        subscription: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: new Date('2020-01-01'),
        },
      } as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue(null)

      await service.get(TENANT_ID, 'max_users')
      expect(prismaMock.planLimitConfig.findFirst).toHaveBeenCalledWith({
        where: { plan: PlanName.FREE, limitKey: 'max_users' },
      })
    })

    it('usa o plano real quando trial ainda é válido', async () => {
      const futureDate = new Date(Date.now() + 86400000)
      prismaMock.tenant.findFirst.mockResolvedValue({
        plan: PlanName.STARTER,
        subscription: { status: SubscriptionStatus.TRIALING, trialEndsAt: futureDate },
      } as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue(null)

      await service.get(TENANT_ID, 'max_users')
      expect(prismaMock.planLimitConfig.findFirst).toHaveBeenCalledWith({
        where: { plan: PlanName.STARTER, limitKey: 'max_users' },
      })
    })
  })

  describe('assertWithinLimit', () => {
    it('não lança erro quando contagem está abaixo do limite', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.PRO) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 5 } as any)

      await expect(service.assertWithinLimit(TENANT_ID, 'max_roles', 4)).resolves.not.toThrow()
    })

    it('lança PlanLimitError quando contagem atinge o limite', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.FREE) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 3 } as any)

      await expect(service.assertWithinLimit(TENANT_ID, 'max_roles', 3)).rejects.toThrow(PlanLimitError)
    })

    it('não lança erro quando valor é 999999 (ilimitado)', async () => {
      prismaMock.tenant.findFirst.mockResolvedValue(activeTenant(PlanName.ENTERPRISE) as any)
      prismaMock.planLimitConfig.findFirst.mockResolvedValue({ value: 999999 } as any)

      await expect(service.assertWithinLimit(TENANT_ID, 'max_roles', 9999)).resolves.not.toThrow()
    })
  })
})
```

- [ ] **Rodar testes — verificar que FALHAM**

```bash
npx vitest run src/domains/billing/plan-limits.service.test.ts
```

Esperado: `FAIL — Cannot find module './plan-limits.service'`

- [ ] **Criar `src/domains/billing/plan-limits.service.ts`**

```ts
import { PlanName } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { PlanLimitError } from '@/shared/errors'
import { LIMIT_REGISTRY, type LimitKey } from '@/shared/permissions/limit-registry'

const ACTIVE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE']

export class PlanLimitsService {
  async get(tenantId: string, limitKey: LimitKey): Promise<number> {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        plan: true,
        subscription: { select: { status: true, trialEndsAt: true } },
      },
    })
    if (!tenant) throw new Error(`Tenant ${tenantId} não encontrado.`)

    const effectivePlan = this.resolveEffectivePlan(tenant)

    const config = await prisma.planLimitConfig.findFirst({
      where: { plan: effectivePlan, limitKey },
    })

    return config?.value ?? LIMIT_REGISTRY[limitKey].defaults[effectivePlan]
  }

  async assertWithinLimit(tenantId: string, limitKey: LimitKey, currentCount: number): Promise<void> {
    const limit = await this.get(tenantId, limitKey)
    if (limit !== 999999 && currentCount >= limit) {
      throw new PlanLimitError(limitKey, limit, currentCount)
    }
  }

  private resolveEffectivePlan(tenant: {
    plan: PlanName
    subscription: { status: string; trialEndsAt: Date | null } | null
  }): PlanName {
    const status = tenant.subscription?.status
    if (!status || !ACTIVE_STATUSES.includes(status)) return PlanName.FREE
    if (status === 'TRIALING' && tenant.subscription?.trialEndsAt) {
      if (tenant.subscription.trialEndsAt < new Date()) return PlanName.FREE
    }
    return tenant.plan
  }
}

export const planLimitsService = new PlanLimitsService()
```

- [ ] **Rodar testes — verificar que PASSAM**

```bash
npx vitest run src/domains/billing/plan-limits.service.test.ts
```

Esperado: `PASS — 8 tests passed`

- [ ] **Commit**

```bash
git add src/domains/billing/plan-limits.service.ts src/domains/billing/plan-limits.service.test.ts
git commit -m "feat(admin): adiciona PlanLimitsService com fallback para LIMIT_REGISTRY"
```

---

### Task 5: Abrir PR 1

- [ ] **Push e abrir PR**

```bash
git push origin HEAD
gh pr create --title "feat(admin): schema Plan + PlanLimitConfig + LIMIT_REGISTRY + PlanLimitsService [PR 1/3]" \
  --body "$(cat <<'EOF'
## Resumo
- Tabelas `Plan` e `PlanLimitConfig` adicionadas ao schema Prisma
- `LIMIT_REGISTRY` como catálogo de todos os limites com defaults por plano
- `PlanLimitsService` lê limites do banco com fallback para defaults
- Seed de 4 planos, 24 limites e 24 billing features em PlanFeatureConfig

## Como testar
- Rodar `npm run seed:admin` e verificar registros no banco
- `npx vitest run src/domains/billing/plan-limits.service.test.ts` → 8 testes passando
EOF
)"
```

- [ ] **Mergear PR 1 antes de iniciar PR 2**

---

## PR 2 — Remoção de Hardcodes + Backend Admin

Criar branch: `git checkout -b feat/admin-panel-pr2`

---

### Task 6: Refatorar feature-guard.ts

**Files:**
- Modify: `src/domains/billing/feature-guard.ts`
- Create: `src/domains/billing/feature-guard.test.ts`

- [ ] **Criar `src/domains/billing/feature-guard.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { FeatureGuard } from './feature-guard'
import { PlanFeatureError, PlanLimitError } from '@/shared/errors'

vi.mock('@/domains/billing/plan-limits.service', () => ({
  planLimitsService: { assertWithinLimit: vi.fn() },
}))

import { planLimitsService } from '@/domains/billing/plan-limits.service'

const TENANT_ID = 'tenant-abc'

describe('FeatureGuard', () => {
  let guard: FeatureGuard

  beforeEach(() => {
    guard = new FeatureGuard()
    vi.clearAllMocks()
    prismaMock.tenant.findUnique.mockResolvedValue({
      plan: PlanName.STARTER,
      subscription: { status: SubscriptionStatus.ACTIVE, trialEndsAt: null },
    } as any)
  })

  describe('canAccess', () => {
    it('retorna true quando feature está habilitada no plano', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: true } as any)
      expect(await guard.canAccess(TENANT_ID, 'whatsapp_basic')).toBe(true)
    })

    it('retorna false quando feature está desabilitada no plano', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: false } as any)
      expect(await guard.canAccess(TENANT_ID, 'reports_advanced')).toBe(false)
    })

    it('retorna false quando registro não existe no banco', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue(null)
      expect(await guard.canAccess(TENANT_ID, 'multi_unit')).toBe(false)
    })

    it('retorna false quando subscription está inativa', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        plan: PlanName.PRO,
        subscription: { status: SubscriptionStatus.CANCELLED, trialEndsAt: null },
      } as any)
      expect(await guard.canAccess(TENANT_ID, 'whatsapp_basic')).toBe(false)
    })
  })

  describe('assertAccess', () => {
    it('não lança erro quando acesso é permitido', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: true } as any)
      await expect(guard.assertAccess(TENANT_ID, 'whatsapp_basic')).resolves.not.toThrow()
    })

    it('lança PlanFeatureError quando acesso é negado', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: false } as any)
      prismaMock.planFeatureConfig.findMany.mockResolvedValue([
        { plan: PlanName.PRO } as any,
      ])
      await expect(guard.assertAccess(TENANT_ID, 'reports_advanced')).rejects.toThrow(PlanFeatureError)
    })
  })

  describe('assertWithinLimit', () => {
    it('delega para planLimitsService com mapeamento de chave correto', async () => {
      vi.mocked(planLimitsService.assertWithinLimit).mockResolvedValue(undefined)
      await guard.assertWithinLimit(TENANT_ID, 'users', 3)
      expect(planLimitsService.assertWithinLimit).toHaveBeenCalledWith(TENANT_ID, 'max_users', 3)
    })

    it('delega appointments_month para max_appointments_month', async () => {
      vi.mocked(planLimitsService.assertWithinLimit).mockResolvedValue(undefined)
      await guard.assertWithinLimit(TENANT_ID, 'appointments_month', 100)
      expect(planLimitsService.assertWithinLimit).toHaveBeenCalledWith(TENANT_ID, 'max_appointments_month', 100)
    })

    it('propaga PlanLimitError do planLimitsService', async () => {
      vi.mocked(planLimitsService.assertWithinLimit).mockRejectedValue(
        new PlanLimitError('max_users', 5, 5)
      )
      await expect(guard.assertWithinLimit(TENANT_ID, 'users', 5)).rejects.toThrow(PlanLimitError)
    })
  })
})
```

- [ ] **Rodar testes — verificar que FALHAM**

```bash
npx vitest run src/domains/billing/feature-guard.test.ts
```

Esperado: `FAIL — planFeatureConfig não mockado / módulo antigo não tem os novos comportamentos`

- [ ] **Substituir `src/domains/billing/feature-guard.ts`**

```ts
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { PlanFeatureError, NotFoundError } from '@/shared/errors'
import { planLimitsService } from '@/domains/billing/plan-limits.service'
import type { LimitKey } from '@/shared/permissions/limit-registry'

export const FEATURES = {
  WHATSAPP_BASIC:   'whatsapp_basic',
  WHATSAPP_PREMIUM: 'whatsapp_premium',
  REPORTS_BASIC:    'reports_basic',
  REPORTS_ADVANCED: 'reports_advanced',
  CAMPAIGNS:        'campaigns',
  MULTI_UNIT:       'multi_unit',
} as const

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES]

const LIMIT_TYPE_MAP: Record<string, LimitKey> = {
  users:               'max_users',
  appointments_month:  'max_appointments_month',
}

const PLAN_ORDER: PlanName[] = [PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE]

export class FeatureGuard {
  async canAccess(tenantId: string, feature: FeatureName): Promise<boolean> {
    const { plan, status } = await this.getSubscriptionState(tenantId)
    if (!this.isActive(status)) return false
    const config = await prisma.planFeatureConfig.findFirst({
      where: { plan, sectionKey: feature },
    })
    return config?.enabled ?? false
  }

  async assertAccess(tenantId: string, feature: FeatureName): Promise<void> {
    const has = await this.canAccess(tenantId, feature)
    if (!has) {
      const minPlan = await this.findMinPlanForFeature(feature)
      throw new PlanFeatureError(feature, minPlan ?? PlanName.ENTERPRISE)
    }
  }

  async assertWithinLimit(
    tenantId: string,
    limitType: 'users' | 'appointments_month',
    currentCount: number,
  ): Promise<void> {
    const limitKey = LIMIT_TYPE_MAP[limitType]
    if (!limitKey) throw new Error(`Tipo de limite desconhecido: ${limitType}`)
    await planLimitsService.assertWithinLimit(tenantId, limitKey, currentCount)
  }

  async getSubscriptionState(tenantId: string): Promise<{ plan: PlanName; status: SubscriptionStatus }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        subscription: { select: { status: true, trialEndsAt: true } },
      },
    })
    if (!tenant) throw new NotFoundError('Tenant')

    const status = tenant.subscription?.status ?? SubscriptionStatus.EXPIRED

    if (status === SubscriptionStatus.TRIALING && tenant.subscription?.trialEndsAt) {
      if (tenant.subscription.trialEndsAt < new Date()) {
        return { plan: PlanName.FREE, status: SubscriptionStatus.EXPIRED }
      }
    }

    return { plan: tenant.plan, status }
  }

  private async findMinPlanForFeature(feature: FeatureName): Promise<PlanName | null> {
    const configs = await prisma.planFeatureConfig.findMany({
      where: { sectionKey: feature, enabled: true },
      select: { plan: true },
    })
    const enabledPlans = new Set(configs.map((c) => c.plan))
    return PLAN_ORDER.find((p) => enabledPlans.has(p)) ?? null
  }

  private isActive(status: SubscriptionStatus): boolean {
    return [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE].includes(status)
  }
}

export const featureGuard = new FeatureGuard()
```

- [ ] **Rodar testes — verificar que PASSAM**

```bash
npx vitest run src/domains/billing/feature-guard.test.ts
```

Esperado: `PASS — 8 tests passed`

- [ ] **Rodar todos os testes para checar regressões**

```bash
npx vitest run
```

Esperado: todos os testes existentes passando (os que mockavam `featureGuard` diretamente não são afetados).

- [ ] **Commit**

```bash
git add src/domains/billing/feature-guard.ts src/domains/billing/feature-guard.test.ts
git commit -m "feat(admin): feature-guard usa banco para canAccess e planLimitsService para limites"
```

---

### Task 7: Remover PLAN_LIMITS de billing/types.ts e refatorar WhatsAppQuotaService

**Files:**
- Modify: `src/domains/billing/types.ts`
- Modify: `src/domains/notifications/quota/whatsapp-quota.service.ts`

- [ ] **Atualizar `src/domains/billing/types.ts`** — remover PLAN_LIMITS e PlanLimits

Substituir o conteúdo completo do arquivo por:

```ts
import { z } from 'zod'
import { PlanName, SubscriptionStatus } from '@prisma/client'

export { PlanName, SubscriptionStatus }

export const updateSubscriptionSchema = z.object({
  plan: z.nativeEnum(PlanName),
  status: z.nativeEnum(SubscriptionStatus),
  reason: z.string().min(1),
})

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>
```

- [ ] **Atualizar `src/domains/notifications/quota/whatsapp-quota.service.ts`**

Substituir o conteúdo completo por:

```ts
import { prisma } from '@/shared/database/prisma'
import { planLimitsService } from '@/domains/billing/plan-limits.service'

export class WhatsAppQuotaService {
  async checkAndIncrement(tenantId: string): Promise<boolean> {
    const limit = await planLimitsService.get(tenantId, 'max_whatsapp_month')

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const record = await prisma.whatsAppMonthlyUsage.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      create: { tenantId, year, month, count: 1 },
      update: { count: { increment: 1 } },
    })

    if (limit !== 999999 && record.count > limit) {
      await prisma.whatsAppMonthlyUsage.update({
        where: { tenantId_year_month: { tenantId, year, month } },
        data: { count: { decrement: 1 } },
      })
      return false
    }

    return true
  }

  async decrement(tenantId: string): Promise<void> {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    await prisma.whatsAppMonthlyUsage.updateMany({
      where: { tenantId, year, month, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    })
  }

  async getUsage(tenantId: string): Promise<{ used: number; limit: number; resetDate: string }> {
    const limit = await planLimitsService.get(tenantId, 'max_whatsapp_month')

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const record = await prisma.whatsAppMonthlyUsage.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    })

    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const resetDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    return { used: record?.count ?? 0, limit, resetDate }
  }
}

export const whatsAppQuotaService = new WhatsAppQuotaService()
```

- [ ] **Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando. Os testes de `whatsapp-quota.service.test.ts` que mockavam `featureGuard.getSubscriptionState` e `PLAN_LIMITS` precisarão ser atualizados se falharem — substituir mock de `PLAN_LIMITS` por mock de `planLimitsService.get`.

- [ ] **Commit**

```bash
git add src/domains/billing/types.ts src/domains/notifications/quota/whatsapp-quota.service.ts
git commit -m "feat(admin): remove PLAN_LIMITS hardcoded; WhatsAppQuotaService usa planLimitsService"
```

---

### Task 8: Refatorar role.service.ts

**Files:**
- Modify: `src/domains/iam/role.service.ts`
- Modify: `src/domains/iam/role.service.test.ts`

- [ ] **Atualizar `src/domains/iam/role.service.ts`** — remover ROLE_LIMITS

Localizar e remover:
```ts
const ROLE_LIMITS: Record<PlanName, number> = {
  FREE:       3,
  STARTER:    3,
  PRO:        5,
  ENTERPRISE: Infinity,
}
```

Adicionar import no topo:
```ts
import { planLimitsService } from '@/domains/billing/plan-limits.service'
```

Em `createRole`, substituir o bloco de checagem de limite:

Remover:
```ts
const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { plan: true } })
if (!tenant) throw new NotFoundError('Tenant')

const count = await this.repo.countByTenant(tenantId)
const limit = ROLE_LIMITS[tenant.plan]
if (count >= limit) {
  throw new ForbiddenError(
    `Limite de roles atingido para o plano ${tenant.plan} (máximo ${limit === Infinity ? '∞' : limit}).`
  )
}
```

Substituir por:
```ts
const count = await this.repo.countByTenant(tenantId)
await planLimitsService.assertWithinLimit(tenantId, 'max_roles', count)
```

Remover import de `PlanName` e `NotFoundError` se não forem mais usados em outros lugares do arquivo.

- [ ] **Atualizar `src/domains/iam/role.service.test.ts`** — mockar planLimitsService

Adicionar no topo do arquivo (após os imports existentes):
```ts
vi.mock('@/domains/billing/plan-limits.service', () => ({
  planLimitsService: { assertWithinLimit: vi.fn() },
}))

import { planLimitsService } from '@/domains/billing/plan-limits.service'
```

Substituir o teste que verificava o limite de plano:

Remover:
```ts
it('lança PlanLimitError quando FREE já tem 3 cargos', async () => {
  vi.mocked(repo.countByTenant).mockResolvedValue(3)
  await expect(
    service.createRole(TENANT_ID, { name: 'Novo', permissions: {} })
  ).rejects.toThrow('Limite de roles atingido')
})
```

Substituir por:
```ts
it('lança PlanLimitError quando planLimitsService rejeita', async () => {
  vi.mocked(repo.countByTenant).mockResolvedValue(3)
  vi.mocked(planLimitsService.assertWithinLimit).mockRejectedValue(
    new PlanLimitError('max_roles', 3, 3)
  )
  await expect(
    service.createRole(TENANT_ID, { name: 'Novo', permissions: {} })
  ).rejects.toThrow(PlanLimitError)
})
```

Nos outros testes de `createRole` que esperam sucesso, adicionar mock para que `assertWithinLimit` resolva:
```ts
vi.mocked(planLimitsService.assertWithinLimit).mockResolvedValue(undefined)
```

- [ ] **Rodar testes**

```bash
npx vitest run src/domains/iam/role.service.test.ts
```

Esperado: todos os testes passando.

- [ ] **Commit**

```bash
git add src/domains/iam/role.service.ts src/domains/iam/role.service.test.ts
git commit -m "feat(admin): role.service usa planLimitsService; remove ROLE_LIMITS hardcoded"
```

---

### Task 9: getAdminContext + proteção de rotas /admin/*

**Files:**
- Create: `src/shared/auth/admin-context.ts`
- Modify: `middleware.ts`

- [ ] **Criar `src/shared/auth/admin-context.ts`**

```ts
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { ForbiddenError } from '@/shared/errors'
import { getSessionContext } from '@/shared/auth/session'
import type { SessionContext } from '@/shared/types/auth'

export async function getAdminContext(request: Request): Promise<SessionContext> {
  const session = await getSessionContext(request)
  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(session.userId)
  if (!user?.app_metadata?.isSystemAdmin) {
    throw new ForbiddenError('Acesso restrito a administradores do sistema.')
  }
  return session
}
```

> **Nota:** `supabaseAdmin` é o cliente com `service_role_key`. Verificar o path correto do import no projeto — tipicamente `@/integrations/supabase/admin` ou `@/shared/database/supabase-admin`.

- [ ] **Localizar o import correto do supabaseAdmin**

```bash
grep -r "supabaseAdmin\|createClient.*service_role" src/ --include="*.ts" -l
```

Ajustar o import em `admin-context.ts` para o path encontrado.

- [ ] **Atualizar `middleware.ts`** — adicionar proteção de `/admin/*`

Após a linha `const isOnboarding = pathname === '/onboarding'`, adicionar:

```ts
const isAdminRoute = pathname.startsWith('/admin')
```

Após o bloco `let user = null; try { ... }`, adicionar verificação antes do redirect para login:

```ts
// Proteção de rotas admin
if (isAdminRoute) {
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (!user.app_metadata?.isSystemAdmin) {
    return NextResponse.redirect(new URL('/agenda', request.url))
  }
  return supabaseResponse
}
```

- [ ] **Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Commit**

```bash
git add src/shared/auth/admin-context.ts middleware.ts
git commit -m "feat(admin): adiciona getAdminContext e proteção de rotas /admin/* no middleware"
```

---

### Task 10: API Routes admin

**Files:**
- Create: `src/app/api/admin/plans/route.ts`
- Create: `src/app/api/admin/plans/[planName]/route.ts`
- Create: `src/app/api/admin/plans/[planName]/features/route.ts`
- Create: `src/app/api/admin/plans/[planName]/limits/route.ts`
- Create: `src/app/api/admin/tenants/route.ts`

- [ ] **Criar `src/app/api/admin/plans/route.ts`**

```ts
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const plans = await prisma.plan.findMany({ orderBy: { displayOrder: 'asc' } })
    return Response.json(plans)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Criar `src/app/api/admin/plans/[planName]/route.ts`**

```ts
import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type Params = { params: Promise<{ planName: string }> }

const updatePlanSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  price:       z.number().min(0).optional(),
  description: z.string().max(200).nullable().optional(),
  isActive:    z.boolean().optional(),
})

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { planName } = await params
    const input = await validateInput(request, updatePlanSchema)
    const plan = await prisma.plan.update({
      where: { name: planName as any },
      data: input,
    })
    return Response.json(plan)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Criar `src/app/api/admin/plans/[planName]/features/route.ts`**

```ts
import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type Params = { params: Promise<{ planName: string }> }

const updateFeaturesSchema = z.object({
  features: z.array(z.object({
    sectionKey: z.string().min(1),
    enabled:    z.boolean(),
  })),
})

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { planName } = await params
    const features = await prisma.planFeatureConfig.findMany({
      where: { plan: planName as any },
      orderBy: { sectionKey: 'asc' },
    })
    return Response.json(features)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { planName } = await params
    const { features } = await validateInput(request, updateFeaturesSchema)
    await Promise.all(
      features.map(({ sectionKey, enabled }) =>
        prisma.planFeatureConfig.upsert({
          where: { plan_sectionKey: { plan: planName as any, sectionKey } },
          update: { enabled },
          create: { plan: planName as any, sectionKey, enabled },
        })
      )
    )
    const updated = await prisma.planFeatureConfig.findMany({
      where: { plan: planName as any },
      orderBy: { sectionKey: 'asc' },
    })
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Criar `src/app/api/admin/plans/[planName]/limits/route.ts`**

```ts
import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type Params = { params: Promise<{ planName: string }> }

const updateLimitsSchema = z.object({
  limits: z.array(z.object({
    limitKey: z.string().min(1),
    value:    z.number().int().min(0),
  })),
})

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { planName } = await params
    const limits = await prisma.planLimitConfig.findMany({
      where: { plan: planName as any },
      orderBy: { limitKey: 'asc' },
    })
    return Response.json(limits)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const { planName } = await params
    const { limits } = await validateInput(request, updateLimitsSchema)
    await Promise.all(
      limits.map(({ limitKey, value }) =>
        prisma.planLimitConfig.upsert({
          where: { plan_limitKey: { plan: planName as any, limitKey } },
          update: { value },
          create: { plan: planName as any, limitKey, value },
        })
      )
    )
    const updated = await prisma.planLimitConfig.findMany({
      where: { plan: planName as any },
      orderBy: { limitKey: 'asc' },
    })
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Criar `src/app/api/admin/tenants/route.ts`**

```ts
import { prisma } from '@/shared/database/prisma'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json(tenants)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Commit**

```bash
git add src/app/api/admin/ src/shared/auth/admin-context.ts
git commit -m "feat(admin): API Routes admin — planos, features, limites e tenants"
```

---

### Task 11: Abrir PR 2

- [ ] **Push e abrir PR**

```bash
git push origin HEAD
gh pr create --title "feat(admin): remove hardcodes + backend admin [PR 2/3]" \
  --body "$(cat <<'EOF'
## Resumo
- feature-guard.ts: canAccess e assertAccess consultam PlanFeatureConfig no banco
- feature-guard.ts: assertWithinLimit delega para planLimitsService
- PLAN_LIMITS removido de billing/types.ts (duplicata eliminada)
- WhatsAppQuotaService usa planLimitsService para limite de mensagens
- role.service.ts usa planLimitsService; ROLE_LIMITS removido
- getAdminContext verifica isSystemAdmin no app_metadata
- middleware.ts protege /admin/* — redireciona para /agenda se não for admin
- API Routes: GET/PUT /api/admin/plans, features, limits; GET /api/admin/tenants

## Como testar
- npx vitest run → todos os testes passando
- npx tsc --noEmit → zero erros
EOF
)"
```

- [ ] **Mergear PR 2 antes de iniciar PR 3**

---

## PR 3 — Frontend Admin

Criar branch: `git checkout -b feat/admin-panel-pr3`

---

### Task 12: Hooks admin

**Files:**
- Create: `src/hooks/admin/use-plans.ts`
- Create: `src/hooks/admin/use-plan-features.ts`
- Create: `src/hooks/admin/use-plan-limits.ts`
- Create: `src/hooks/admin/use-admin-tenants.ts`

- [ ] **Criar `src/hooks/admin/use-plans.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type AdminPlan = {
  id: string
  name: string
  displayName: string
  price: number
  description: string | null
  isActive: boolean
  displayOrder: number
}

type UpdatePlanInput = {
  displayName?: string
  price?: number
  description?: string | null
  isActive?: boolean
}

async function fetchPlans(): Promise<AdminPlan[]> {
  const res = await fetch('/api/admin/plans')
  if (!res.ok) throw new Error('Falha ao carregar planos')
  return res.json()
}

async function updatePlan({ name, ...input }: UpdatePlanInput & { name: string }): Promise<AdminPlan> {
  const res = await fetch(`/api/admin/plans/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar plano')
  }
  return res.json()
}

export function usePlans() {
  return useQuery({ queryKey: ['admin', 'plans'], queryFn: fetchPlans, staleTime: 30_000 })
}

export function useUpdatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updatePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  })
}
```

- [ ] **Criar `src/hooks/admin/use-plan-features.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type PlanFeature = {
  id: string
  plan: string
  sectionKey: string
  enabled: boolean
}

async function fetchPlanFeatures(planName: string): Promise<PlanFeature[]> {
  const res = await fetch(`/api/admin/plans/${planName}/features`)
  if (!res.ok) throw new Error('Falha ao carregar features')
  return res.json()
}

async function updatePlanFeatures({
  planName,
  features,
}: {
  planName: string
  features: Array<{ sectionKey: string; enabled: boolean }>
}): Promise<PlanFeature[]> {
  const res = await fetch(`/api/admin/plans/${planName}/features`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao salvar features')
  }
  return res.json()
}

export function usePlanFeatures(planName: string) {
  return useQuery({
    queryKey: ['admin', 'plans', planName, 'features'],
    queryFn: () => fetchPlanFeatures(planName),
    enabled: !!planName,
    staleTime: 30_000,
  })
}

export function useUpdatePlanFeatures() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updatePlanFeatures,
    onSuccess: (_, { planName }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'plans', planName, 'features'] }),
  })
}
```

- [ ] **Criar `src/hooks/admin/use-plan-limits.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type PlanLimit = {
  id: string
  plan: string
  limitKey: string
  value: number
}

async function fetchPlanLimits(planName: string): Promise<PlanLimit[]> {
  const res = await fetch(`/api/admin/plans/${planName}/limits`)
  if (!res.ok) throw new Error('Falha ao carregar limites')
  return res.json()
}

async function updatePlanLimits({
  planName,
  limits,
}: {
  planName: string
  limits: Array<{ limitKey: string; value: number }>
}): Promise<PlanLimit[]> {
  const res = await fetch(`/api/admin/plans/${planName}/limits`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limits }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao salvar limites')
  }
  return res.json()
}

export function usePlanLimits(planName: string) {
  return useQuery({
    queryKey: ['admin', 'plans', planName, 'limits'],
    queryFn: () => fetchPlanLimits(planName),
    enabled: !!planName,
    staleTime: 30_000,
  })
}

export function useUpdatePlanLimits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updatePlanLimits,
    onSuccess: (_, { planName }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'plans', planName, 'limits'] }),
  })
}
```

- [ ] **Criar `src/hooks/admin/use-admin-tenants.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

export type AdminTenant = {
  id: string
  name: string
  plan: string
  createdAt: string
  _count: { users: number }
}

async function fetchAdminTenants(): Promise<AdminTenant[]> {
  const res = await fetch('/api/admin/tenants')
  if (!res.ok) throw new Error('Falha ao carregar tenants')
  return res.json()
}

export function useAdminTenants() {
  return useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: fetchAdminTenants,
    staleTime: 60_000,
  })
}
```

- [ ] **Commit**

```bash
git add src/hooks/admin/
git commit -m "feat(admin): adiciona hooks admin (plans, features, limits, tenants)"
```

---

### Task 13: AdminShell — layout e navegação

**Files:**
- Create: `src/app/(admin)/layout.tsx`

- [ ] **Criar `src/app/(admin)/layout.tsx`**

```tsx
import Link from 'next/link'
import { LayoutDashboard, CreditCard, Building2, ArrowLeft } from 'lucide-react'

const NAV = [
  { href: '/admin',         label: 'Visão Geral',  icon: LayoutDashboard },
  { href: '/admin/planos',  label: 'Planos',       icon: CreditCard },
  { href: '/admin/tenants', label: 'Tenants',      icon: Building2 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Banner de modo admin */}
      <div className="bg-red-600 px-4 py-1.5 text-center text-xs font-medium text-white">
        Modo Administrador — você está gerenciando o sistema
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-0 h-screen w-52 shrink-0 border-r border-slate-200 bg-white p-4">
          <p className="mb-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Admin
          </p>
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto pt-6">
            <Link
              href="/agenda"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-700"
            >
              <ArrowLeft className="size-3.5" />
              Voltar ao meu negócio
            </Link>
          </div>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/(admin)/layout.tsx
git commit -m "feat(admin): AdminShell com sidebar, banner de modo admin e link de retorno"
```

---

### Task 14: Página overview /admin/

**Files:**
- Create: `src/app/(admin)/page.tsx`

- [ ] **Criar `src/app/(admin)/page.tsx`**

```tsx
import { prisma } from '@/shared/database/prisma'
import { PlanName } from '@prisma/client'

const PLAN_LABELS: Record<PlanName, string> = {
  FREE: 'Free', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise',
}
const PLAN_COLORS: Record<PlanName, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-violet-100 text-violet-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

export default async function AdminOverviewPage() {
  const [totalTenants, planCounts, recentCount] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.tenant.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ])

  const countByPlan = Object.fromEntries(
    planCounts.map((r) => [r.plan, r._count._all])
  ) as Record<PlanName, number>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-950">Visão Geral do Sistema</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">{totalTenants}</p>
          <p className="mt-1 text-sm text-slate-500">Total de tenants</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-950">{recentCount}</p>
          <p className="mt-1 text-sm text-slate-500">Últimos 30 dias</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Distribuição por plano</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(PLAN_LABELS) as PlanName[]).map((plan) => (
            <div key={plan} className="rounded-lg border border-slate-100 p-4 text-center">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[plan]}`}>
                {PLAN_LABELS[plan]}
              </span>
              <p className="mt-2 text-xl font-bold text-slate-950">{countByPlan[plan] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/(admin)/page.tsx
git commit -m "feat(admin): página overview com totais e distribuição por plano"
```

---

### Task 15: Página lista de planos /admin/planos/

**Files:**
- Create: `src/app/(admin)/planos/page.tsx`

- [ ] **Criar `src/app/(admin)/planos/page.tsx`**

```tsx
import Link from 'next/link'
import { prisma } from '@/shared/database/prisma'
import { PlanName } from '@prisma/client'
import { ChevronRight } from 'lucide-react'

const PLAN_COLORS: Record<PlanName, string> = {
  FREE: 'border-slate-200 bg-slate-50',
  STARTER: 'border-blue-200 bg-blue-50',
  PRO: 'border-violet-200 bg-violet-50',
  ENTERPRISE: 'border-amber-200 bg-amber-50',
}

export default async function AdminPlanosPage() {
  const plans = await prisma.plan.findMany({ orderBy: { displayOrder: 'asc' } })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-950">Planos</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Link
            key={plan.name}
            href={`/admin/planos/${plan.name}`}
            className={`flex flex-col rounded-xl border p-5 transition hover:shadow-sm ${PLAN_COLORS[plan.name as PlanName]}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-950">{plan.displayName}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {plan.price > 0 ? `R$ ${Number(plan.price).toFixed(2)}/mês` : 'Grátis'}
                </p>
              </div>
              <ChevronRight className="size-4 text-slate-400" />
            </div>
            {plan.description && (
              <p className="mt-3 text-xs text-slate-500">{plan.description}</p>
            )}
            <span className={`mt-4 self-start rounded-full px-2 py-0.5 text-xs font-medium ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {plan.isActive ? 'Ativo' : 'Inativo'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/(admin)/planos/page.tsx
git commit -m "feat(admin): página lista de planos"
```

---

### Task 16: Editor de plano /admin/planos/[planName]/

**Files:**
- Create: `src/app/(admin)/planos/[planName]/page.tsx`

- [ ] **Criar `src/app/(admin)/planos/[planName]/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlans, useUpdatePlan } from '@/hooks/admin/use-plans'
import { usePlanFeatures, useUpdatePlanFeatures } from '@/hooks/admin/use-plan-features'
import { usePlanLimits, useUpdatePlanLimits } from '@/hooks/admin/use-plan-limits'
import { LIMIT_REGISTRY } from '@/shared/permissions/limit-registry'

const NAV_SECTIONS = ['agenda','clientes','financeiro','servicos','relatorios','equipe','configuracoes']
const BILLING_FEATURES = ['reports_basic','whatsapp_basic','campaigns','reports_advanced','whatsapp_premium','multi_unit']

const SECTION_LABELS: Record<string, string> = {
  agenda: 'Agenda', clientes: 'Clientes', financeiro: 'Financeiro',
  servicos: 'Serviços', relatorios: 'Relatórios', equipe: 'Equipe', configuracoes: 'Configurações',
  reports_basic: 'Relatórios Básicos', whatsapp_basic: 'WhatsApp Básico',
  campaigns: 'Campanhas', reports_advanced: 'Relatórios Avançados',
  whatsapp_premium: 'WhatsApp Premium', multi_unit: 'Multi-unidade',
}

export default function PlanEditorPage() {
  const { planName } = useParams<{ planName: string }>()
  const { data: plans, isLoading: loadingPlans } = usePlans()
  const { data: features = [], isLoading: loadingFeatures } = usePlanFeatures(planName)
  const { data: limits = [], isLoading: loadingLimits } = usePlanLimits(planName)
  const updatePlan = useUpdatePlan()
  const updateFeatures = useUpdatePlanFeatures()
  const updateLimits = useUpdatePlanLimits()

  const plan = plans?.find((p) => p.name === planName)

  const [displayName, setDisplayName] = useState(plan?.displayName ?? '')
  const [price, setPrice] = useState(String(plan?.price ?? 0))
  const [description, setDescription] = useState(plan?.description ?? '')
  const [isActive, setIsActive] = useState(plan?.isActive ?? true)

  const featureMap = Object.fromEntries(features.map((f) => [f.sectionKey, f.enabled]))
  const [featureState, setFeatureState] = useState<Record<string, boolean>>(featureMap)

  const limitMap = Object.fromEntries(limits.map((l) => [l.limitKey, l.value]))
  const [limitState, setLimitState] = useState<Record<string, number>>(limitMap)

  if (loadingPlans || loadingFeatures || loadingLimits) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!plan) return <p className="text-slate-500">Plano não encontrado.</p>

  function handleSaveMetadata() {
    updatePlan.mutate(
      { name: planName, displayName, price: parseFloat(price) || 0, description, isActive },
      {
        onSuccess: () => toast.success('Metadados salvos'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro'),
      }
    )
  }

  function handleSaveFeatures() {
    updateFeatures.mutate(
      { planName, features: Object.entries(featureState).map(([sectionKey, enabled]) => ({ sectionKey, enabled })) },
      {
        onSuccess: () => toast.success('Funcionalidades salvas'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro'),
      }
    )
  }

  function handleSaveLimits() {
    updateLimits.mutate(
      { planName, limits: Object.entries(limitState).map(([limitKey, value]) => ({ limitKey, value })) },
      {
        onSuccess: () => toast.success('Limites salvos'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro'),
      }
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-950">Plano {plan.displayName}</h1>

      <Tabs defaultValue="metadata">
        <TabsList>
          <TabsTrigger value="metadata">Metadados</TabsTrigger>
          <TabsTrigger value="features">Funcionalidades</TabsTrigger>
          <TabsTrigger value="limits">Limites</TabsTrigger>
        </TabsList>

        {/* Aba Metadados */}
        <TabsContent value="metadata" className="mt-6">
          <div className="max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6">
            <div className="space-y-1.5">
              <Label>Nome de exibição</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label>Preço mensal (R$)</Label>
              <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Plano ativo</Label>
            </div>
            <Button onClick={handleSaveMetadata} disabled={updatePlan.isPending} className="bg-slate-950 text-white hover:bg-slate-800">
              {updatePlan.isPending ? 'Salvando...' : 'Salvar metadados'}
            </Button>
          </div>
        </TabsContent>

        {/* Aba Funcionalidades */}
        <TabsContent value="features" className="mt-6">
          <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Navegação</p>
              {NAV_SECTIONS.map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <Label>{SECTION_LABELS[key] ?? key}</Label>
                  <Switch
                    checked={featureState[key] ?? false}
                    onCheckedChange={(v) => setFeatureState((s) => ({ ...s, [key]: v }))}
                  />
                </div>
              ))}
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Capacidades</p>
              {BILLING_FEATURES.map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <Label>{SECTION_LABELS[key] ?? key}</Label>
                  <Switch
                    checked={featureState[key] ?? false}
                    onCheckedChange={(v) => setFeatureState((s) => ({ ...s, [key]: v }))}
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleSaveFeatures} disabled={updateFeatures.isPending} className="mt-6 bg-slate-950 text-white hover:bg-slate-800">
              {updateFeatures.isPending ? 'Salvando...' : 'Salvar funcionalidades'}
            </Button>
          </div>
        </TabsContent>

        {/* Aba Limites */}
        <TabsContent value="limits" className="mt-6">
          <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6">
            <div className="space-y-4">
              {(Object.entries(LIMIT_REGISTRY) as Array<[string, (typeof LIMIT_REGISTRY)[keyof typeof LIMIT_REGISTRY]]>).map(([key, meta]) => (
                <div key={key} className="flex items-center gap-4">
                  <Label className="w-48 shrink-0">{meta.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    className="w-28"
                    value={limitState[key] ?? meta.defaults[planName as keyof typeof meta.defaults] ?? 0}
                    onChange={(e) => setLimitState((s) => ({ ...s, [key]: parseInt(e.target.value) || 0 }))}
                  />
                  <span className="text-xs text-slate-400">{meta.unit} · 999999 = ilimitado</span>
                </div>
              ))}
            </div>
            <Button onClick={handleSaveLimits} disabled={updateLimits.isPending} className="mt-6 bg-slate-950 text-white hover:bg-slate-800">
              {updateLimits.isPending ? 'Salvando...' : 'Salvar limites'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add "src/app/(admin)/planos/[planName]/page.tsx"
git commit -m "feat(admin): editor de plano com abas de metadados, funcionalidades e limites"
```

---

### Task 17: Página de tenants /admin/tenants/

**Files:**
- Create: `src/app/(admin)/tenants/page.tsx`

- [ ] **Criar `src/app/(admin)/tenants/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useAdminTenants } from '@/hooks/admin/use-admin-tenants'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-violet-100 text-violet-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

export default function AdminTenantsPage() {
  const { data: tenants = [], isLoading } = useAdminTenants()
  const [search, setSearch] = useState('')

  const filtered = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-950">Tenants</h1>
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-60"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Negócio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Plano</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Usuários</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Nenhum tenant encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{tenant.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[tenant.plan] ?? 'bg-slate-100 text-slate-700'}`}>
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{tenant._count.users}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add "src/app/(admin)/tenants/page.tsx"
git commit -m "feat(admin): página lista de tenants com busca por nome"
```

---

### Task 18: Verificação final e PR 3

- [ ] **Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros. Corrigir todos os erros encontrados antes de continuar.

- [ ] **Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Abrir PR 3**

```bash
git push origin HEAD
gh pr create --title "feat(admin): frontend do painel de administração [PR 3/3]" \
  --body "$(cat <<'EOF'
## Resumo
- AdminShell: layout próprio com banner "Modo Admin", sidebar e link de retorno
- /admin/: overview com totais e distribuição de tenants por plano
- /admin/planos/: lista dos 4 planos em cards navegáveis
- /admin/planos/[planName]/: editor com 3 abas (metadados, funcionalidades, limites)
- /admin/tenants/: tabela de tenants com busca por nome
- Hooks: usePlans, usePlanFeatures, usePlanLimits, useAdminTenants

## Como testar
- npx tsc --noEmit → zero erros
- npx vitest run → todos os testes passando
- Acessar /admin/ com usuário com isSystemAdmin: true no app_metadata
- Tentar acessar /admin/ sem a flag → redireciona para /agenda
EOF
)"
```

- [ ] **Mergear PR 3**

---

## Self-review do plano

### Cobertura da spec

| Requisito | Task |
|---|---|
| Tabela `Plan` com metadados | Task 2 |
| Tabela `PlanLimitConfig` | Task 2 |
| `LIMIT_REGISTRY` com defaults | Task 1 |
| Seed de Plan, PlanLimitConfig, billing features | Task 3 |
| `PlanLimitsService` com fallback e subscription check | Task 4 |
| Remove `PLAN_LIMITS` de `billing/types.ts` | Task 7 |
| Remove `PLAN_FEATURES`, `PLAN_LIMITS`, `FEATURE_MIN_PLAN` de `feature-guard.ts` | Task 6 |
| `WhatsAppQuotaService` usa `planLimitsService` | Task 7 |
| Remove `ROLE_LIMITS` de `role.service.ts` | Task 8 |
| `getAdminContext` verifica `isSystemAdmin` | Task 9 |
| Middleware protege `/admin/*` | Task 9 |
| API GET `/api/admin/plans` | Task 10 |
| API PUT `/api/admin/plans/[planName]` | Task 10 |
| API GET/PUT `/api/admin/plans/[planName]/features` | Task 10 |
| API GET/PUT `/api/admin/plans/[planName]/limits` | Task 10 |
| API GET `/api/admin/tenants` | Task 10 |
| Hooks admin | Task 12 |
| AdminShell com banner e link de retorno | Task 13 |
| Página overview /admin/ | Task 14 |
| Lista de planos /admin/planos/ | Task 15 |
| Editor de plano com 3 abas | Task 16 |
| Lista de tenants com busca | Task 17 |

### Consistência de tipos

- `LimitKey` definido em Task 1 (`limit-registry.ts`), usado em Tasks 4, 6, 8, 12
- `PlanLimitsService.get(tenantId, limitKey)` retorna `number` — Tasks 4 e 6 consistentes
- `featureGuard.assertWithinLimit` mantém assinatura `'users' | 'appointments_month'` — callers existentes não precisam mudar
- `useUpdatePlanFeatures` recebe `{ planName, features[] }` — consistente com PUT route em Task 10
- `useUpdatePlanLimits` recebe `{ planName, limits[] }` — consistente com PUT route em Task 10
- Seed em Task 3 usa `plan_limitKey` como nome do unique constraint — consistente com schema em Task 2

### Notas de atenção

- Task 9 requer verificar o path correto do import `supabaseAdmin` no projeto (`grep` incluído na task)
- Task 16: a página do editor usa `useState` com valores iniciais baseados nos dados carregados — se o carregamento ainda não terminou ao montar o componente, os estados inicializarão com `''`/`0`. A lógica de `!plan` com fallback de loading evita isso, mas revisar se necessário adicionar `useEffect` para sincronizar estados quando `plan`/`features`/`limits` carregarem.
