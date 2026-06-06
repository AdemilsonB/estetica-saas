# Track B — Stripe Billing, Página de Planos e Onboarding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que tenants contratem e paguem pelos planos do sistema via Stripe, com página pública de preços e onboarding com seleção de plano.

**Architecture:** Stripe Billing com Subscriptions. Checkout via Stripe-hosted page (sem PCI scope). Webhook para sincronização de estado. Stripe Customer criado no onboarding (mesmo sem cobrança). Portal de billing para autoatendimento do tenant. Página de planos em SSR com dados do banco.

**Tech Stack:** `stripe@^14`, Next.js 15 App Router, Prisma, Zod.

**Spec de referência:** `docs/superpowers/specs/2026-06-06-producao-completa-master-spec.md` seção 3 (B1, B2, B3)

---

## Pré-requisito: Conta Stripe

Antes de iniciar: criar conta Stripe, criar 3 Products (STARTER, PRO, ENTERPRISE) com um Price mensal cada, e copiar os Price IDs para as env vars.

```env
STRIPE_SECRET_KEY=sk_test_...          # usar sk_test_ em desenvolvimento
STRIPE_WEBHOOK_SECRET=whsec_...        # gerado após criar o endpoint de webhook
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Mapa de Arquivos

### Criar
```
src/domains/billing/stripe.client.ts           ← instância singleton do Stripe SDK
src/domains/billing/stripe-billing.service.ts  ← createCheckoutSession, createPortalSession
src/app/api/billing/checkout/route.ts          ← POST: cria Checkout Session
src/app/api/billing/portal/route.ts            ← POST: cria portal session
src/app/api/billing/stripe/webhook/route.ts    ← POST: webhook Stripe
src/app/(public)/planos/page.tsx               ← pricing page SSR
src/components/domain/billing/plan-card.tsx    ← card de plano reutilizável
src/hooks/use-subscription.ts                  ← dados da subscription atual
```

### Modificar
```
prisma/schema.prisma                           ← campos Stripe em Subscription
src/domains/billing/billing.service.ts         ← integrar changePlan com Stripe
src/domains/billing/billing.repository.ts      ← findByStripeCustomerId, findByStripeSubId
src/app/(auth)/onboarding/page.tsx             ← step 2 de seleção de plano
src/app/(app)/configuracoes/planos/page.tsx    ← botão upgrade, botão portal, status
package.json                                   ← stripe@^14
```

---

## Task 1: Instalar Stripe e Atualizar Schema

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Instalar Stripe SDK**

```bash
npm install stripe@^14
```

Verificar instalação:
```bash
node -e "require('stripe'); console.log('OK')"
```

Esperado: `OK`

- [ ] **Step 2: Adicionar campos Stripe ao model Subscription**

Em `prisma/schema.prisma`, no model `Subscription`, adicione após `externalId`:

```prisma
  stripeCustomerId  String? @unique
  stripeSubId       String? @unique
  stripePriceId     String?
  cancelAtPeriodEnd Boolean @default(false)
```

- [ ] **Step 3: Executar migration**

```bash
npx prisma migrate dev --name track_b_stripe_campos
npx prisma generate
```

Esperado: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json prisma/
git commit -m "feat(billing): instala stripe@^14 e adiciona campos Stripe ao Subscription"
```

---

## Task 2: Stripe Client e BillingRepository

**Files:**
- Create: `src/domains/billing/stripe.client.ts`
- Modify: `src/domains/billing/billing.repository.ts`

- [ ] **Step 1: Criar instância singleton do Stripe**

Crie `src/domains/billing/stripe.client.ts`:

```typescript
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY não configurada.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
})
```

- [ ] **Step 2: Adicionar métodos Stripe ao BillingRepository**

Em `src/domains/billing/billing.repository.ts`, adicione:

```typescript
async findByStripeCustomerId(stripeCustomerId: string) {
  return prisma.subscription.findFirst({ where: { stripeCustomerId } })
}

async findByStripeSubId(stripeSubId: string) {
  return prisma.subscription.findFirst({
    where: { stripeSubId },
    include: { tenant: { select: { id: true, plan: true } } },
  })
}

async setStripeIds(tenantId: string, data: {
  stripeCustomerId?: string
  stripeSubId?: string
  stripePriceId?: string
  cancelAtPeriodEnd?: boolean
}) {
  return prisma.subscription.update({
    where: { tenantId },
    data,
  })
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/billing/
git commit -m "feat(billing): Stripe singleton client e métodos de lookup/update por ID Stripe"
```

---

## Task 3: StripeBillingService

**Files:**
- Create: `src/domains/billing/stripe-billing.service.ts`

- [ ] **Step 1: Escrever teste para StripeBillingService**

Crie `src/domains/billing/__tests__/stripe-billing.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StripeBillingService } from '../stripe-billing.service'

// Mock do Stripe
vi.mock('../stripe.client', () => ({
  stripe: {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
      retrieve: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }),
      },
    },
  },
}))

vi.mock('../billing.repository', () => ({
  billingRepository: {
    getSubscription: vi.fn().mockResolvedValue({ stripeCustomerId: null, stripeSubId: null }),
    setStripeIds: vi.fn().mockResolvedValue({}),
  },
}))

const service = new StripeBillingService()

describe('StripeBillingService', () => {
  it('deve criar Checkout Session e retornar URL', async () => {
    const result = await service.createCheckoutSession({
      tenantId: 't1',
      ownerEmail: 'owner@test.com',
      ownerName: 'Owner',
      planName: 'PRO',
    })
    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test')
  })

  it('deve criar Portal Session e retornar URL', async () => {
    vi.mocked(require('../billing.repository').billingRepository.getSubscription).mockResolvedValue({
      stripeCustomerId: 'cus_test123',
    })
    const result = await service.createPortalSession({ tenantId: 't1' })
    expect(result.portalUrl).toBe('https://billing.stripe.com/test')
  })
})
```

- [ ] **Step 2: Rodar teste e confirmar falha**

```bash
npx vitest run src/domains/billing/__tests__/stripe-billing.service.test.ts
```

Esperado: `FAIL` — `StripeBillingService` não existe.

- [ ] **Step 3: Implementar StripeBillingService**

Crie `src/domains/billing/stripe-billing.service.ts`:

```typescript
import { PlanName } from '@prisma/client'
import { stripe } from './stripe.client'
import { billingRepository } from './billing.repository'
import { AppError } from '@/shared/errors/app-error'

const PRICE_MAP: Partial<Record<PlanName, string>> = {
  STARTER: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
  PRO: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY!,
}

export class StripeBillingService {
  async getOrCreateStripeCustomer(params: {
    tenantId: string
    ownerEmail: string
    ownerName: string
  }): Promise<string> {
    const sub = await billingRepository.getSubscription(params.tenantId)

    if (sub?.stripeCustomerId) return sub.stripeCustomerId

    const customer = await stripe.customers.create({
      email: params.ownerEmail,
      name: params.ownerName,
      metadata: { tenantId: params.tenantId },
    })

    await billingRepository.setStripeIds(params.tenantId, { stripeCustomerId: customer.id })
    return customer.id
  }

  async createCheckoutSession(params: {
    tenantId: string
    ownerEmail: string
    ownerName: string
    planName: PlanName
  }): Promise<{ checkoutUrl: string }> {
    const priceId = PRICE_MAP[params.planName]
    if (!priceId) throw new AppError(`Plano ${params.planName} não tem price configurado.`, 'INVALID_PLAN', 400)

    const customerId = await this.getOrCreateStripeCustomer({
      tenantId: params.tenantId,
      ownerEmail: params.ownerEmail,
      ownerName: params.ownerName,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/configuracoes/planos?stripe=success`,
      cancel_url: `${appUrl}/configuracoes/planos?stripe=cancelled`,
      metadata: { tenantId: params.tenantId, planName: params.planName },
    })

    if (!session.url) throw new AppError('Falha ao criar sessão de checkout.', 'STRIPE_ERROR', 500)
    return { checkoutUrl: session.url }
  }

  async createPortalSession(params: { tenantId: string }): Promise<{ portalUrl: string }> {
    const sub = await billingRepository.getSubscription(params.tenantId)
    if (!sub?.stripeCustomerId) {
      throw new AppError('Tenant não tem cadastro no Stripe.', 'NO_STRIPE_CUSTOMER', 400)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/configuracoes/planos`,
    })

    return { portalUrl: session.url }
  }
}

export const stripeBillingService = new StripeBillingService()
```

- [ ] **Step 4: Rodar teste e confirmar aprovação**

```bash
npx vitest run src/domains/billing/__tests__/stripe-billing.service.test.ts
```

Esperado: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add src/domains/billing/stripe-billing.service.ts src/domains/billing/__tests__/stripe-billing.service.test.ts
git commit -m "feat(billing): StripeBillingService — checkout session e portal session"
```

---

## Task 4: API Routes de Billing (Checkout e Portal)

**Files:**
- Create: `src/app/api/billing/checkout/route.ts`
- Create: `src/app/api/billing/portal/route.ts`

- [ ] **Step 1: Criar rota de checkout**

Crie `src/app/api/billing/checkout/route.ts`:

```typescript
import { z } from 'zod'
import { PlanName } from '@prisma/client'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/errors/handle-api-error'
import { stripeBillingService } from '@/domains/billing/stripe-billing.service'
import { iamRepository } from '@/domains/iam/iam.repository'

const CheckoutSchema = z.object({
  planName: z.enum(['STARTER', 'PRO', 'ENTERPRISE']),
})

export async function POST(req: Request) {
  try {
    const { tenantId, userId } = await getSessionContext(req)
    const body = await req.json()
    const { planName } = CheckoutSchema.parse(body)

    // Buscar email do owner para criar Stripe Customer
    const user = await iamRepository.findUserById(tenantId, userId)
    if (!user) throw new Error('Usuário não encontrado')

    const result = await stripeBillingService.createCheckoutSession({
      tenantId,
      ownerEmail: user.email,
      ownerName: user.name,
      planName: planName as PlanName,
    })

    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar rota de portal**

Crie `src/app/api/billing/portal/route.ts`:

```typescript
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/errors/handle-api-error'
import { stripeBillingService } from '@/domains/billing/stripe-billing.service'

export async function POST(req: Request) {
  try {
    const { tenantId } = await getSessionContext(req)
    const result = await stripeBillingService.createPortalSession({ tenantId })
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/billing/
git commit -m "feat(api): rotas de checkout e portal Stripe"
```

---

## Task 5: Webhook Stripe

**Files:**
- Create: `src/app/api/billing/stripe/webhook/route.ts`

- [ ] **Step 1: Implementar webhook handler**

Crie `src/app/api/billing/stripe/webhook/route.ts`:

```typescript
import { PlanName, SubscriptionStatus } from '@prisma/client'
import Stripe from 'stripe'
import { stripe } from '@/domains/billing/stripe.client'
import { billingRepository } from '@/domains/billing/billing.repository'
import { billingService } from '@/domains/billing/billing.service'

// NOTA App Router: req.text() já funciona sem desabilitar body parser.
// NÃO adicionar `export const config` — isso é sintaxe do Pages Router.

const PRICE_TO_PLAN: Record<string, PlanName> = {
  [process.env.STRIPE_PRICE_STARTER_MONTHLY!]: 'STARTER',
  [process.env.STRIPE_PRICE_PRO_MONTHLY!]: 'PRO',
  [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY!]: 'ENTERPRISE',
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Assinatura inválida.' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return Response.json({ error: 'Webhook inválido.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata.tenantId
        if (!tenantId) break

        const priceId = sub.items.data[0]?.price.id
        const planName: PlanName = PRICE_TO_PLAN[priceId] ?? 'STARTER'
        const status: SubscriptionStatus =
          sub.status === 'active' ? 'ACTIVE' :
          sub.status === 'trialing' ? 'TRIALING' :
          sub.status === 'past_due' ? 'PAST_DUE' :
          sub.status === 'canceled' ? 'CANCELLED' : 'EXPIRED'

        await billingRepository.setStripeIds(tenantId, {
          stripeSubId: sub.id,
          stripePriceId: priceId,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })

        await billingService.changePlan(tenantId, planName, status, 'stripe-webhook', event.type)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata.tenantId
        if (!tenantId) break
        await billingService.changePlan(tenantId, 'FREE', 'CANCELLED', 'stripe-webhook', 'subscription_deleted')
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const sub = await billingRepository.findByStripeSubId(invoice.subscription as string)
        if (!sub) break
        await billingService.changePlan(sub.tenantId, sub.plan, 'PAST_DUE', 'stripe-webhook', 'payment_failed')
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const existingSub = await billingRepository.findByStripeSubId(invoice.subscription as string)
        if (!existingSub || existingSub.status !== 'PAST_DUE') break
        await billingService.changePlan(existingSub.tenantId, existingSub.plan, 'ACTIVE', 'stripe-webhook', 'payment_succeeded')
        break
      }
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return Response.json({ error: 'Erro interno no webhook.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Testar webhook com Stripe CLI (desenvolvimento)**

Instale o Stripe CLI se não tiver: https://stripe.com/docs/stripe-cli

```bash
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
```

Em outro terminal, dispare um evento de teste:
```bash
stripe trigger customer.subscription.created
```

Esperado: no terminal do `stripe listen` → `[200] POST /api/billing/stripe/webhook`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/billing/stripe/
git commit -m "feat(billing): webhook Stripe — sincroniza plano/status em 5 eventos"
```

---

## Task 6: Página Pública de Planos e Preços

**Files:**
- Create: `src/app/(public)/planos/page.tsx`
- Create: `src/components/domain/billing/plan-card.tsx`

- [ ] **Step 1: Criar componente PlanCard**

Crie `src/components/domain/billing/plan-card.tsx`:

```typescript
'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

type Plan = {
  name: string
  displayName: string
  price: number
  description?: string | null
  features: string[]
  isPopular?: boolean
}

export function PlanCard({
  plan,
  isAnnual,
}: {
  plan: Plan
  isAnnual: boolean
}) {
  const router = useRouter()
  const isFree = plan.name === 'FREE'
  const monthlyPrice = isAnnual ? Math.round(plan.price * 10 / 12) : plan.price

  function handleCTA() {
    router.push(`/login?plan=${plan.name}`)
  }

  return (
    <div className={`relative rounded-2xl border bg-white p-6 flex flex-col gap-6
      ${plan.isPopular ? 'border-slate-900 shadow-lg ring-1 ring-slate-900' : 'border-slate-200'}`}>

      {plan.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
            Mais popular
          </span>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-slate-900">{plan.displayName}</h3>
        {plan.description && <p className="text-sm text-slate-500 mt-1">{plan.description}</p>}
      </div>

      <div>
        {isFree ? (
          <p className="text-3xl font-bold text-slate-900">Grátis</p>
        ) : (
          <div>
            <p className="text-3xl font-bold text-slate-900">
              R$ {monthlyPrice}
              <span className="text-base font-normal text-slate-500">/mês</span>
            </p>
            {isAnnual && <p className="text-sm text-green-600 mt-1">Equivale a {plan.price}/mês — 2 meses grátis</p>}
          </div>
        )}
      </div>

      <ul className="space-y-2 flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
            <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <Button
        onClick={handleCTA}
        variant={plan.isPopular ? 'default' : 'outline'}
        className="w-full"
      >
        {isFree ? 'Começar grátis' : 'Iniciar 14 dias grátis'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Criar página de planos (SSR)**

Crie `src/app/(public)/planos/page.tsx`:

```typescript
import { prisma } from '@/shared/database/prisma'
import { PlanCard } from '@/components/domain/billing/plan-card'
import { PricingToggle } from '@/components/domain/billing/pricing-toggle'

// Features estáticas por plano (pode evoluir para dados do banco)
const PLAN_FEATURES: Record<string, string[]> = {
  FREE: [
    'Até 2 profissionais',
    'Até 50 agendamentos/mês',
    'Agenda e CRM básico',
    'Relatórios básicos',
  ],
  STARTER: [
    'Até 5 profissionais',
    'Até 300 agendamentos/mês',
    'WhatsApp automático',
    'Página de agendamento pública',
    'Relatórios completos + CSV',
    'Estoque de produtos',
  ],
  PRO: [
    'Até 20 profissionais',
    'Até 2.000 agendamentos/mês',
    'WhatsApp premium (chatbot, aniversário)',
    'Tudo do Starter',
    'Relatórios avançados',
    'Múltiplas unidades (3)',
  ],
  ENTERPRISE: [
    'Profissionais ilimitados',
    'Agendamentos ilimitados',
    'WhatsApp ilimitado',
    'Multi-unidade ilimitado',
    'Suporte prioritário',
    'Tudo do Pro',
  ],
}

async function getPlans() {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  })
}

export default async function PlansPage() {
  const plans = await getPlans()

  const plansWithFeatures = plans.map(p => ({
    ...p,
    price: Number(p.price),
    features: PLAN_FEATURES[p.name] ?? [],
    isPopular: p.name === 'PRO',
  }))

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-semibold text-slate-900">EstéticaSaaS</span>
          <a href="/login" className="text-sm text-slate-600 hover:text-slate-900">Entrar</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900">Planos simples e transparentes</h1>
          <p className="mt-4 text-lg text-slate-500">14 dias grátis em qualquer plano pago. Sem cartão de crédito.</p>
        </div>

        {/* Toggle mensal/anual — client component */}
        <PricingToggle plans={plansWithFeatures} />

        {/* FAQ */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-slate-900 mb-6 text-center">Dúvidas frequentes</h2>
          <div className="space-y-4">
            {[
              ['Preciso de cartão de crédito para o trial?', 'Não. O trial de 14 dias é gratuito e não exige cartão.'],
              ['Posso cancelar a qualquer momento?', 'Sim. Cancele pelo painel de configurações. Sem multas.'],
              ['O que acontece ao fim do trial?', 'Seu plano retorna ao FREE automaticamente. Nenhum dado é perdido.'],
              ['Posso mudar de plano?', 'Sim. Upgrade ou downgrade a qualquer momento nas configurações.'],
              ['Como funciona a cobrança anual?', 'Você paga 10x o preço mensal e ganha 2 meses grátis.'],
            ].map(([q, a]) => (
              <details key={q} className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="font-medium text-slate-900 cursor-pointer">{q}</summary>
                <p className="mt-2 text-sm text-slate-500">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Criar PricingToggle (client component)**

Crie `src/components/domain/billing/pricing-toggle.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { PlanCard } from './plan-card'

export function PricingToggle({ plans }: { plans: any[] }) {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm ${!isAnnual ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>Mensal</span>
        <button
          onClick={() => setIsAnnual(v => !v)}
          className={`relative w-12 h-6 rounded-full transition-colors ${isAnnual ? 'bg-slate-900' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm ${isAnnual ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
          Anual <span className="text-green-600 font-medium">(-17%)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => (
          <PlanCard key={plan.name} plan={plan} isAnnual={isAnnual} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Testar página localmente**

```bash
npm run dev
```

Acesse `http://localhost:3000/planos` e verifique se os planos são exibidos corretamente.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(public\)/planos/ src/components/domain/billing/
git commit -m "feat(billing): página pública de planos e preços com toggle mensal/anual"
```

---

## Task 7: Atualizar Página de Configurações/Planos (Upgrade + Portal)

**Files:**
- Modify: `src/app/(app)/configuracoes/planos/page.tsx`
- Create: `src/hooks/use-billing-actions.ts`

- [ ] **Step 1: Criar hook de ações de billing**

Crie `src/hooks/use-billing-actions.ts`:

```typescript
'use client'

import { useState } from 'react'
import { useSession } from '@/hooks/use-session'
import { toast } from 'sonner'

export function useBillingActions() {
  const { session } = useSession()
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)

  async function startUpgrade(planName: string) {
    setLoadingCheckout(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ planName }),
      })
      if (!res.ok) {
        toast.error('Erro ao iniciar checkout. Tente novamente.')
        return
      }
      const { checkoutUrl } = await res.json()
      window.location.href = checkoutUrl
    } finally {
      setLoadingCheckout(false)
    }
  }

  async function openPortal() {
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) {
        toast.error('Erro ao abrir portal de billing.')
        return
      }
      const { portalUrl } = await res.json()
      window.location.href = portalUrl
    } finally {
      setLoadingPortal(false)
    }
  }

  return { startUpgrade, openPortal, loadingCheckout, loadingPortal }
}
```

- [ ] **Step 2: Atualizar página de configurações/planos**

Em `src/app/(app)/configuracoes/planos/page.tsx`, adicione os botões de upgrade e portal. Adapte ao código existente:

```typescript
'use client'

import { useBillingActions } from '@/hooks/use-billing-actions'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

// Dentro do componente existente, adicione:
const { startUpgrade, openPortal, loadingCheckout, loadingPortal } = useBillingActions()
const searchParams = useSearchParams()

// Mostrar feedback após retorno do Stripe:
useEffect(() => {
  const stripe = searchParams.get('stripe')
  if (stripe === 'success') toast.success('Plano atualizado com sucesso!')
  if (stripe === 'cancelled') toast.info('Checkout cancelado.')
}, [searchParams])

// Botão de upgrade (para planos não-FREE sem stripeSubId):
<Button onClick={() => startUpgrade('PRO')} disabled={loadingCheckout}>
  {loadingCheckout ? 'Redirecionando...' : 'Fazer upgrade para PRO'}
</Button>

// Botão de gerenciar assinatura (quando stripeSubId existe):
<Button variant="outline" onClick={openPortal} disabled={loadingPortal}>
  <ExternalLink className="size-4 mr-1.5" />
  {loadingPortal ? 'Abrindo...' : 'Gerenciar assinatura / Faturas'}
</Button>
```

> Integre ao layout existente da página de planos. A lógica exata de qual botão exibir depende do plano atual e do `stripeSubId` — consulte o estado de billing via hook existente ou via props do servidor.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Testar com Stripe em modo teste**

Use cartão de teste `4242 4242 4242 4242` com qualquer data futura e CVV.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-billing-actions.ts src/app/\(app\)/configuracoes/planos/page.tsx
git commit -m "feat(billing): botões de upgrade e portal na página de planos"
```

---

## Task 8: Onboarding com Seleção de Plano

**Files:**
- Modify: `src/app/(auth)/onboarding/page.tsx`

- [ ] **Step 1: Adicionar leitura do plano selecionado**

Em `src/app/(auth)/onboarding/page.tsx`, adicione a leitura do cookie `plan_selected` e a criação do Stripe Customer no onboarding:

```typescript
// Adicionar no início do componente:
const [selectedPlan, setSelectedPlan] = useState<string>('STARTER')

// No useEffect existente do modo, adicione leitura do cookie:
useEffect(() => {
  const planCookie = document.cookie
    .split('; ')
    .find(r => r.startsWith('plan_selected='))
    ?.split('=')[1]
  if (planCookie) setSelectedPlan(planCookie)
}, [])
```

- [ ] **Step 2: Adicionar step 2 de confirmação de plano ao fluxo create**

No formulário de `mode === 'create'`, adicione após o botão "Começar →" um segundo step visualmente:

```typescript
// Estado para controlar step do onboarding:
const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1)

// No step 1 (já existe), alterar o onClick do botão para ir para step 2:
// O botão "Começar →" vira "Próximo →" e vai para o step 2

// Step 2 — novo bloco condicional:
{mode === 'create' && onboardingStep === 2 && (
  <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-[#191919]">Quase lá!</h1>
      <p className="mt-2 text-sm text-[#787774]">
        Confirme o plano para iniciar seu período gratuito de 14 dias.
      </p>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">Plano {selectedPlan}</span>
        <span className="text-sm text-green-600 font-medium">14 dias grátis</span>
      </div>
      <p className="text-sm text-slate-500">Sem cartão de crédito. Cancele quando quiser.</p>
    </div>

    <div className="flex gap-2">
      <Button type="button" variant="outline" className="flex-1" onClick={() => setOnboardingStep(1)}>
        Voltar
      </Button>
      <Button
        type="button"
        className="flex-1 bg-[#191919] text-white hover:bg-[#2d2d2d]"
        onClick={handleCreate}
        disabled={isSubmitting}
      >
        {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Configurando...</> : 'Começar grátis →'}
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Criar Stripe Customer automaticamente no startTrial**

A abordagem correta é criar o Stripe Customer dentro de `billingService.startTrial()`, sem endpoint separado. Edite `src/domains/billing/billing.service.ts`:

```typescript
// Adicionar import no topo:
import { stripeBillingService } from './stripe-billing.service'

// Dentro de startTrial(), após criar a subscription:
async startTrial(tenantId: string, ownerEmail: string, ownerName: string) {
  // ... código existente de criação da subscription ...

  // Criar Stripe Customer em background (não bloqueia se falhar)
  stripeBillingService.getOrCreateStripeCustomer({ tenantId, ownerEmail, ownerName })
    .catch(err => console.error('Stripe Customer creation failed:', err))

  return sub
}
```

Atualize a chamada em `/api/iam/register` para passar `email` e `name` do owner ao chamar `startTrial`:

```typescript
// No /api/iam/register, onde startTrial é chamado:
await billingService.startTrial(tenantId, ownerEmail, ownerName)
```

Verifique a assinatura atual de `startTrial` em `billing.service.ts` e adapte — ela atualmente não recebe email/name, então adicione os parâmetros opcionais.

- [ ] **Step 4: Adicionar link de /planos no login**

Em `src/app/(auth)/login/login-client.tsx` (ou equivalente), adicione um link:

```typescript
<p className="text-center text-sm text-[#787774]">
  Não tem conta?{' '}
  <a href="/planos" className="text-[#191919] font-medium hover:underline">
    Ver planos e criar conta
  </a>
</p>
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Rodar todos os testes**

```bash
npx vitest run
```

- [ ] **Step 7: Commit e push**

```bash
git add src/
git commit -m "feat(onboarding): step 2 de seleção de plano e criação de Stripe Customer"
git push origin main
```

---

## Verificação Final do Track B

- [ ] Acessar `/planos` — planos exibidos com toggle mensal/anual funcionando
- [ ] Clicar em "Iniciar 14 dias grátis" → redireciona para `/login?plan=PRO`
- [ ] Completar onboarding → step 2 mostra plano selecionado
- [ ] Em `/configuracoes/planos`: clicar "Fazer upgrade" → abre Stripe Checkout (modo teste)
- [ ] Usar cartão `4242 4242 4242 4242` → completa pagamento → volta para `/configuracoes/planos?stripe=success`
- [ ] Webhook `customer.subscription.created` → plano atualizado no banco
- [ ] Botão "Gerenciar assinatura / Faturas" → abre Stripe Customer Portal
- [ ] `npx tsc --noEmit` → zero erros
- [ ] `npx vitest run` → todos os testes passando

```bash
git push origin main
```

---

*Tracks C, D e E serão documentados em planos separados após entrega dos Tracks A e B.*
