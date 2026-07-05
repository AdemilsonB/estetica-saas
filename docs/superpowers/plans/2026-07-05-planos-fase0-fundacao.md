# Planos — Fase 0 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a fundação de configuração de planos — um registry único de capacidades, um registry de limites enriquecido, ordem de planos derivada do banco e um resolvedor único de gate — eliminando o hardcode e servindo de base para as Fases A–D.

**Architecture:** Introduz `capability-registry.ts` (metadados de gating por plano, reaproveitando as chaves de `nav-registry` para não duplicar a lista de seções) e enriquece `limit-registry.ts` com metadados de exibição/grupo/kind. `getPlanOrder()` passa a derivar a ordem de `Plan.displayOrder`. `FeatureGuard.resolveGate()` vira a fonte única da resposta "pode? qual o próximo plano?". O editor de planos do admin passa a ser dirigido pelos registries, com toggles de essenciais travados e limites agrupados por categoria.

**Tech Stack:** Next.js 15 + TypeScript (strict), Prisma, Vitest (+ prismaMock), Shadcn UI, TanStack Query.

## Global Constraints

- Todo output em **Português do Brasil** (código, comentários, commits, UI).
- TypeScript strict — sem `any`, sem `as unknown as`.
- Erros de domínio tipados de `src/shared/errors/` — nunca `throw new Error('string')`.
- `nav-registry.ts` (RBAC por cargo) e `capability-registry.ts` (gating por plano) são **concerns distintos** — não fundir. O capability-registry importa as chaves/labels de nav de `NAV_REGISTRY` para não duplicar.
- Mudanças de schema apenas aditivas — nenhuma nesta fase.
- `multi_unit` e `max_units` **saem** das superfícies ativas; linhas existentes no banco ficam inertes (sem drop).
- Recursos essenciais (`agenda`, `servicos`, `clientes`, `equipe`, `configuracoes`) nunca podem ser desligados.
- Categorias de exibição (admin): **Acesso & Equipe**, **Operação**, **Catálogo & Estoque**, **Comunicação**, **Clientes**, **Relatórios**.
- Commits frequentes, um por task concluída. Não commitar em `main`.

---

## File Structure

- **Create** `src/shared/permissions/capability-registry.ts` — registry de capacidades gateáveis por plano + helpers.
- **Create** `src/shared/permissions/capability-registry.test.ts` — testes do registry.
- **Modify** `src/shared/permissions/limit-registry.ts` — enriquece metadados, remove `max_units`.
- **Create** `src/shared/permissions/limit-registry.test.ts` — testes do registry de limites.
- **Create** `src/domains/billing/plan-order.ts` — `getPlanOrder()` derivado do banco.
- **Create** `src/domains/billing/plan-order.test.ts` — testes.
- **Modify** `src/domains/billing/feature-guard.ts` — `resolveGate()`, usar `getPlanOrder()` + registry.
- **Modify** `src/domains/billing/feature-guard.test.ts` — testes de `resolveGate`.
- **Modify** `src/components/domain/billing/billing-plans-content.tsx` — remove linha `max_units`, usar ordem derivada.
- **Modify** `src/app/(admin)/admin/planos/[planName]/page.tsx` — dirigido pelo registry, grupos, essenciais travados.

Pré-requisito de branch (primeiro passo, antes da Task 1):

```bash
git checkout main && git pull --ff-only
git checkout -b feat/planos-fase0-fundacao
```

---

## Task 1: Registry unificado de capacidades

**Files:**
- Create: `src/shared/permissions/capability-registry.ts`
- Test: `src/shared/permissions/capability-registry.test.ts`

