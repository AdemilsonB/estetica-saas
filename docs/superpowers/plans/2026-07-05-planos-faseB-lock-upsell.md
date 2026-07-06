# Planos — Fase B (Padrão universal de bloqueio + upsell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o padrão universal de bloqueio + upsell: uma API de capacidades por plano, um `<FeatureLock>` reutilizável, um `UpgradeModal` reescrito (benefícios reais + proration + ação de checkout/portal), o menu lateral que **bloqueia em vez de esconder**, a vitrine de relatórios com upsell no lugar do redirect, um interceptor global de 402 → modal, e o registro de interesse (`CapabilityInterestLog`) que alimenta sinais de crescimento numa fase futura.

**Architecture:** `resolveGate` (Fase 0) alimenta um endpoint `GET /api/billing/capabilities` consumido pelo hook `useCapabilities`. Um store Zustand (`useUpgradeModal`) guarda o contexto do upsell fora da árvore React, para que tanto o `<FeatureLock>` quanto o interceptor global de 402 (no `QueryClient`) possam abrir o mesmo `<UpgradeModal>` (montado uma vez no `Providers`). O modal busca os benefícios do plano exigido via `/api/public/plans` (Fase A) e dispara checkout (Stripe Checkout) ou portal (Stripe Portal) conforme o tenant já tenha assinatura. Ao abrir a partir de um lock/402, grava `CapabilityInterestLog`. O menu passa a anotar seções bloqueadas (não filtrá-las). Um `ApiError` tipado no fetch preserva status/código para o interceptor.

**Tech Stack:** Next.js 15 App Router + TypeScript (strict), Prisma, Vitest (+ prismaMock), Shadcn UI, TanStack Query, Zustand.

## Global Constraints

- Todo output em **Português do Brasil** (código, comentários, commits, UI).
- TypeScript strict — sem `any`, sem `as unknown as`.
- Erros de domínio tipados de `src/shared/errors/` — nunca `throw new Error('string')` em código de produção novo.
- Multi-tenancy: `tenantId` sempre do token (`getSessionContext`), nunca do body/URL. Todo model novo com `@@index([tenantId])`.
- Recursos **essenciais** (`agenda`, `servicos`, `clientes`, `equipe`, `configuracoes`) nunca são bloqueados no menu.
- **Menu bloqueia, não esconde:** TODAS as seções gateáveis sem acesso (`produtos`, `financeiro`, `relatorios`) aparecem com selo "Disponível no plano {X}" (decisão do usuário).
- Fonte única de benefícios do modal = `/api/public/plans` (Fase A) — nunca bullets hardcoded.
- Copy de upgrade **sem ambiguidade**: imediato, proration, sem cobrança dupla, plano anterior substituído.
- Migration **apenas aditiva** (`CapabilityInterestLog`). **O ambiente bloqueia `prisma migrate deploy`** — criar a migration e deixar registrada para o usuário aplicar (mesmo padrão de sessões anteriores).
- Escopo desta fase: só **gravar** o interesse (`CapabilityInterestLog`). O painel de sinais de crescimento no admin (§8.3) fica para uma fase futura.
- Commits frequentes, um por task. Não commitar em `main`.

---

## File Structure

- **Modify** `prisma/schema.prisma` — model `CapabilityInterestLog` (aditivo).
- **Create** `prisma/migrations/<timestamp>_add_capability_interest_log/migration.sql` — migration aditiva.
- **Create** `src/domains/billing/capability-interest.service.ts` — grava interesse.
- **Create** `src/domains/billing/capability-interest.service.test.ts`.
- **Create** `src/app/api/billing/capability-interest/route.ts` — POST (registra interesse).
- **Create** `src/domains/billing/capabilities.service.ts` — `getTenantCapabilities()` (resolveGate por capacidade).
- **Create** `src/domains/billing/capabilities.service.test.ts`.
- **Create** `src/app/api/billing/capabilities/route.ts` — GET.
- **Create** `src/hooks/billing/use-capabilities.ts` — `useCapabilities`, `usePublicPlans`.
- **Create** `src/shared/http/api-fetch.ts` — `ApiError` + `apiFetch` (preserva status/código).
- **Create** `src/stores/upgrade-modal.store.ts` — store Zustand do modal.
- **Create** `src/hooks/billing/use-billing-actions.ts` — `startUpgrade(planName)` (portal/checkout).
- **Rewrite** `src/components/domain/billing/upgrade-modal.tsx` — modal dirigido por contexto/config.
- **Create** `src/components/domain/billing/global-upgrade-modal.tsx` — monta o modal a partir do store.
- **Create** `src/components/domain/billing/feature-lock.tsx` — `<FeatureLock>`.
- **Modify** `src/lib/providers.tsx` — QueryClient com interceptor 402 + `<GlobalUpgradeModal>`.
- **Modify** `src/app/api/iam/nav-sections/route.ts` — anota `locked`/`requiredPlan` em vez de filtrar.
- **Modify** `src/hooks/iam/use-nav-sections.ts` — tipo `NavSectionWithLock`.
- **Modify** `src/components/app/app-shell.tsx` — renderiza selo de bloqueio.
- **Modify** `src/app/(app)/relatorios/layout.tsx` — `<FeatureLock>` no lugar do `redirect`.
- **Modify** `src/shared/errors/domain-error.ts` — `PlanLimitError` ganha `capability?` no data (mapa limitType→capability).

