# Planos — Fase A (Página de planos = espelho da config) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a página de planos, o onboarding e a landing exibirem benefícios **auto-gerados da configuração real** (capacidades habilitadas + limites), mais 1–3 destaques de marketing opcionais do admin — eliminando a fonte de verdade dupla (`Plan.description` como texto livre de benefícios).

**Architecture:** Um combinador puro `buildPlanBenefits()` (só depende dos registries da Fase 0, client-safe) monta a lista canônica de benefícios a partir de `{ capacidades habilitadas, limites }`, na ordem das categorias. Um serviço `getPublicPlans()` lê `Plan` + `PlanFeatureConfig` + `PlanLimitConfig` do banco e devolve `PublicPlan` (benefícios auto-gerados + destaques de `Plan.description`, máx. 3 linhas). Os 4 consumidores (`/planos`, `/api/public/plans`+onboarding, landing) passam a consumir o serviço; o `SharedPlanCard` ganha um bloco de destaques (tagline em negrito) acima da lista de benefícios. O editor do admin renomeia o textarea para "Destaques (opcional)" e mostra um preview read-only dos benefícios canônicos (reusando o MESMO combinador, ao vivo, a partir do estado local).

**Tech Stack:** Next.js 15 App Router + TypeScript (strict), Prisma, Vitest (+ prismaMock), Shadcn UI, TanStack Query.

## Global Constraints

- Todo output em **Português do Brasil** (código, comentários, commits, UI).
- TypeScript strict — sem `any`, sem `as unknown as`.
- Erros de domínio tipados de `src/shared/errors/` — nunca `throw new Error('string')`.
- **Nenhuma mudança de schema nesta fase** (só leitura de config existente + registries da Fase 0). `Plan.description` é **reaproveitado** como campo de destaques (1 linha por destaque), sem migração.
- **Fonte única de benefícios:** a lista canônica vem SEMPRE de `buildPlanBenefits()` (config real). Nunca dividir `Plan.description` como se fosse a lista de features. `Plan.description` passa a ser só os destaques de marketing.
- **Benefícios = tudo incluído:** a lista inclui capacidades essenciais + não-essenciais habilitadas (`enabled` e `status === 'ga'`) + limites com valor > 0, na ordem das categorias de exibição.
- **Ordem das categorias** (canônica): Acesso & Equipe → Operação → Catálogo & Estoque → Comunicação → Clientes → Relatórios (= `Object.values(CAPABILITY_GROUPS)`).
- **Destaques:** máximo 3 linhas; renderizados como tagline em negrito no topo do card, acima da lista de benefícios com check.
- `isPopular` continua derivado (`name === PlanName.PRO`) — não há campo no schema e o programa não abre migração fora do `CapabilityInterestLog` (Fase B).
- Commits frequentes, um por task. Não commitar em `main`.

---

## File Structure

- **Create** `src/shared/permissions/plan-benefits.ts` — combinador puro `buildPlanBenefits()` (registries → lista de benefícios ordenada). Client-safe.
- **Create** `src/shared/permissions/plan-benefits.test.ts` — testes do combinador.
- **Create** `src/domains/billing/plan-catalog.service.ts` — `getPublicPlans()` (lê config do banco + combinador).
- **Create** `src/domains/billing/plan-catalog.service.test.ts` — testes do serviço (prismaMock).
- **Modify** `src/components/domain/billing/plan-card-shared.tsx` — `SharedPlanData` ganha `highlights?`; render do bloco de destaques.
- **Modify** `src/components/domain/billing/pricing-toggle.tsx` — `PlanData` ganha `highlights?` (repasse).
- **Modify** `src/app/(public)/planos/page.tsx` — consome `getPublicPlans()`.
- **Modify** `src/app/api/public/plans/route.ts` — retorna o shape de `PublicPlan`.
- **Modify** `src/app/(auth)/onboarding/page.tsx` — `ApiPlan`/`apiPlanToShared` usam `benefits`/`highlights`/`isPopular`.
- **Modify** `src/app/(public)/page.tsx` — `getLandingData()` usa `getPublicPlans()`.
- **Modify** `src/app/(public)/landing.test.ts` — ajusta o teste de `getLandingData`.
- **Modify** `src/app/(admin)/admin/planos/[planName]/page.tsx` — textarea vira "Destaques (opcional)" (máx. 3 linhas) + preview read-only dos benefícios canônicos.