**Interfaces:**
- Consumes: `NAV_REGISTRY` de `src/shared/permissions/nav-registry.ts` (para as chaves/labels de nav).
- Produces:
  - `type CapabilityCategory = 'nav' | 'capability' | 'report'`
  - `type CapabilityStatus = 'ga' | 'soon'`
  - `type Capability = { key: string; label: string; category: CapabilityCategory; essential: boolean; benefitLabel: string; status: CapabilityStatus; group: string }`
  - `CAPABILITY_REGISTRY: Capability[]`
  - `getCapability(key: string): Capability | undefined`
  - `isEssential(key: string): boolean`
  - `getGateableCapabilities(): Capability[]` (todas com `essential === false` e `status === 'ga'`)
  - `ESSENTIAL_KEYS: string[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/permissions/capability-registry.test.ts
import { describe, it, expect } from 'vitest'
import {
  CAPABILITY_REGISTRY,
  getCapability,
  isEssential,
  getGateableCapabilities,
  ESSENTIAL_KEYS,
} from './capability-registry'

describe('capability-registry', () => {
  it('marca as 5 seções essenciais como essential e não gateáveis', () => {
    for (const key of ['agenda', 'servicos', 'clientes', 'equipe', 'configuracoes']) {
      expect(isEssential(key)).toBe(true)
    }
    expect(ESSENTIAL_KEYS).toEqual(
      expect.arrayContaining(['agenda', 'servicos', 'clientes', 'equipe', 'configuracoes']),
    )
  })

  it('não inclui multi_unit no registry ativo', () => {
    expect(getCapability('multi_unit')).toBeUndefined()
  })

  it('getGateableCapabilities exclui essenciais e status soon', () => {
    const keys = getGateableCapabilities().map((c) => c.key)
    expect(keys).not.toContain('agenda')
    expect(keys).toContain('relatorios')
    expect(keys).toContain('reports_advanced')
    for (const c of getGateableCapabilities()) {
      expect(c.essential).toBe(false)
      expect(c.status).toBe('ga')
    }
  })

  it('toda capability tem label, benefitLabel e group não-vazios', () => {
    for (const c of CAPABILITY_REGISTRY) {
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.benefitLabel.length).toBeGreaterThan(0)
      expect(c.group.length).toBeGreaterThan(0)
    }
  })

  it('reaproveita os labels de nav do NAV_REGISTRY para as seções de navegação', () => {
    const agenda = getCapability('agenda')
    expect(agenda?.category).toBe('nav')
    expect(agenda?.label).toBe('Agenda')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/permissions/capability-registry.test.ts`
Expected: FAIL — módulo `./capability-registry` não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/permissions/capability-registry.ts
import { NAV_REGISTRY } from './nav-registry'

export type CapabilityCategory = 'nav' | 'capability' | 'report'
export type CapabilityStatus = 'ga' | 'soon'

export type Capability = {
  key: string
  label: string
  category: CapabilityCategory
  essential: boolean
  benefitLabel: string
  status: CapabilityStatus
  group: string
}

// Grupos de exibição usados no admin (features e limites compartilham os mesmos rótulos).
export const CAPABILITY_GROUPS = {
  ACESSO: 'Acesso & Equipe',
  OPERACAO: 'Operação',
  CATALOGO: 'Catálogo & Estoque',
  COMUNICACAO: 'Comunicação',
  CLIENTES: 'Clientes',
  RELATORIOS: 'Relatórios',
} as const

// Metadados de gating por chave de nav. As essenciais nunca podem ser desligadas.
const NAV_META: Record<string, { essential: boolean; benefitLabel: string; group: string }> = {
  agenda:        { essential: true,  benefitLabel: 'Agenda completa',            group: CAPABILITY_GROUPS.OPERACAO },
  servicos:      { essential: true,  benefitLabel: 'Serviços, pacotes e promoções', group: CAPABILITY_GROUPS.OPERACAO },
  clientes:      { essential: true,  benefitLabel: 'CRM de clientes',            group: CAPABILITY_GROUPS.CLIENTES },
  equipe:        { essential: true,  benefitLabel: 'Gestão de equipe',           group: CAPABILITY_GROUPS.ACESSO },
  configuracoes: { essential: true,  benefitLabel: 'Configurações',              group: CAPABILITY_GROUPS.ACESSO },
  produtos:      { essential: false, benefitLabel: 'Estoque de produtos',        group: CAPABILITY_GROUPS.CATALOGO },
  financeiro:    { essential: false, benefitLabel: 'Financeiro e caixa',         group: CAPABILITY_GROUPS.OPERACAO },
  relatorios:    { essential: false, benefitLabel: 'Relatórios',                 group: CAPABILITY_GROUPS.RELATORIOS },
}