Pré-requisito de branch (primeiro passo, antes da Task 1):

```bash
git checkout main && git pull --ff-only
git checkout -b feat/planos-faseB-lock-upsell
```

> **Ambiente conhecido:** `tsc --noEmit` acusa erros só sob `.next/**` (cache stale) — ignorar. `vitest run` completo tem ~7 falhas PRÉ-EXISTENTES (scheduling checkout atomicity, appointment-reminder, customer-history ×2, service-picker ×3) — não são regressão.

---

## Task 1: Model CapabilityInterestLog + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_capability_interest_log/migration.sql`

**Interfaces:**
- Produces: model `CapabilityInterestLog { id, tenantId, capabilityKey, createdAt }` com `@@index([capabilityKey])` e `@@index([tenantId])`.

- [ ] **Step 1: Adicionar o model ao schema**

Em `prisma/schema.prisma`, adicionar (perto dos demais models de billing):

```prisma
model CapabilityInterestLog {
  id            String   @id @default(cuid())
  tenantId      String
  capabilityKey String
  createdAt     DateTime @default(now())

  @@index([tenantId])
  @@index([capabilityKey])
}
```

- [ ] **Step 2: Validar o schema**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid".

- [ ] **Step 3: Gerar o client + criar a migration aditiva**

Run: `npx prisma generate`
Depois criar o arquivo `prisma/migrations/<timestamp>_add_capability_interest_log/migration.sql` (timestamp no formato `AAAAMMDDHHMMSS`) com:

```sql
-- CreateTable
CREATE TABLE "CapabilityInterestLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapabilityInterestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapabilityInterestLog_tenantId_idx" ON "CapabilityInterestLog"("tenantId");

-- CreateIndex
CREATE INDEX "CapabilityInterestLog_capabilityKey_idx" ON "CapabilityInterestLog"("capabilityKey");
```

> **Não** rodar `prisma migrate deploy`/`dev` (o ambiente bloqueia; banco de dev inacessível). Deixar a migration criada e registrar a pendência de aplicação no relatório (`prisma migrate deploy` / `migrate resolve --applied` pelo usuário antes de produção). É 100% aditiva.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` (ignorar `.next/`)
Expected: `PrismaClient` reconhece `prisma.capabilityInterestLog` — zero erros em `src/`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(planos): model aditivo CapabilityInterestLog (sinais de crescimento)"
```

---

## Task 2: Serviço + endpoint de registro de interesse

**Files:**
- Create: `src/domains/billing/capability-interest.service.ts`
- Test: `src/domains/billing/capability-interest.service.test.ts`
- Create: `src/app/api/billing/capability-interest/route.ts`

**Interfaces:**
- Consumes: `prisma`, `getCapability` de `@/shared/permissions/capability-registry`, `getSessionContext`.
- Produces: `logCapabilityInterest(tenantId: string, capabilityKey: string): Promise<void>` — só grava se a capability existe no registry (ignora chaves inválidas silenciosamente); `POST /api/billing/capability-interest`.

- [ ] **Step 1: Write the failing test**

```ts
// src/domains/billing/capability-interest.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { logCapabilityInterest } from './capability-interest.service'

describe('logCapabilityInterest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava o interesse para uma capability válida', async () => {
    await logCapabilityInterest('tenant-1', 'reports_advanced')
    expect(prismaMock.capabilityInterestLog.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', capabilityKey: 'reports_advanced' },
    })
  })

  it('ignora chave inexistente no registry (não grava)', async () => {
    await logCapabilityInterest('tenant-1', 'chave_invalida')
    expect(prismaMock.capabilityInterestLog.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/billing/capability-interest.service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domains/billing/capability-interest.service.ts
import { prisma } from '@/shared/database/prisma'
import { getCapability } from '@/shared/permissions/capability-registry'

/**
 * Registra o interesse de um tenant numa capacidade bloqueada (upsell).
 * Ignora silenciosamente chaves fora do registry — o log é sinal de crescimento,
 * não uma operação crítica, e não deve derrubar o fluxo do cliente.
 */
export async function logCapabilityInterest(tenantId: string, capabilityKey: string): Promise<void> {
  if (!getCapability(capabilityKey)) return
  await prisma.capabilityInterestLog.create({
    data: { tenantId, capabilityKey },
  })
}
```

```ts
// src/app/api/billing/capability-interest/route.ts
import { z } from 'zod'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { logCapabilityInterest } from '@/domains/billing/capability-interest.service'

const bodySchema = z.object({ capabilityKey: z.string().min(1) })

export async function POST(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const { capabilityKey } = bodySchema.parse(await request.json())
    await logCapabilityInterest(session.tenantId, capabilityKey)
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/billing/capability-interest.service.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domains/billing/capability-interest.service.ts src/domains/billing/capability-interest.service.test.ts src/app/api/billing/capability-interest/route.ts
git commit -m "feat(planos): registro de interesse em capacidade bloqueada (log + endpoint)"
```