Pré-requisito de branch (primeiro passo, antes da Task 1):

```bash
git checkout main && git pull --ff-only
git checkout -b feat/planos-faseA-catalogo-publico
```

> **Ambiente conhecido (Fase 0):** `npx tsc --noEmit` pode acusar erros PRÉ-EXISTENTES sob `.next/**/validator.ts` (cache stale de build) — desconsiderar qualquer caminho que comece com `.next/`. `npx vitest run` completo tem ~7 falhas PRÉ-EXISTENTES na `main` (scheduling checkout atomicity, appointment-reminder, customer-history ×2, service-picker ×3) — não são regressão; confirmar apenas que nenhuma falha NOVA foi introduzida.

---

## Task 1: Combinador puro de benefícios

**Files:**
- Create: `src/shared/permissions/plan-benefits.ts`
- Test: `src/shared/permissions/plan-benefits.test.ts`

**Interfaces:**
- Consumes: `CAPABILITY_REGISTRY`, `CAPABILITY_GROUPS`, `getCapability` de `./capability-registry`; `LIMIT_REGISTRY` de `./limit-registry`.
- Produces:
  - `buildPlanBenefits(input: { enabledCapabilityKeys: string[]; limits: Record<string, number> }): string[]`

Regras (verbatim):
- Para cada grupo em `Object.values(CAPABILITY_GROUPS)` (nessa ordem):
  1. as capacidades de `CAPABILITY_REGISTRY` que pertencem ao grupo, estão em `enabledCapabilityKeys` e têm `status === 'ga'` → adiciona `benefitLabel` (na ordem do registry);
  2. os limites de `LIMIT_REGISTRY` que pertencem ao grupo e têm valor `> 0` em `limits` → adiciona `meta.benefitLabel(valor)` (na ordem do registry).
- Chaves habilitadas que não existem no registry (ex.: `reports_basic` legado) são ignoradas (via `getCapability` retornando `undefined`).
- Essenciais entram normalmente (tudo incluído).

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/permissions/plan-benefits.test.ts
import { describe, it, expect } from 'vitest'
import { buildPlanBenefits } from './plan-benefits'