// Capacidades (não-nav) gateáveis por plano.
const CAPABILITY_ENTRIES: Capability[] = [
  { key: 'whatsapp_basic',   label: 'WhatsApp Básico',    category: 'capability', essential: false, benefitLabel: 'WhatsApp automático',            status: 'ga', group: CAPABILITY_GROUPS.COMUNICACAO },
  { key: 'whatsapp_premium', label: 'WhatsApp Premium',   category: 'capability', essential: false, benefitLabel: 'WhatsApp premium (chatbot)',     status: 'ga', group: CAPABILITY_GROUPS.COMUNICACAO },
  { key: 'campaigns',        label: 'Campanhas',          category: 'capability', essential: false, benefitLabel: 'Campanhas de marketing',         status: 'ga', group: CAPABILITY_GROUPS.COMUNICACAO },
  { key: 'reports_advanced', label: 'Relatórios Avançados', category: 'capability', essential: false, benefitLabel: 'Relatórios avançados',        status: 'ga', group: CAPABILITY_GROUPS.RELATORIOS },
]

// Seções de navegação: derivadas do NAV_REGISTRY (chave/label) + metadados de gating.
const NAV_ENTRIES: Capability[] = NAV_REGISTRY.map((s) => {
  const meta = NAV_META[s.key] ?? { essential: false, benefitLabel: s.label, group: CAPABILITY_GROUPS.OPERACAO }
  return {
    key: s.key,
    label: s.label,
    category: 'nav' as const,
    essential: meta.essential,
    benefitLabel: meta.benefitLabel,
    status: 'ga' as const,
    group: meta.group,
  }
})

export const CAPABILITY_REGISTRY: Capability[] = [...NAV_ENTRIES, ...CAPABILITY_ENTRIES]

export const ESSENTIAL_KEYS: string[] = CAPABILITY_REGISTRY.filter((c) => c.essential).map((c) => c.key)

export function getCapability(key: string): Capability | undefined {
  return CAPABILITY_REGISTRY.find((c) => c.key === key)
}

export function isEssential(key: string): boolean {
  return getCapability(key)?.essential ?? false
}