---

## Task 3: Resolver de capacidades do tenant (serviço + endpoint + hooks)

**Files:**
- Create: `src/domains/billing/capabilities.service.ts`
- Test: `src/domains/billing/capabilities.service.test.ts`
- Create: `src/app/api/billing/capabilities/route.ts`
- Create: `src/hooks/billing/use-capabilities.ts`

**Interfaces:**
- Consumes: `getGateableCapabilities` de `@/shared/permissions/capability-registry`; `featureGuard.resolveGate` de `@/domains/billing/feature-guard` (Fase 0).
- Produces:
  - `type CapabilityStatus = { key: string; allowed: boolean; requiredPlan: string | null; requiredPlanLabel: string | null }`
  - `getTenantCapabilities(tenantId: string): Promise<CapabilityStatus[]>` — uma entrada por capacidade gateável.
  - `GET /api/billing/capabilities`
  - hooks `useCapabilities()` (mapa `Record<string, CapabilityStatus>`) e `usePublicPlans()` (`PublicPlan[]` de `/api/public/plans`).

- [ ] **Step 1: Write the failing test**

```ts
// src/domains/billing/capabilities.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName } from '@prisma/client'
import { getTenantCapabilities } from './capabilities.service'
import { featureGuard } from './feature-guard'

vi.mock('./feature-guard', async (orig) => {
  const mod = await orig<typeof import('./feature-guard')>()
  return { ...mod, featureGuard: { resolveGate: vi.fn() } }
})

describe('getTenantCapabilities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolve o gate de cada capacidade gateável', async () => {
    vi.mocked(featureGuard.resolveGate).mockResolvedValue({
      allowed: false, currentPlan: PlanName.STARTER, requiredPlan: PlanName.PRO, requiredPlanLabel: 'Pro',
    })
    const caps = await getTenantCapabilities('tenant-1')
    expect(caps.length).toBeGreaterThan(0)
    const reports = caps.find((c) => c.key === 'reports_advanced')
    expect(reports).toEqual({ key: 'reports_advanced', allowed: false, requiredPlan: 'PRO', requiredPlanLabel: 'Pro' })
    expect(featureGuard.resolveGate).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/billing/capabilities.service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domains/billing/capabilities.service.ts
import { getGateableCapabilities } from '@/shared/permissions/capability-registry'
import { featureGuard, type FeatureName } from './feature-guard'

export type CapabilityStatus = {
  key: string
  allowed: boolean
  requiredPlan: string | null
  requiredPlanLabel: string | null
}

export async function getTenantCapabilities(tenantId: string): Promise<CapabilityStatus[]> {
  const caps = getGateableCapabilities()
  return Promise.all(
    caps.map(async (cap) => {
      const gate = await featureGuard.resolveGate(tenantId, cap.key as FeatureName)
      return {
        key: cap.key,
        allowed: gate.allowed,
        requiredPlan: gate.requiredPlan,
        requiredPlanLabel: gate.requiredPlanLabel,
      }
    }),
  )
}
```

```ts
// src/app/api/billing/capabilities/route.ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { getTenantCapabilities } from '@/domains/billing/capabilities.service'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    const caps = await getTenantCapabilities(session.tenantId)
    return Response.json(caps)
  } catch (error) {
    return handleApiError(error)
  }
}
```

```ts
// src/hooks/billing/use-capabilities.ts
import { useQuery } from '@tanstack/react-query'
import type { CapabilityStatus } from '@/domains/billing/capabilities.service'
import type { PublicPlan } from '@/domains/billing/plan-catalog.service'

async function fetchCapabilities(): Promise<CapabilityStatus[]> {
  const res = await fetch('/api/billing/capabilities')
  if (!res.ok) throw new Error('Falha ao carregar capacidades')
  return res.json()
}

export function useCapabilities() {
  return useQuery({
    queryKey: ['billing', 'capabilities'],
    queryFn: fetchCapabilities,
    staleTime: 5 * 60 * 1000,
    select: (list): Record<string, CapabilityStatus> =>
      Object.fromEntries(list.map((c) => [c.key, c])),
  })
}

async function fetchPublicPlans(): Promise<PublicPlan[]> {
  const res = await fetch('/api/public/plans')
  if (!res.ok) throw new Error('Falha ao carregar planos')
  return res.json()
}

export function usePublicPlans() {
  return useQuery({
    queryKey: ['billing', 'public-plans'],
    queryFn: fetchPublicPlans,
    staleTime: 5 * 60 * 1000,
  })
}
```