describe('buildPlanBenefits', () => {
  it('inclui capacidades essenciais e não-essenciais habilitadas (status ga)', () => {
    const benefits = buildPlanBenefits({
      enabledCapabilityKeys: ['agenda', 'servicos', 'clientes', 'equipe', 'configuracoes', 'financeiro', 'whatsapp_basic'],
      limits: {},
    })
    expect(benefits).toContain('Agenda completa')
    expect(benefits).toContain('Financeiro e caixa')
    expect(benefits).toContain('WhatsApp automático')
  })

  it('ignora chaves habilitadas que não estão no registry (ex.: reports_basic legado)', () => {
    const benefits = buildPlanBenefits({ enabledCapabilityKeys: ['reports_basic'], limits: {} })
    expect(benefits).toEqual([])
  })

  it('inclui limites com valor > 0 e ignora limites em 0', () => {
    const benefits = buildPlanBenefits({
      enabledCapabilityKeys: [],
      limits: { max_users: 5, max_whatsapp_month: 0, max_appointments_month: 300 },
    })
    expect(benefits).toContain('Até 5 profissionais')
    expect(benefits).toContain('300 agendamentos/mês')
    expect(benefits.some((b) => b.includes('WhatsApp'))).toBe(false)
  })

  it('ordena por categoria: Acesso & Equipe antes de Comunicação', () => {
    const benefits = buildPlanBenefits({
      enabledCapabilityKeys: ['equipe', 'whatsapp_basic'],
      limits: {},
    })
    expect(benefits.indexOf('Gestão de equipe')).toBeLessThan(benefits.indexOf('WhatsApp automático'))
  })

  it('exclui capacidades com status soon (não vendáveis ainda)', () => {
    // whatsapp_premium/campaigns são status ga hoje; este teste protege o filtro por status.
    // Usa uma capacidade real com status ga e confirma que o filtro é por status, não por chave.
    const benefits = buildPlanBenefits({ enabledCapabilityKeys: ['whatsapp_basic'], limits: {} })
    expect(benefits).toEqual(['WhatsApp automático'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/permissions/plan-benefits.test.ts`
Expected: FAIL — módulo `./plan-benefits` não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/permissions/plan-benefits.ts
import { CAPABILITY_REGISTRY, CAPABILITY_GROUPS, getCapability } from './capability-registry'
import { LIMIT_REGISTRY } from './limit-registry'

const GROUP_ORDER: string[] = Object.values(CAPABILITY_GROUPS)

/**
 * Monta a lista canônica de benefícios de um plano a partir da config real
 * (capacidades habilitadas + limites), na ordem das categorias de exibição.
 * Função pura e client-safe: usada tanto pelo catálogo público (server) quanto
 * pelo preview do editor de planos no admin (client).
 */
export function buildPlanBenefits(input: {
  enabledCapabilityKeys: string[]
  limits: Record<string, number>
}): string[] {
  const enabled = new Set(input.enabledCapabilityKeys)
  const benefits: string[] = []

  for (const group of GROUP_ORDER) {
    // 1) Capacidades habilitadas e disponíveis (status 'ga') deste grupo.
    for (const cap of CAPABILITY_REGISTRY) {
      if (cap.group !== group) continue
      if (!enabled.has(cap.key)) continue
      if (cap.status !== 'ga') continue
      if (!getCapability(cap.key)) continue
      benefits.push(cap.benefitLabel)
    }
    // 2) Limites com valor > 0 deste grupo.
    for (const [key, meta] of Object.entries(LIMIT_REGISTRY)) {
      if (meta.group !== group) continue
      const value = input.limits[key]
      if (typeof value !== 'number' || value <= 0) continue
      benefits.push(meta.benefitLabel(value))
    }
  }

  return benefits
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/permissions/plan-benefits.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/shared/permissions/plan-benefits.ts src/shared/permissions/plan-benefits.test.ts
git commit -m "feat(planos): combinador puro buildPlanBenefits (benefícios da config real)"
```

---

## Task 2: Serviço de catálogo público (getPublicPlans)

**Files:**
- Create: `src/domains/billing/plan-catalog.service.ts`
- Test: `src/domains/billing/plan-catalog.service.test.ts`

**Interfaces:**
- Consumes: `prisma` (`@/shared/database/prisma`), `PlanName` de `@prisma/client`, `buildPlanBenefits` de `@/shared/permissions/plan-benefits`.
- Produces:
  - `type PublicPlan = { name: PlanName; displayName: string; price: number; trialDays: number; isPopular: boolean; highlights: string[]; benefits: string[] }`
  - `getPublicPlans(): Promise<PublicPlan[]>` — planos ativos, ordenados por `displayOrder`; `highlights` = `Plan.description` dividido por linha, aparado, filtrado, `slice(0, 3)`; `benefits` = `buildPlanBenefits`.

> Models de config (confirmados na Fase 0): `PlanFeatureConfig { plan, sectionKey, enabled }`, `PlanLimitConfig { plan, limitKey, value }`. Busca em lote (uma query por tabela, filtrando por `plan in names`), monta em memória — evita N+1.

- [ ] **Step 1: Write the failing test**

```ts
// src/domains/billing/plan-catalog.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { getPublicPlans } from './plan-catalog.service'

describe('getPublicPlans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gera benefícios da config e destaques de description (máx. 3)', async () => {
    prismaMock.plan.findMany.mockResolvedValue([
      {
        name: PlanName.STARTER,
        displayName: 'Starter',
        price: 49 as unknown as never,
        trialDays: 14,
        description: 'Ideal para começar\nSuporte por WhatsApp\nSem fidelidade\nLinha extra ignorada',
      },
    ] as never)
    prismaMock.planFeatureConfig.findMany.mockResolvedValue([
      { plan: PlanName.STARTER, sectionKey: 'agenda' },
      { plan: PlanName.STARTER, sectionKey: 'whatsapp_basic' },
    ] as never)
    prismaMock.planLimitConfig.findMany.mockResolvedValue([
      { plan: PlanName.STARTER, limitKey: 'max_users', value: 5 },
      { plan: PlanName.STARTER, limitKey: 'max_whatsapp_month', value: 0 },
    ] as never)

    const [plan] = await getPublicPlans()
    expect(plan.name).toBe(PlanName.STARTER)
    expect(plan.price).toBe(49)
    expect(plan.isPopular).toBe(false)
    expect(plan.highlights).toEqual(['Ideal para começar', 'Suporte por WhatsApp', 'Sem fidelidade'])
    expect(plan.benefits).toContain('Agenda completa')
    expect(plan.benefits).toContain('WhatsApp automático')
    expect(plan.benefits).toContain('Até 5 profissionais')
    expect(plan.benefits.some((b) => b.includes('WhatsApp/mês'))).toBe(false) // limite 0 ignorado
  })

  it('marca PRO como isPopular e trata description nula', async () => {
    prismaMock.plan.findMany.mockResolvedValue([
      { name: PlanName.PRO, displayName: 'Pro', price: 89 as unknown as never, trialDays: 14, description: null },
    ] as never)
    prismaMock.planFeatureConfig.findMany.mockResolvedValue([] as never)
    prismaMock.planLimitConfig.findMany.mockResolvedValue([] as never)

    const [plan] = await getPublicPlans()
    expect(plan.isPopular).toBe(true)
    expect(plan.highlights).toEqual([])
    expect(plan.benefits).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/billing/plan-catalog.service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domains/billing/plan-catalog.service.ts
import { PlanName } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'
import { buildPlanBenefits } from '@/shared/permissions/plan-benefits'

export type PublicPlan = {
  name: PlanName
  displayName: string
  price: number
  trialDays: number
  isPopular: boolean
  highlights: string[]
  benefits: string[]
}

function parseHighlights(description: string | null): string[] {
  if (!description) return []
  return description
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
}

export async function getPublicPlans(): Promise<PublicPlan[]> {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: { name: true, displayName: true, price: true, trialDays: true, description: true },
  })

  const names = plans.map((p) => p.name)
  const [features, limits] = await Promise.all([
    prisma.planFeatureConfig.findMany({
      where: { plan: { in: names }, enabled: true },
      select: { plan: true, sectionKey: true },
    }),
    prisma.planLimitConfig.findMany({
      where: { plan: { in: names } },
      select: { plan: true, limitKey: true, value: true },
    }),
  ])

  return plans.map((p) => {
    const enabledCapabilityKeys = features
      .filter((f) => f.plan === p.name)
      .map((f) => f.sectionKey)
    const planLimits: Record<string, number> = {}
    for (const l of limits) {
      if (l.plan === p.name) planLimits[l.limitKey] = l.value
    }
    return {
      name: p.name,
      displayName: p.displayName,
      price: Number(p.price),
      trialDays: p.trialDays,
      isPopular: p.name === PlanName.PRO,
      highlights: parseHighlights(p.description),
      benefits: buildPlanBenefits({ enabledCapabilityKeys, limits: planLimits }),
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/billing/plan-catalog.service.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domains/billing/plan-catalog.service.ts src/domains/billing/plan-catalog.service.test.ts
git commit -m "feat(planos): getPublicPlans() — catálogo público espelha a config real"
```

---

## Task 3: Card compartilhado com destaques (tagline)

**Files:**
- Modify: `src/components/domain/billing/plan-card-shared.tsx`
- Modify: `src/components/domain/billing/pricing-toggle.tsx`
- Test: `src/components/domain/billing/plan-card-shared.test.tsx` (novo)

**Interfaces:**
- `SharedPlanData` ganha `highlights?: string[]`.
- `PlanData` (pricing-toggle) ganha `highlights?: string[]` (repasse ao card).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/domain/billing/plan-card-shared.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SharedPlanCard } from './plan-card-shared'

describe('SharedPlanCard', () => {
  it('renderiza destaques (tagline) e benefícios com check', () => {
    render(
      <SharedPlanCard
        plan={{
          name: 'STARTER',
          displayName: 'Starter',
          price: 49,
          highlights: ['Ideal para começar'],
          features: ['Agenda completa', 'WhatsApp automático'],
          trialDays: 14,
        }}
        action={{ type: 'navigate', href: '/login?plan=STARTER' }}
      />,
    )
    expect(screen.getByText('Ideal para começar')).toBeInTheDocument()
    expect(screen.getByText('Agenda completa')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp automático')).toBeInTheDocument()
  })

  it('não renderiza bloco de destaques quando highlights está vazio', () => {
    render(
      <SharedPlanCard
        plan={{ name: 'PRO', displayName: 'Pro', price: 89, features: ['Agenda completa'], trialDays: 14 }}
        action={{ type: 'navigate', href: '/login?plan=PRO' }}
      />,
    )
    expect(screen.queryByTestId('plan-highlights')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/domain/billing/plan-card-shared.test.tsx`
Expected: FAIL — `highlights` não existe no tipo e o bloco não é renderizado.

- [ ] **Step 3: Write minimal implementation**

Em `plan-card-shared.tsx`, adicionar `highlights?: string[]` ao `SharedPlanData`:

```ts
export type SharedPlanData = {
  name: string
  displayName: string
  price: number
  features: string[]
  highlights?: string[]
  trialDays?: number
  isPopular?: boolean
}
```

E inserir, no JSX, ENTRE o bloco do preço (o `</div>` que fecha o header em `plan-card-shared.tsx`, hoje na linha ~67) e a `<ul>` de features (linha ~69), o bloco de destaques:

```tsx
{plan.highlights && plan.highlights.length > 0 && (
  <div data-testid="plan-highlights" className="space-y-1">
    {plan.highlights.map((h) => (
      <p key={h} className="text-sm font-semibold text-slate-900">{h}</p>
    ))}
  </div>
)}
```

Em `pricing-toggle.tsx`, adicionar `highlights?: string[]` ao `PlanData`:

```ts
export type PlanData = {
  name: string
  displayName: string
  price: number
  description?: string | null
  features: string[]
  highlights?: string[]
  trialDays: number
  isPopular?: boolean
}
```

(O `SharedPlanCard` recebe `plan` inteiro, então `highlights` já flui sem outra mudança no pricing-toggle.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/domain/billing/plan-card-shared.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/billing/plan-card-shared.tsx src/components/domain/billing/pricing-toggle.tsx src/components/domain/billing/plan-card-shared.test.tsx
git commit -m "feat(planos): SharedPlanCard exibe destaques (tagline) acima dos benefícios"
```

---

## Task 4: /planos consome getPublicPlans

**Files:**
- Modify: `src/app/(public)/planos/page.tsx`

**Interfaces:**
- Consumes: `getPublicPlans` de `@/domains/billing/plan-catalog.service`.

Objetivo: remover o `getPlans()` local e a divisão de `description`; mapear `PublicPlan` → `PlanData` (com `highlights` + `features: benefits`). O cálculo de `trialDays` para os textos genéricos passa a usar o resultado de `getPublicPlans()`.

- [ ] **Step 1: Substituir a fonte de dados**

Substituir o topo do arquivo (imports + `getPlans` + `plansWithFeatures`) por:

```tsx
import { getPublicPlans } from '@/domains/billing/plan-catalog.service'
import { PricingToggle } from '@/components/domain/billing/pricing-toggle'

// Sempre renderizar no request: os planos são editáveis pelo admin e precisam
// refletir imediatamente (chamadas Prisma não são sinal de dinamismo no Next 15).
export const dynamic = 'force-dynamic'

export default async function PlansPage() {
  const plans = await getPublicPlans()

  const plansForCards = plans.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    price: p.price,
    features: p.benefits,
    highlights: p.highlights,
    trialDays: p.trialDays,
    isPopular: p.isPopular,
  }))

  const trialDays =
    plans.find((p) => p.name === 'STARTER')?.trialDays ??
    plans.reduce((max, p) => Math.max(max, p.trialDays), 0)
```

E trocar `<PricingToggle plans={plansWithFeatures} />` por `<PricingToggle plans={plansForCards} />`. O restante do JSX (header, FAQ) permanece.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (desconsiderar erros sob `.next/`)
Expected: zero erros em `src/`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/planos/page.tsx"
git commit -m "feat(planos): /planos consome getPublicPlans (benefícios da config + destaques)"
```

---

## Task 5: /api/public/plans + onboarding consomem o novo shape

**Files:**
- Modify: `src/app/api/public/plans/route.ts`
- Modify: `src/app/(auth)/onboarding/page.tsx`

**Interfaces:**
- A rota passa a retornar `PublicPlan[]` (inclui `isPopular`, `highlights`, `benefits`).
- `onboarding` atualiza `ApiPlan` e `apiPlanToShared`.

- [ ] **Step 1: Rota retorna getPublicPlans()**

Substituir `src/app/api/public/plans/route.ts` por:

```ts
import { getPublicPlans } from '@/domains/billing/plan-catalog.service'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET() {
  try {
    const plans = await getPublicPlans()
    return Response.json(plans)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Onboarding usa benefits/highlights/isPopular**

Em `src/app/(auth)/onboarding/page.tsx`:

Trocar o tipo `ApiPlan` e o mapeador `apiPlanToShared`:

```ts
type ApiPlan = {
  name: string
  displayName: string
  price: number
  trialDays: number
  isPopular: boolean
  highlights: string[]
  benefits: string[]
}

function apiPlanToShared(plan: ApiPlan, isPopular: boolean): SharedPlanData {
  return {
    name: plan.name,
    displayName: plan.displayName,
    price: plan.price,
    trialDays: plan.trialDays,
    isPopular,
    highlights: plan.highlights,
    features: plan.benefits,
  }
}
```

O `isPopular` passado para `apiPlanToShared` no JSX (linha ~372-375) continua com a regra do badge de plano pré-selecionado, mas troca o fallback `plan.name === 'PRO'` por `plan.isPopular`:

```tsx
plan={apiPlanToShared(
  plan,
  hasPaidPrePlan && !showAllPlans ? true : plan.isPopular,
)}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` (desconsiderar `.next/`)
Expected: zero erros em `src/`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/public/plans/route.ts" "src/app/(auth)/onboarding/page.tsx"
git commit -m "feat(planos): API pública e onboarding usam benefícios auto-gerados + destaques"
```

---

## Task 6: Landing consome getPublicPlans

**Files:**
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/landing.test.ts`

**Interfaces:**
- `getLandingData()` passa a montar os planos via `getPublicPlans()`; mantém `metrics`/`testimonials` via prisma e `starterPlan` derivado do catálogo.

- [ ] **Step 1: Ajustar getLandingData**

Em `src/app/(public)/page.tsx`, importar o serviço e reescrever `getLandingData`:

```ts
import { getPublicPlans } from '@/domains/billing/plan-catalog.service'
```

```ts
export async function getLandingData() {
  const [plans, metrics, testimonials] = await Promise.all([
    getPublicPlans(),
    prisma.landingMetric.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.landingTestimonial.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
  ])

  const starterPlan = plans.find((p) => p.name === 'STARTER') ?? null

  return { plans, starterPlan, metrics, testimonials }
}
```

E, no componente `LandingPage`, ajustar os derivados e o mapeamento dos cards:

```ts
  const trialDays = starterPlan?.trialDays ?? null
  const starterPrice = starterPlan?.price ?? null

  const plansForCards = plans.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    price: p.price,
    features: p.benefits,
    highlights: p.highlights,
    trialDays: p.trialDays,
    isPopular: p.isPopular,
  }))
```

(Antes `starterPrice` fazia `Number(starterPlan.price)`; agora `PublicPlan.price` já é `number`.)

- [ ] **Step 2: Ajustar o teste da landing**

Em `src/app/(public)/landing.test.ts`, o teste hoje mocka `prisma.plan.findMany` e verifica benefícios de `description`. Como `getLandingData` passa a chamar `getPublicPlans`, mockar o serviço:

```ts
import { vi } from 'vitest'
vi.mock('@/domains/billing/plan-catalog.service', () => ({
  getPublicPlans: vi.fn().mockResolvedValue([
    { name: 'STARTER', displayName: 'Starter', price: 49, trialDays: 14, isPopular: false, highlights: ['Ideal para começar'], benefits: ['Agenda completa'] },
    { name: 'PRO', displayName: 'Pro', price: 89, trialDays: 14, isPopular: true, highlights: [], benefits: ['Agenda completa', 'Relatórios avançados'] },
  ]),
}))
```

Ajustar as asserções existentes que dependiam de `description`/`findMany` de planos para refletir o novo shape (mantendo as de `metrics`/`testimonials`). Rodar o arquivo e alinhar as expectativas ao mock acima (ex.: `starterPlan.trialDays === 14`, `plans[1].isPopular === true`).

> Se o teste atual afirmar contagem de `prisma.plan.findMany`, remover essa asserção (o serviço agora encapsula a query). Não enfraquecer o teste: manter verificações de que `getLandingData` devolve `plans`, `starterPlan`, `metrics`, `testimonials` corretos.

- [ ] **Step 3: Rodar o teste da landing + typecheck**

Run: `npx vitest run src/app/(public)/landing.test.ts && npx tsc --noEmit` (desconsiderar `.next/`)
Expected: teste da landing verde; zero erros em `src/`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/page.tsx" "src/app/(public)/landing.test.ts"
git commit -m "feat(planos): landing consome getPublicPlans (fonte única de benefícios)"
```

---

## Task 7: Admin — "Destaques (opcional)" + preview canônico

**Files:**
- Modify: `src/app/(admin)/admin/planos/[planName]/page.tsx`

**Interfaces:**
- Consumes: `buildPlanBenefits` de `@/shared/permissions/plan-benefits` (mesmo combinador do serviço, usado ao vivo com o estado local do editor).

Objetivo (spec §4.2): renomear o textarea "Benefícios do plano" → **"Destaques (opcional)"** (copy de marketing, máx. 3 linhas, continua salvo em `Plan.description` via `handleSaveMetadata`, sem mudança de API); abaixo, um **preview read-only** da lista canônica de benefícios que o cliente verá, gerada de `featureState`/`limitState` já carregados no editor.

- [ ] **Step 1: Renomear o campo de destaques (aba Metadados)**

No `TabsContent value="metadata"`, no bloco do `<Textarea>` de `description` (hoje `plan-card`… linhas ~134-144), trocar o `<Label>` e o texto de ajuda, e limitar a 3 linhas no `onChange`:

```tsx
<div className="space-y-1.5">
  <Label>Destaques (opcional)</Label>
  <Textarea
    value={description}
    onChange={(e) => {
      const linhas = e.target.value.split('\n').slice(0, 3)
      setDescription(linhas.join('\n'))
    }}
    rows={3}
    placeholder={'Ideal para quem está começando\nSuporte humano por WhatsApp'}
    className="resize-none font-mono text-sm"
  />
  <p className="text-xs text-slate-400">
    Até 3 linhas de copy de marketing, exibidas em destaque no topo do card.
    Os benefícios abaixo são gerados automaticamente da configuração — não precisa digitá-los.
  </p>
</div>
```

- [ ] **Step 2: Preview read-only dos benefícios canônicos**

Importar o combinador no topo do arquivo:

```ts
import { buildPlanBenefits } from '@/shared/permissions/plan-benefits'
```

Derivar os benefícios ao vivo (dentro do componente, antes do `return`, junto de `navCaps`/`otherCaps` da Fase 0):

```ts
const enabledCapabilityKeys = Object.entries(featureState)
  .filter(([, enabled]) => enabled)
  .map(([key]) => key)
const previewBenefits = buildPlanBenefits({ enabledCapabilityKeys, limits: limitState })
```

E, dentro do card da aba Metadados (logo após o bloco do textarea de destaques, antes do `<Button>` "Salvar metadados"), inserir o preview:

```tsx
<div className="space-y-1.5">
  <Label className="text-slate-500">Benefícios exibidos ao cliente (automático)</Label>
  <ul className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
    {previewBenefits.length === 0 ? (
      <li className="text-xs text-slate-400">
        Nenhum benefício ainda — ligue capacidades ou defina limites nas abas Funcionalidades e Limites.
      </li>
    ) : (
      previewBenefits.map((b) => (
        <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
          <span className="mt-0.5 text-green-500">✓</span>
          {b}
        </li>
      ))
    )}
  </ul>
  <p className="text-xs text-slate-400">
    Prévia da lista que aparece em /planos, no onboarding e na landing. Atualiza ao salvar Funcionalidades/Limites.
  </p>
</div>
```

> Nota: `previewBenefits` reflete o `featureState`/`limitState` já carregados (config salva). Se o admin acabou de alterar toggles/limites sem salvar, o preview reflete o estado em edição — coerente com o que será salvo.

- [ ] **Step 3: Typecheck + testes globais**

Run: `npx tsc --noEmit && npx vitest run` (desconsiderar erros sob `.next/`; as ~7 falhas pré-existentes descritas no topo não contam)
Expected: zero erros de tipo em `src/`; nenhuma falha NOVA de teste.

- [ ] **Step 4: Verificação manual (build)**

Run: `npm run build`
Expected: compila e faz typecheck sem erro. (A etapa "Collecting page data" pode falhar por falta de credenciais Supabase no sandbox — limitação de ambiente conhecida, não é regressão desta fase.) Conferir visualmente, se possível, em `/admin/planos/STARTER`: campo "Destaques (opcional)" limitado a 3 linhas + preview de benefícios; em `/planos`: cards com tagline (se houver destaque) e lista de benefícios da config.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/planos/[planName]/page.tsx"
git commit -m "feat(planos): admin — campo Destaques (máx 3) + preview canônico dos benefícios"
```

---

## Verificação final da fase

- [ ] `npx tsc --noEmit` — zero erros em `src/` (ignorar `.next/`)
- [ ] `npx vitest run` — sem falha NOVA (as ~7 pré-existentes permanecem, não são regressão)
- [ ] `npm run build` — compila/typecheck ok (page data pode falhar por env do sandbox)
- [ ] Abrir PR para `main` com título `feat(planos): Fase A — página de planos = espelho da config`

---

## Self-Review (cobertura do spec §4)

- §4.1 `planCatalogService.getPublicPlans()` com `PublicPlan` (benefits auto-gerados + highlights) → Task 2 ✅ (combinador em Task 1)
- §4.1 benefits montado de `PlanFeatureConfig` (enabled + ga) e `PlanLimitConfig` (`benefitLabel(value)`) na ordem das categorias → Task 1 ✅
- §4.1 highlights de campo estruturado (não texto livre solto) → `Plan.description` reaproveitado, máx. 3 linhas → Task 2 + Task 7 ✅
- §4.2 admin: "Benefícios do plano" vira "Destaques (opcional)", até 3 linhas, continua em `Plan.description` sem migração → Task 7 ✅
- §4.2 preview read-only da lista canônica no admin → Task 7 ✅ (reusa `buildPlanBenefits`)
- §4.3 `/planos`, `/onboarding` e landing consomem `getPublicPlans()`; remove o split de texto livre → Tasks 4, 5, 6 ✅

> Fora desta fase: `isPopular` como campo de schema (mantido derivado de `name === PRO`); ciclo anual; `<FeatureLock>`/interceptor 402 (Fase B). O `PLAN_ORDER` literal em `billing-plans-content.tsx` segue deferido à Fase B.