export function getGateableCapabilities(): Capability[] {
  return CAPABILITY_REGISTRY.filter((c) => !c.essential && c.status === 'ga')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/permissions/capability-registry.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/shared/permissions/capability-registry.ts src/shared/permissions/capability-registry.test.ts
git commit -m "feat(planos): registry unificado de capacidades gateáveis por plano"
```

---

## Task 2: Enriquecer o registry de limites e remover max_units

**Files:**
- Modify: `src/shared/permissions/limit-registry.ts`
- Create: `src/shared/permissions/limit-registry.test.ts`
- Modify: `src/components/domain/billing/billing-plans-content.tsx:21-54` (remove linha `max_units`)

**Interfaces:**
- Consumes: `PlanName` de `@prisma/client`; `CAPABILITY_GROUPS` de `capability-registry.ts`.
- Produces:
  - `type LimitKind = 'hard' | 'soft'`
  - `type LimitMeta = { label: string; unit: string; benefitLabel: (value: number) => string; unlimitedThreshold: number; kind: LimitKind; group: string; defaults: Record<PlanName, number> }`
  - `LIMIT_REGISTRY: Record<string, LimitMeta>` (sem `max_units`)
  - `type LimitKey = keyof typeof LIMIT_REGISTRY`
  - `getLimitsByGroup(): Record<string, Array<[LimitKey, LimitMeta]>>`

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/permissions/limit-registry.test.ts
import { describe, it, expect } from 'vitest'
import { LIMIT_REGISTRY, getLimitsByGroup } from './limit-registry'

describe('limit-registry', () => {
  it('não contém mais max_units', () => {
    expect('max_units' in LIMIT_REGISTRY).toBe(false)
  })

  it('appointments_month é soft; users é hard', () => {
    expect(LIMIT_REGISTRY.max_appointments_month.kind).toBe('soft')
    expect(LIMIT_REGISTRY.max_users.kind).toBe('hard')
  })

  it('benefitLabel formata valor e "ilimitado" acima do threshold', () => {
    const m = LIMIT_REGISTRY.max_appointments_month
    expect(m.benefitLabel(300)).toBe('300 agendamentos/mês')
    expect(m.benefitLabel(m.unlimitedThreshold)).toBe('Agendamentos ilimitados')
  })

  it('getLimitsByGroup agrupa por categoria', () => {
    const groups = getLimitsByGroup()
    const acesso = groups['Acesso & Equipe']?.map(([k]) => k) ?? []
    expect(acesso).toContain('max_users')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/permissions/limit-registry.test.ts`
Expected: FAIL — `getLimitsByGroup` não existe e `max_units` ainda presente.

- [ ] **Step 3: Write minimal implementation**

Substituir o conteúdo de `src/shared/permissions/limit-registry.ts` por:

```ts
import { PlanName } from '@prisma/client'
import { CAPABILITY_GROUPS } from './capability-registry'

export type LimitKind = 'hard' | 'soft'

export type LimitMeta = {
  label: string
  unit: string
  benefitLabel: (value: number) => string
  unlimitedThreshold: number
  kind: LimitKind
  group: string
  defaults: Record<PlanName, number>
}

const UNLIMITED = 999999

function fmt(value: number): string {
  return value.toLocaleString('pt-BR')
}

export const LIMIT_REGISTRY: Record<string, LimitMeta> = {
  max_roles: {
    label: 'Máximo de cargos',
    unit: 'cargos',
    benefitLabel: (v) => (v >= 999 ? 'Cargos ilimitados' : `${fmt(v)} cargos`),
    unlimitedThreshold: 999,
    kind: 'hard',
    group: CAPABILITY_GROUPS.ACESSO,
    defaults: { FREE: 3, STARTER: 3, PRO: 5, ENTERPRISE: 999 },
  },
  max_users: {
    label: 'Máximo de usuários',
    unit: 'usuários',
    benefitLabel: (v) => (v >= 999 ? 'Profissionais ilimitados' : `Até ${fmt(v)} profissionais`),
    unlimitedThreshold: 999,
    kind: 'hard',
    group: CAPABILITY_GROUPS.ACESSO,
    defaults: { FREE: 2, STARTER: 5, PRO: 20, ENTERPRISE: 999 },
  },
  max_appointments_month: {
    label: 'Agendamentos/mês',
    unit: 'agend.',
    benefitLabel: (v) => (v >= UNLIMITED ? 'Agendamentos ilimitados' : `${fmt(v)} agendamentos/mês`),
    unlimitedThreshold: UNLIMITED,
    kind: 'soft',
    group: CAPABILITY_GROUPS.OPERACAO,
    defaults: { FREE: 50, STARTER: 300, PRO: 2000, ENTERPRISE: UNLIMITED },
  },
  max_whatsapp_month: {
    label: 'WhatsApp/mês',
    unit: 'msgs',
    benefitLabel: (v) => (v >= UNLIMITED ? 'WhatsApp ilimitado' : `${fmt(v)} mensagens WhatsApp/mês`),
    unlimitedThreshold: UNLIMITED,
    kind: 'hard',
    group: CAPABILITY_GROUPS.COMUNICACAO,
    defaults: { FREE: 0, STARTER: 500, PRO: 2000, ENTERPRISE: 5000 },
  },
  max_email_month: {
    label: 'E-mails/mês',
    unit: 'e-mails',
    benefitLabel: (v) => (v >= UNLIMITED ? 'E-mails ilimitados' : `${fmt(v)} e-mails/mês`),
    unlimitedThreshold: UNLIMITED,
    kind: 'hard',
    group: CAPABILITY_GROUPS.COMUNICACAO,
    defaults: { FREE: 100, STARTER: 500, PRO: 5000, ENTERPRISE: UNLIMITED },
  },
}

export type LimitKey = keyof typeof LIMIT_REGISTRY

export function getLimitsByGroup(): Record<string, Array<[LimitKey, LimitMeta]>> {
  const out: Record<string, Array<[LimitKey, LimitMeta]>> = {}
  for (const [key, meta] of Object.entries(LIMIT_REGISTRY) as Array<[LimitKey, LimitMeta]>) {
    ;(out[meta.group] ??= []).push([key, meta])
  }
  return out
}
```

> Nota: `max_services`, `max_products`, `max_customers` entram na **Fase D** (com enforcement). Aqui só a base.

- [ ] **Step 4: Remover a linha max_units do comparativo de planos**

Em `src/components/domain/billing/billing-plans-content.tsx`, na função `buildTableRows`, **remover** o objeto que começa em `{ label: 'Múltiplas unidades', ...}` (linhas ~46-52). O restante permanece.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/shared/permissions/limit-registry.test.ts && npx tsc --noEmit`
Expected: PASS nos testes e **zero erros** de tipo (o `LimitKey` deixa de ter `max_units`; nenhum consumidor deve referenciá-lo).

- [ ] **Step 6: Commit**

```bash
git add src/shared/permissions/limit-registry.ts src/shared/permissions/limit-registry.test.ts src/components/domain/billing/billing-plans-content.tsx
git commit -m "feat(planos): enriquece registry de limites (grupo/kind/benefitLabel) e remove max_units"
```

---

## Task 3: Ordem de planos derivada do banco

**Files:**
- Create: `src/domains/billing/plan-order.ts`
- Test: `src/domains/billing/plan-order.test.ts`

**Interfaces:**
- Consumes: `prisma.plan` (`@/shared/database/prisma`), `PlanName` de `@prisma/client`.
- Produces:
  - `getPlanOrder(): Promise<PlanName[]>` — ordenado por `Plan.displayOrder` asc; fallback `[FREE, STARTER, PRO, ENTERPRISE]` se o banco não retornar nada.
  - `comparePlans(a: PlanName, b: PlanName, order: PlanName[]): number` — negativo se `a` vem antes de `b`.

- [ ] **Step 1: Write the failing test**

```ts
// src/domains/billing/plan-order.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { getPlanOrder, comparePlans } from './plan-order'

describe('plan-order', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deriva a ordem de Plan.displayOrder', async () => {
    prismaMock.plan.findMany.mockResolvedValue([
      { name: PlanName.FREE }, { name: PlanName.STARTER },
      { name: PlanName.PRO }, { name: PlanName.ENTERPRISE },
    ] as any)
    expect(await getPlanOrder()).toEqual([
      PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE,
    ])
  })

  it('usa fallback quando o banco não retorna planos', async () => {
    prismaMock.plan.findMany.mockResolvedValue([] as any)
    expect(await getPlanOrder()).toEqual([
      PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE,
    ])
  })

  it('comparePlans respeita a ordem fornecida', () => {
    const order = [PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE]
    expect(comparePlans(PlanName.STARTER, PlanName.PRO, order)).toBeLessThan(0)
    expect(comparePlans(PlanName.ENTERPRISE, PlanName.FREE, order)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/billing/plan-order.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domains/billing/plan-order.ts
import { PlanName } from '@prisma/client'
import { prisma } from '@/shared/database/prisma'

const FALLBACK_ORDER: PlanName[] = [
  PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE,
]

export async function getPlanOrder(): Promise<PlanName[]> {
  const plans = await prisma.plan.findMany({
    orderBy: { displayOrder: 'asc' },
    select: { name: true },
  })
  if (plans.length === 0) return FALLBACK_ORDER
  return plans.map((p) => p.name)
}

export function comparePlans(a: PlanName, b: PlanName, order: PlanName[]): number {
  return order.indexOf(a) - order.indexOf(b)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/billing/plan-order.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domains/billing/plan-order.ts src/domains/billing/plan-order.test.ts
git commit -m "feat(planos): getPlanOrder derivado de Plan.displayOrder (fim do PLAN_ORDER hardcoded)"
```

---

## Task 4: resolveGate() no FeatureGuard

**Files:**
- Modify: `src/domains/billing/feature-guard.ts`
- Modify: `src/domains/billing/feature-guard.test.ts`

**Interfaces:**
- Consumes: `getPlanOrder` de `./plan-order`; `Plan` do banco (para `displayName`).
- Produces (novo método público no `FeatureGuard`):
  - `resolveGate(tenantId: string, feature: FeatureName): Promise<{ allowed: boolean; currentPlan: PlanName; requiredPlan: PlanName | null; requiredPlanLabel: string | null }>`
- Mantém: `canAccess`, `assertAccess`, `assertWithinLimit`, `getSubscriptionState`. O `PLAN_ORDER` local é **removido**; `findMinPlanForFeature` passa a usar `getPlanOrder()`.

- [ ] **Step 1: Write the failing test (adicionar ao describe existente)**

Adicionar em `src/domains/billing/feature-guard.test.ts` um novo bloco:

```ts
  describe('resolveGate', () => {
    it('permitido: allowed true e requiredPlan null', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: true } as any)
      const r = await guard.resolveGate(TENANT_ID, 'whatsapp_basic')
      expect(r.allowed).toBe(true)
      expect(r.requiredPlan).toBeNull()
    })

    it('bloqueado: aponta o menor plano que habilita a feature', async () => {
      prismaMock.planFeatureConfig.findFirst.mockResolvedValue({ enabled: false } as any)
      prismaMock.planFeatureConfig.findMany.mockResolvedValue([{ plan: PlanName.PRO } as any])
      prismaMock.plan.findMany.mockResolvedValue([
        { name: PlanName.FREE }, { name: PlanName.STARTER },
        { name: PlanName.PRO }, { name: PlanName.ENTERPRISE },
      ] as any)
      prismaMock.plan.findUnique.mockResolvedValue({ displayName: 'Pro' } as any)
      const r = await guard.resolveGate(TENANT_ID, 'reports_advanced')
      expect(r.allowed).toBe(false)
      expect(r.requiredPlan).toBe(PlanName.PRO)
      expect(r.requiredPlanLabel).toBe('Pro')
    })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/billing/feature-guard.test.ts`
Expected: FAIL — `resolveGate` não existe.

- [ ] **Step 3: Write minimal implementation**

Em `src/domains/billing/feature-guard.ts`:

1. Adicionar import: `import { getPlanOrder } from './plan-order'`.
2. **Remover** a linha `const PLAN_ORDER: PlanName[] = [...]`.
3. Trocar `findMinPlanForFeature` para usar a ordem derivada:

```ts
  private async findMinPlanForFeature(feature: FeatureName): Promise<PlanName | null> {
    const [configs, order] = await Promise.all([
      prisma.planFeatureConfig.findMany({
        where: { sectionKey: feature, enabled: true },
        select: { plan: true },
      }),
      getPlanOrder(),
    ])
    const enabledPlans = new Set(configs.map((c) => c.plan))
    return order.find((p) => enabledPlans.has(p)) ?? null
  }
```

4. Adicionar o método público `resolveGate`:

```ts
  async resolveGate(
    tenantId: string,
    feature: FeatureName,
  ): Promise<{
    allowed: boolean
    currentPlan: PlanName
    requiredPlan: PlanName | null
    requiredPlanLabel: string | null
  }> {
    const { plan: currentPlan } = await this.getSubscriptionState(tenantId)
    const allowed = await this.canAccess(tenantId, feature)
    if (allowed) {
      return { allowed: true, currentPlan, requiredPlan: null, requiredPlanLabel: null }
    }
    const requiredPlan = await this.findMinPlanForFeature(feature)
    const requiredPlanLabel = requiredPlan
      ? (await prisma.plan.findUnique({ where: { name: requiredPlan }, select: { displayName: true } }))?.displayName ?? null
      : null
    return { allowed: false, currentPlan, requiredPlan, requiredPlanLabel }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domains/billing/feature-guard.test.ts`
Expected: PASS (testes existentes + 2 novos de `resolveGate`).

- [ ] **Step 5: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/billing/feature-guard.ts src/domains/billing/feature-guard.test.ts
git commit -m "feat(planos): resolveGate() único e ordem de planos derivada no FeatureGuard"
```

---

## Task 5: Editor de planos do admin dirigido pelo registry

**Files:**
- Modify: `src/app/(admin)/admin/planos/[planName]/page.tsx`

**Interfaces:**
- Consumes: `CAPABILITY_REGISTRY`, `getCapability` de `capability-registry.ts`; `getLimitsByGroup` de `limit-registry.ts`.
- Produces: nenhuma nova API. Muda apenas a renderização do editor.

Objetivo: substituir os arrays literais `NAV_SECTIONS`/`BILLING_FEATURES`/`SECTION_LABELS` por dados do registry; **travar** o toggle das capabilities essenciais (mostrando selo "Essencial"); **agrupar** os limites por categoria (`getLimitsByGroup`).

- [ ] **Step 1: Substituir a fonte de features na aba "Funcionalidades"**

Remover as constantes locais `NAV_SECTIONS`, `BILLING_FEATURES` e `SECTION_LABELS` do topo do arquivo. Importar do registry:

```ts
import { CAPABILITY_REGISTRY, getCapability } from '@/shared/permissions/capability-registry'
import { LIMIT_REGISTRY, getLimitsByGroup } from '@/shared/permissions/limit-registry'
```

Derivar as listas por categoria (dentro do componente, antes do return):

```ts
const navCaps = CAPABILITY_REGISTRY.filter((c) => c.category === 'nav')
const otherCaps = CAPABILITY_REGISTRY.filter((c) => c.category === 'capability')
```

- [ ] **Step 2: Renderizar toggles com essenciais travados**

Substituir o corpo do `TabsContent value="features"` para usar `navCaps`/`otherCaps` e desabilitar o `Switch` quando `cap.essential`:

```tsx
<TabsContent value="features" className="mt-6">
  <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6">
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Navegação</p>
      {navCaps.map((cap) => (
        <div key={cap.key} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label>{cap.label}</Label>
            {cap.essential && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Essencial
              </span>
            )}
          </div>
          <Switch
            checked={cap.essential ? true : (featureState[cap.key] ?? false)}
            disabled={cap.essential}
            onCheckedChange={(v) => setFeatureState((s) => ({ ...s, [cap.key]: v }))}
          />
        </div>
      ))}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Capacidades</p>
      {otherCaps.map((cap) => (
        <div key={cap.key} className="flex items-center justify-between">
          <Label>{cap.label}</Label>
          <Switch
            checked={featureState[cap.key] ?? false}
            onCheckedChange={(v) => setFeatureState((s) => ({ ...s, [cap.key]: v }))}
          />
        </div>
      ))}
    </div>
    <Button onClick={handleSaveFeatures} disabled={updateFeatures.isPending} className="mt-6 bg-slate-950 text-white hover:bg-slate-800">
      {updateFeatures.isPending ? 'Salvando...' : 'Salvar funcionalidades'}
    </Button>
  </div>
</TabsContent>
```

> As essenciais são enviadas sempre como `enabled: true` (o `checked` é forçado). `handleSaveFeatures` continua serializando `featureState`; garantir que essenciais estejam `true` no estado inicial — no `useEffect` de features, após montar `featureState`, sobrescrever essenciais: `for (const c of CAPABILITY_REGISTRY) if (c.essential) next[c.key] = true`.

- [ ] **Step 3: Agrupar os limites por categoria na aba "Limites"**

Substituir o corpo do `TabsContent value="limits"` para iterar `getLimitsByGroup()`:

```tsx
<TabsContent value="limits" className="mt-6">
  <div className="max-w-lg space-y-6 rounded-xl border border-slate-200 bg-white p-6">
    {Object.entries(getLimitsByGroup()).map(([group, entries]) => (
      <div key={group} className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{group}</p>
        {entries.map(([key, meta]) => (
          <div key={key} className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Label className="w-full sm:w-48 sm:shrink-0">{meta.label}</Label>
            <Input
              type="number"
              min={0}
              className="w-28"
              value={limitState[key] ?? 0}
              onChange={(e) => setLimitState((s) => ({ ...s, [key]: parseInt(e.target.value) || 0 }))}
            />
            <span className="text-xs text-slate-400">{meta.unit} · {meta.unlimitedThreshold} = ilimitado</span>
          </div>
        ))}
      </div>
    ))}
    <Button onClick={handleSaveLimits} disabled={updateLimits.isPending} className="bg-slate-950 text-white hover:bg-slate-800">
      {updateLimits.isPending ? 'Salvando...' : 'Salvar limites'}
    </Button>
  </div>
</TabsContent>
```

- [ ] **Step 4: Typecheck + testes globais**

Run: `npx tsc --noEmit && npx vitest run`
Expected: zero erros de tipo; toda a suíte passando.

- [ ] **Step 5: Verificação manual (build da rota admin)**

Run: `npm run build`
Expected: build conclui sem erro. Conferir visualmente (se possível) que em `/admin/planos/STARTER`:
- As 5 seções essenciais aparecem com selo "Essencial" e toggle desabilitado (ligado).
- `Multi-unidade` **não** aparece mais.
- Os limites aparecem agrupados por categoria e `max_units` sumiu.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/admin/planos/[planName]/page.tsx"
git commit -m "feat(planos): editor de planos do admin dirigido pelo registry (essenciais travados, limites agrupados)"
```

---

## Verificação final da fase

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — toda a suíte verde
- [ ] `npm run build` — build ok
- [ ] Abrir PR para `main` com título `feat(planos): Fase 0 — fundação de configuração de planos e gating`

---

## Self-Review (cobertura do spec §3)

- §3.1 Registry unificado de capacidades → Task 1 ✅
- §3.2 Registry de limites enriquecido (kind/benefitLabel/unlimitedThreshold) → Task 2 ✅
- §3.3 Categorias de exibição no admin → Task 2 (`getLimitsByGroup`) + Task 5 (agrupamento na UI) ✅
- §3.4 Ordem de planos derivada do banco → Task 3 + Task 4 (remoção do `PLAN_ORDER` local) ✅
- §3.5 Resolvedor único `resolveGate` → Task 4 ✅
- Remoção de `multi_unit`/`max_units` das superfícies ativas → Task 1 (ausência no registry) + Task 2 (limit) + Task 5 (UI) ✅
- Essenciais com toggle travado → Task 1 (flag) + Task 5 (UI) ✅

> Fora desta fase (Fases A–D): `getPublicPlans`, `<FeatureLock>`, interceptor 402, relatórios granulares, novos limites com enforcement, widget de consumo, soft-limit runtime, downgrade guard, sinais de crescimento. O `billing-plans-content` e o `feature-guard` seguem consumindo `PLAN_ORDER` derivado; a substituição em `billing-plans-content` (que ainda tem `PLAN_ORDER` literal para lógica de upgrade) fica na Fase B, quando o componente for reformulado.