> Nota: importar `type CapabilityStatus`/`type PublicPlan` de módulos de serviço (que importam prisma) num arquivo de hook client é seguro — são imports **só de tipo**, apagados na compilação. Use `import type`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/billing/capabilities.service.test.ts && npx tsc --noEmit` (ignorar `.next/`)
Expected: PASS; zero erros em `src/`.

- [ ] **Step 5: Commit**

```bash
git add src/domains/billing/capabilities.service.ts src/domains/billing/capabilities.service.test.ts src/app/api/billing/capabilities/route.ts src/hooks/billing/use-capabilities.ts
git commit -m "feat(planos): endpoint /api/billing/capabilities + hooks useCapabilities/usePublicPlans"
```

---

## Task 4: ApiError tipado + store do modal + ações de billing

**Files:**
- Create: `src/shared/http/api-fetch.ts`
- Create: `src/stores/upgrade-modal.store.ts`
- Create: `src/hooks/billing/use-billing-actions.ts`
- Test: `src/shared/http/api-fetch.test.ts`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number; code?: string; data?: unknown }`
  - `apiFetch(input, init?): Promise<Response>` — lança `ApiError` (com `code`/`data` do corpo) quando `!res.ok`.
  - `type UpgradeContext = { capabilityKey?: string; limitType?: string; requiredPlan?: string | null; requiredPlanLabel?: string | null }`
  - `useUpgradeModal` (Zustand): `{ open: boolean; context: UpgradeContext | null; openUpgrade(ctx): void; close(): void }`.
  - `useBillingActions(): { startUpgrade(planName: string): Promise<void>; isLoading: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/http/api-fetch.test.ts
import { describe, it, expect, vi } from 'vitest'
import { apiFetch, ApiError } from './api-fetch'

describe('apiFetch', () => {
  it('lança ApiError com status e code do corpo quando !ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'PLAN_LIMIT_EXCEEDED', message: 'x', details: { limitType: 'users' } } }), { status: 402 }),
    ))
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 402, code: 'PLAN_LIMIT_EXCEEDED' })
    vi.unstubAllGlobals()
  })

  it('retorna a Response quando ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    const res = await apiFetch('/x')
    expect(res.status).toBe(200)
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/http/api-fetch.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/http/api-fetch.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// handleApiError serializa como { error: { code, message, details } }
type ErrorBody = { error?: { code?: string; message?: string; details?: unknown } }

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.ok) return res
  let body: ErrorBody = {}
  try {
    body = (await res.clone().json()) as ErrorBody
  } catch {
    // corpo não-JSON: mantém body vazio
  }
  throw new ApiError(
    body.error?.message ?? `Erro ${res.status}`,
    res.status,
    body.error?.code,
    body.error?.details,
  )
}
```

```ts
// src/stores/upgrade-modal.store.ts
import { create } from 'zustand'

export type UpgradeContext = {
  capabilityKey?: string
  limitType?: string
  requiredPlan?: string | null
  requiredPlanLabel?: string | null
}

type UpgradeModalState = {
  open: boolean
  context: UpgradeContext | null
  openUpgrade: (context: UpgradeContext) => void
  close: () => void
}

export const useUpgradeModal = create<UpgradeModalState>((set) => ({
  open: false,
  context: null,
  openUpgrade: (context) => set({ open: true, context }),
  close: () => set({ open: false, context: null }),
}))
```

```ts
// src/hooks/billing/use-billing-actions.ts
'use client'

import { useState } from 'react'
import { toast } from 'sonner'

/**
 * Inicia um upgrade: se o tenant já tem assinatura Stripe, abre o Portal
 * (proration imediata); senão, abre o Checkout. Ambos redirecionam o browser.
 */
export function useBillingActions() {
  const [isLoading, setIsLoading] = useState(false)

  async function startUpgrade(planName: string): Promise<void> {
    setIsLoading(true)
    try {
      const origin = window.location.origin
      // 1) Tenta o Portal (tenant já assinante). O endpoint responde 200 com url ou erro.
      const portalRes = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: `${origin}/dashboard` }),
      })
      if (portalRes.ok) {
        const { url } = await portalRes.json()
        if (url) { window.location.href = url; return }
      }
      // 2) Fallback: Checkout direto do plano exigido.
      const checkoutRes = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          skipTrial: true,
          successUrl: `${origin}/dashboard?stripe=success`,
          cancelUrl: `${origin}/dashboard?stripe=cancelled`,
        }),
      })
      if (!checkoutRes.ok) {
        const err = await checkoutRes.json().catch(() => ({}))
        toast.error(err?.error?.message ?? 'Erro ao iniciar upgrade. Tente novamente.')
        return
      }
      const { checkoutUrl } = await checkoutRes.json()
      window.location.href = checkoutUrl
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return { startUpgrade, isLoading }
}
```

> **Verificar o contrato do Portal:** abrir `src/app/api/billing/portal/route.ts` e confirmar o corpo esperado (`returnUrl`) e o campo de resposta (`url`). Ajustar o `startUpgrade` para bater exatamente com o endpoint real; se o Portal exigir assinatura e responder erro quando não há, o `!portalRes.ok` cai no fallback de Checkout — comportamento desejado.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/http/api-fetch.test.ts && npx tsc --noEmit` (ignorar `.next/`)
Expected: PASS; zero erros em `src/`.

- [ ] **Step 5: Commit**

```bash
git add src/shared/http/api-fetch.ts src/shared/http/api-fetch.test.ts src/stores/upgrade-modal.store.ts src/hooks/billing/use-billing-actions.ts
git commit -m "feat(planos): ApiError tipado, store do upgrade e ações de billing (portal/checkout)"
```

---

## Task 5: UpgradeModal reescrito + montagem global

**Files:**
- Rewrite: `src/components/domain/billing/upgrade-modal.tsx`
- Create: `src/components/domain/billing/global-upgrade-modal.tsx`

**Interfaces:**
- Consumes: `useUpgradeModal` (store), `usePublicPlans` (hook), `useBillingActions`, `apiFetch` (para logar interesse).
- Produces:
  - `<UpgradeModal />` — sem props; lê tudo do store. Ao abrir com `context.capabilityKey`, faz `POST /api/billing/capability-interest`. Mostra benefícios reais do plano exigido (via `usePublicPlans`), a copy de proration, e o botão primário chamando `startUpgrade`.
  - `<GlobalUpgradeModal />` = alias que apenas renderiza `<UpgradeModal />` (montado uma vez no Providers).

- [ ] **Step 1: Reescrever o modal**

```tsx
// src/components/domain/billing/upgrade-modal.tsx
'use client'

import { useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'
import { usePublicPlans } from '@/hooks/billing/use-capabilities'
import { useBillingActions } from '@/hooks/billing/use-billing-actions'
import { getCapability } from '@/shared/permissions/capability-registry'

export function UpgradeModal() {
  const { open, context, close } = useUpgradeModal()
  const { data: plans } = usePublicPlans()
  const { startUpgrade, isLoading } = useBillingActions()

  // Registra interesse ao abrir a partir de um lock/402 (fire-and-forget).
  useEffect(() => {
    if (open && context?.capabilityKey) {
      fetch('/api/billing/capability-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityKey: context.capabilityKey }),
      }).catch(() => {})
    }
  }, [open, context?.capabilityKey])

  const requiredPlan = context?.requiredPlan ?? null
  const requiredPlanLabel = context?.requiredPlanLabel ?? 'um plano superior'
  const targetPlan = plans?.find((p) => p.name === requiredPlan) ?? null
  const capabilityLabel = context?.capabilityKey
    ? (getCapability(context.capabilityKey)?.label ?? 'este recurso')
    : 'este recurso'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Desbloqueie {capabilityLabel}</DialogTitle>
          <DialogDescription>
            Disponível no plano <Badge variant="secondary">{requiredPlanLabel}</Badge> ou superior.
          </DialogDescription>
        </DialogHeader>

        {targetPlan && targetPlan.benefits.length > 0 && (
          <ul className="space-y-1.5 text-sm text-slate-600">
            {targetPlan.benefits.slice(0, 6).map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-green-500" />
                {b}
              </li>
            ))}
          </ul>
        )}

        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          O upgrade é <span className="font-medium text-slate-700">imediato</span> — o recurso libera na hora.
          Você paga apenas a <span className="font-medium text-slate-700">diferença proporcional</span> (proration)
          do período atual; não há cobrança dupla. O plano anterior é substituído automaticamente.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={close} disabled={isLoading}>Agora não</Button>
          <Button
            onClick={() => requiredPlan && startUpgrade(requiredPlan)}
            disabled={isLoading || !requiredPlan}
            className="bg-slate-950 text-white hover:bg-slate-800"
          >
            {isLoading ? (<><Loader2 className="mr-2 size-4 animate-spin" />Redirecionando...</>) : `Fazer upgrade para ${requiredPlanLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

```tsx
// src/components/domain/billing/global-upgrade-modal.tsx
'use client'

import { UpgradeModal } from './upgrade-modal'

// Montado uma vez em Providers; o conteúdo vem do store useUpgradeModal.
export function GlobalUpgradeModal() {
  return <UpgradeModal />
}
```

> **Consumidores antigos do UpgradeModal:** procurar por `UpgradeModal` no projeto (`grep -rn "UpgradeModal" src`). Se algum componente montava `<UpgradeModal open=... feature=... requiredPlan=... />` com props, migrar para abrir via `useUpgradeModal().openUpgrade({ capabilityKey, requiredPlan, requiredPlanLabel })` e remover a montagem local (o modal agora é global). Registrar no relatório quais consumidores foram migrados.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (ignorar `.next/`)
Expected: zero erros em `src/` (incluindo consumidores migrados).

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/billing/upgrade-modal.tsx src/components/domain/billing/global-upgrade-modal.tsx
git commit -m "feat(planos): UpgradeModal dirigido por contexto (benefícios reais + proration + upgrade)"
```

---

## Task 6: Componente FeatureLock

**Files:**
- Create: `src/components/domain/billing/feature-lock.tsx`
- Test: `src/components/domain/billing/feature-lock.test.tsx`

**Interfaces:**
- Consumes: `useCapabilities`, `useUpgradeModal`.
- Produces: `<FeatureLock capability="..." mode?="overlay"|"badge">children</FeatureLock>`.
  - Permitido (ou capability desconhecida/carregando) → renderiza `children`.
  - Bloqueado, `mode="overlay"` (padrão) → `children` esmaecido (blur + `pointer-events-none`) + selo clicável "Disponível no plano {X}" que chama `openUpgrade`.
  - Bloqueado, `mode="badge"` → só o selo clicável (sem overlay), para itens de menu.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/domain/billing/feature-lock.test.tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FeatureLock } from './feature-lock'
import { useCapabilities } from '@/hooks/billing/use-capabilities'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'

vi.mock('@/hooks/billing/use-capabilities')
afterEach(cleanup)

describe('FeatureLock', () => {
  it('renderiza children quando permitido', () => {
    vi.mocked(useCapabilities).mockReturnValue({ data: { reports_advanced: { key: 'reports_advanced', allowed: true, requiredPlan: null, requiredPlanLabel: null } } } as never)
    render(<FeatureLock capability="reports_advanced"><p>Conteúdo</p></FeatureLock>)
    expect(screen.getByText('Conteúdo')).toBeInTheDocument()
    expect(screen.queryByText(/Disponível no plano/)).not.toBeInTheDocument()
  })

  it('bloqueado: mostra selo e abre o modal ao clicar', () => {
    vi.mocked(useCapabilities).mockReturnValue({ data: { reports_advanced: { key: 'reports_advanced', allowed: false, requiredPlan: 'PRO', requiredPlanLabel: 'Pro' } } } as never)
    render(<FeatureLock capability="reports_advanced"><p>Conteúdo</p></FeatureLock>)
    const selo = screen.getByText(/Disponível no plano Pro/)
    expect(selo).toBeInTheDocument()
    fireEvent.click(selo)
    expect(useUpgradeModal.getState().open).toBe(true)
    expect(useUpgradeModal.getState().context?.capabilityKey).toBe('reports_advanced')
    useUpgradeModal.getState().close()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/domain/billing/feature-lock.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/domain/billing/feature-lock.tsx
'use client'

import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCapabilities } from '@/hooks/billing/use-capabilities'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'

type FeatureLockProps = {
  capability: string
  mode?: 'overlay' | 'badge'
  children: ReactNode
}

export function FeatureLock({ capability, mode = 'overlay', children }: FeatureLockProps) {
  const { data } = useCapabilities()
  const openUpgrade = useUpgradeModal((s) => s.openUpgrade)

  const cap = data?.[capability]
  // Enquanto carrega ou se a capability não é gateável, não bloqueia.
  if (!cap || cap.allowed) return <>{children}</>

  const label = cap.requiredPlanLabel ?? 'um plano superior'
  const selo = (
    <button
      type="button"
      onClick={() => openUpgrade({ capabilityKey: capability, requiredPlan: cap.requiredPlan, requiredPlanLabel: cap.requiredPlanLabel })}
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
    >
      <Lock className="size-3" />
      Disponível no plano {label}
    </button>
  )

  if (mode === 'badge') return selo

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm" aria-hidden>{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">{selo}</div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/domain/billing/feature-lock.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/billing/feature-lock.tsx src/components/domain/billing/feature-lock.test.tsx
git commit -m "feat(planos): componente FeatureLock (overlay/badge) com upsell"
```

---

## Task 7: Menu bloqueia (não esconde)

**Files:**
- Modify: `src/app/api/iam/nav-sections/route.ts`
- Modify: `src/hooks/iam/use-nav-sections.ts`
- Modify: `src/components/app/app-shell.tsx`

**Interfaces:**
- A API passa a retornar TODAS as seções que o cargo permite, cada uma anotada: `{ ...NavSection, locked: boolean, requiredPlan: string | null, requiredPlanLabel: string | null }`. Essenciais nunca `locked`.

- [ ] **Step 1: Anotar bloqueio na API (em vez de filtrar)**

Reescrever `src/app/api/iam/nav-sections/route.ts` para, em vez de `NAV_REGISTRY.filter(...)`, mapear cada seção com `resolveGate` para as gateáveis. Usar `isEssential`/`getGateableCapabilities` do capability-registry para saber quais podem bloquear.

```ts
import { NAV_REGISTRY } from '@/shared/permissions/nav-registry'
import { isEssential } from '@/shared/permissions/capability-registry'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { featureGuard, type FeatureName } from '@/domains/billing/feature-guard'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)

    const sections = await Promise.all(
      NAV_REGISTRY.map(async (s) => {
        // Essenciais nunca bloqueiam.
        if (isEssential(s.key)) {
          return { ...s, locked: false, requiredPlan: null, requiredPlanLabel: null }
        }
        const gate = await featureGuard.resolveGate(session.tenantId, s.key as FeatureName)
        return {
          ...s,
          locked: !gate.allowed,
          requiredPlan: gate.requiredPlan,
          requiredPlanLabel: gate.requiredPlanLabel,
        }
      }),
    )

    return Response.json(sections)
  } catch (error) {
    return handleApiError(error)
  }
}
```

> **Preservar o filtro por cargo (RBAC), se existir.** Antes de editar, LER `app-shell.tsx` e `use-nav-sections.ts` para confirmar onde as permissões de cargo do usuário filtram as seções. Se o app-shell já filtra por permissão do usuário (RBAC) a partir desta lista, manter esse comportamento — esta task só adiciona a anotação de bloqueio POR PLANO; não deve passar a expor seções que o CARGO não permite. Se a filtragem por cargo acontecia implicitamente aqui, replicá-la (a lista deve conter só seções que o cargo vê, cada uma anotada com o lock de plano).

- [ ] **Step 2: Atualizar o tipo do hook**

Em `src/hooks/iam/use-nav-sections.ts`, trocar o tipo de retorno:

```ts
import { useQuery } from '@tanstack/react-query'
import type { NavSection } from '@/shared/permissions/nav-registry'

export type NavSectionWithLock = NavSection & {
  locked: boolean
  requiredPlan: string | null
  requiredPlanLabel: string | null
}

async function fetchNavSections(): Promise<NavSectionWithLock[]> {
  const res = await fetch('/api/iam/nav-sections')
  if (!res.ok) throw new Error('Falha ao carregar seções')
  return res.json()
}

export function useNavSections() {
  return useQuery({
    queryKey: ['nav-sections'],
    queryFn: fetchNavSections,
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 3: Renderizar o selo no app-shell**

Em `src/components/app/app-shell.tsx`, no ponto onde as seções do menu são renderizadas a partir de `useNavSections`: para uma seção com `locked === true`, renderizar o item como não-navegável com o selo "Disponível no plano {requiredPlanLabel}" (usar `<FeatureLock capability={section.key} mode="badge">` OU um selo inline consistente). Clicar no item bloqueado abre o `UpgradeModal` (via `useUpgradeModal().openUpgrade({ capabilityKey: section.key, requiredPlan, requiredPlanLabel })`) em vez de navegar. Itens não bloqueados seguem navegando normalmente. LER o trecho de render atual e integrar de forma mínima, preservando o layout mobile/desktop e o estado ativo.

- [ ] **Step 4: Typecheck + build da rota**

Run: `npx tsc --noEmit` (ignorar `.next/`)
Expected: zero erros em `src/`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/iam/nav-sections/route.ts" src/hooks/iam/use-nav-sections.ts src/components/app/app-shell.tsx
git commit -m "feat(planos): menu lateral bloqueia seções sem acesso (selo) em vez de escondê-las"
```

---

## Task 8: Relatórios — FeatureLock no lugar do redirect

**Files:**
- Modify: `src/app/(app)/relatorios/layout.tsx`

- [ ] **Step 1: Trocar redirect por render bloqueado**

Remover o `redirect('/agenda')` e a checagem server-side de acesso; envolver o conteúdo com `<FeatureLock capability="relatorios">` (client). O layout continua renderizando o cabeçalho e a sidebar; o `children` fica dentro do lock.

```tsx
import type { ReactNode } from 'react'
import { ReportsSidebar } from '@/components/domain/reports/reports-sidebar'
import { FeatureLock } from '@/components/domain/billing/feature-lock'

export default function RelatoriosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Relatórios</h1>
        <p className="mt-1 text-sm text-slate-500">Análises detalhadas do seu negócio</p>
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <aside className="w-full md:w-52 md:shrink-0">
          <ReportsSidebar />
        </aside>
        <div className="min-w-0 flex-1">
          <FeatureLock capability="relatorios">{children}</FeatureLock>
        </div>
      </div>
    </div>
  )
}
```

> O layout deixa de ser `async` e some com `getServerTenantId`/`prisma`/`featureGuard`. O bloqueio agora é client-side via `useCapabilities`. Como `relatorios` também é uma seção de nav bloqueada no menu (Task 7), o usuário sem acesso vê a vitrine bloqueada com upsell em vez de ser expulso para `/agenda`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (ignorar `.next/`)
Expected: zero erros em `src/`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/relatorios/layout.tsx"
git commit -m "feat(planos): relatórios mostram vitrine bloqueada com upsell (fim do redirect)"
```

---

## Task 9: Interceptor global de 402 + montagem no Providers

**Files:**
- Modify: `src/lib/providers.tsx`
- Modify: `src/shared/errors/domain-error.ts`

**Interfaces:**
- `PlanLimitError` ganha `capability?: string` no `details` (mapa `limitType → capability`) para o interceptor apontar o plano exigido.
- `QueryClient` ganha `MutationCache`/`QueryCache` com `onError` que, ao receber um `ApiError` 402 `PLAN_LIMIT_EXCEEDED`, abre o `UpgradeModal` via store.
- `<GlobalUpgradeModal />` montado dentro do `Providers`.

- [ ] **Step 1: Enriquecer PlanLimitError com a capability associada**

Em `src/shared/errors/domain-error.ts`, no `PlanLimitError`, incluir a capability associada no `details` (mapa de `limitType` → chave de capability/limite):

```ts
const LIMIT_TYPE_TO_CAPABILITY: Record<string, string> = {
  users: 'equipe',
  appointments_month: 'agenda',
  // demais limites entram na Fase D
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
      { limitType, limit, current, capability: LIMIT_TYPE_TO_CAPABILITY[limitType] ?? null },
    );
  }
}
```

> Como `users`/`appointments_month` mapeiam para seções essenciais (nunca bloqueadas no menu), o modal de 402 não terá `requiredPlan` de capability essencial — o interceptor abre o modal em modo "limite atingido" com o contexto de `{ limitType }`; o upsell do plano é resolvido pela lista de planos (`usePublicPlans`) mostrando o próximo tier. Os limites com capability gateável real chegam na Fase D; o mecanismo já fica pronto.

- [ ] **Step 2: Interceptor no QueryClient + montagem do modal**

Reescrever `src/lib/providers.tsx`:

```tsx
'use client'

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import { ApiError } from '@/shared/http/api-fetch'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'
import { GlobalUpgradeModal } from '@/components/domain/billing/global-upgrade-modal'

const ReactQueryDevtools =
  process.env.NODE_ENV !== 'production'
    ? dynamic(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })), { ssr: false })
    : () => null

function handlePlanLimit(error: unknown) {
  if (error instanceof ApiError && error.status === 402 && error.code === 'PLAN_LIMIT_EXCEEDED') {
    const data = (error.data ?? {}) as { limitType?: string }
    useUpgradeModal.getState().openUpgrade({ limitType: data.limitType })
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
        queryCache: new QueryCache({ onError: handlePlanLimit }),
        mutationCache: new MutationCache({ onError: handlePlanLimit }),
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <GlobalUpgradeModal />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

> **Pré-requisito de captura do 402:** o interceptor só dispara se a mutation/query lançar um `ApiError` (não um `Error` genérico). As mutations que aplicam limites (ex.: criar agendamento, convidar usuário) precisam usar `apiFetch` (Task 4) em vez do `fetch` + `throw new Error`. Nesta task, migrar para `apiFetch` **apenas** os pontos que hoje podem retornar 402 `PLAN_LIMIT_EXCEEDED`: procurar por `assertWithinLimit` no backend para achar as rotas que lançam `PlanLimitError`, e migrar os hooks/fetches correspondentes no frontend (ex.: criação de agendamento e convite de membro). Listar no relatório quais fetches foram migrados. Demais fetches podem migrar em fases futuras — não é necessário migrar o projeto inteiro agora.

- [ ] **Step 3: Typecheck + testes globais**

Run: `npx tsc --noEmit && npx vitest run` (ignorar `.next/`; as ~7 falhas pré-existentes não contam)
Expected: zero erros de tipo em `src/`; nenhuma falha NOVA.

- [ ] **Step 4: Verificação manual (build)**

Run: `npm run build`
Expected: compila e faz typecheck sem erro (a etapa "Collecting page data" pode falhar por falta de credenciais Supabase no sandbox — limitação de ambiente, não regressão). Conferir visualmente, se possível: seções bloqueadas no menu com selo; `/relatorios` sem acesso mostra vitrine bloqueada; um 402 abre o modal.

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers.tsx src/shared/errors/domain-error.ts <hooks migrados p/ apiFetch>
git commit -m "feat(planos): interceptor global de 402 → UpgradeModal + montagem global do modal"
```

---

## Verificação final da fase

- [ ] `npx tsc --noEmit` — zero erros em `src/` (ignorar `.next/`)
- [ ] `npx vitest run` — sem falha NOVA (as ~7 pré-existentes permanecem)
- [ ] `npm run build` — compila/typecheck ok (page data pode falhar por env do sandbox)
- [ ] Migration `CapabilityInterestLog` criada e **pendência de `prisma migrate deploy` registrada** para o usuário (o ambiente bloqueia a aplicação)
- [ ] Abrir PR para `main` com título `feat(planos): Fase B — bloqueio universal + upsell + interceptor 402`

---

## Self-Review (cobertura do spec §5 + §8.3-parcial + §10)

- §5.1 API de capacidades + `useCapabilities` → Task 3 ✅
- §5.2 `<FeatureLock>` (overlay + `mode="badge"`) + registra interesse ao abrir → Task 6 (lock) + Task 5 (log no modal) ✅
- §5.3 `UpgradeModal` reescrito (benefícios reais via getPublicPlans, proration, checkout/portal, fim do WhatsApp placeholder/rota errada) → Task 5 + Task 4 ✅
- §5.4 menu bloqueia (todas as gateáveis) → Task 7 ✅; relatórios com upsell no lugar do redirect → Task 8 ✅; interceptor global 402 → Task 9 ✅
- §8.3 (parcial, decisão do usuário) `CapabilityInterestLog` + gravação; painel admin fica para depois → Tasks 1, 2, 5 ✅
- §10 `PlanLimitError` com capability no data para o interceptor mapear → Task 9 ✅

> Fora desta fase: painel de sinais de crescimento no admin (§8.3 leitura); migração de TODOS os fetches para `apiFetch` (só os pontos de 402 nesta fase); relatórios granulares (Fase C); novos limites/soft-limit/widget (Fase D). Decisões ainda abertas p/ fases futuras: folga de cortesia soft-limit; reconciliação `reports_advanced` × relatórios granulares (Fase C).
