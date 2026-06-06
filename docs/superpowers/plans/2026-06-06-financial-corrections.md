# Correções do Módulo Financeiro — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir exibição de estornos de insumo (duplo negativo), adicionar badges de categoria nas transações, incluir 4 filtros completos nas telas de transações e corrigir os cálculos do summary e relatório financeiro.

**Architecture:** Sem migration de schema — distinção entre crédito de custo e despesa real feita pela `category`. Um arquivo `categories.ts` centraliza as constantes usadas por subscriptions, display, cálculos e filtros. Compatibilidade retroativa com registros antigos (amount < 0) garantida pelo helper `isReversal`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma, Zod, TanStack Query, Shadcn UI, Vitest

---

## Pré-requisito: branch dedicada

Antes de iniciar qualquer task, criar a branch:

```bash
git checkout -b feat/financial-corrections
```

Verificar:

```bash
git branch --show-current
# Esperado: feat/financial-corrections
```

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/domains/financial/categories.ts` | Criar |
| `src/domains/financial/subscriptions.ts` | Modificar |
| `src/domains/financial/transaction.repository.ts` | Modificar |
| `src/domains/financial/types.ts` | Modificar |
| `src/app/api/financial/transactions/route.ts` | Modificar |
| `src/app/api/financial/summary/route.ts` | Modificar |
| `src/components/domain/financial/transaction-card.tsx` | Modificar |
| `src/hooks/financial/use-transactions.ts` | Modificar |
| `src/components/domain/financial/transaction-list.tsx` | Modificar |
| `src/app/(app)/financeiro/transacoes/page.tsx` | Modificar |
| `src/app/(app)/financeiro/page.tsx` | Modificar |
| `src/domains/reports/types.ts` | Modificar |
| `src/domains/reports/reports.service.ts` | Modificar |
| `src/app/(app)/relatorios/financeiro/page.tsx` | Modificar |

---

## Task 1: Categorias canônicas

**Files:**
- Create: `src/domains/financial/categories.ts`
- Create: `src/domains/financial/__tests__/categories.test.ts`

- [ ] **Step 1: Escrever o teste para `isReversal`**

```typescript
// src/domains/financial/__tests__/categories.test.ts
import { describe, it, expect } from 'vitest'
import { isReversal, FINANCIAL_CATEGORIES } from '../categories'

describe('isReversal', () => {
  it('retorna true para category SUPPLY_REVERSAL com amount positivo', () => {
    expect(isReversal(FINANCIAL_CATEGORIES.SUPPLY_REVERSAL, 30)).toBe(true)
  })

  it('retorna true para amount negativo (compatibilidade retroativa)', () => {
    expect(isReversal(FINANCIAL_CATEGORIES.SUPPLY_USE, -30)).toBe(true)
  })

  it('retorna false para despesa normal', () => {
    expect(isReversal(FINANCIAL_CATEGORIES.SUPPLY_USE, 30)).toBe(false)
  })

  it('retorna false para receita', () => {
    expect(isReversal(FINANCIAL_CATEGORIES.SERVICE, 100)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
npx vitest run src/domains/financial/__tests__/categories.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Criar `categories.ts`**

```typescript
// src/domains/financial/categories.ts
export const FINANCIAL_CATEGORIES = {
  SERVICE:         'Serviço',
  PRODUCT_SALE:    'Venda de Produto',
  STOCK_PURCHASE:  'Compra de Estoque',
  SUPPLY_USE:      'Insumo de Atendimento',
  COURTESY:        'Cortesia',
  FIXED_EXPENSE:   'Despesa Fixa',
  VARIABLE:        'Despesa Variável',
  SUPPLY_REVERSAL: 'Estorno de Insumo',
} as const

export type FinancialCategory = typeof FINANCIAL_CATEGORIES[keyof typeof FINANCIAL_CATEGORIES]

export function isReversal(category: string, amount: number): boolean {
  return category === FINANCIAL_CATEGORIES.SUPPLY_REVERSAL || amount < 0
}
```

- [ ] **Step 4: Rodar teste para confirmar que passa**

```bash
npx vitest run src/domains/financial/__tests__/categories.test.ts
```

Esperado: PASS (4 testes).

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/financial/categories.ts src/domains/financial/__tests__/categories.test.ts
git commit -m "feat(financial): categorias canônicas e helper isReversal"
```

---

## Task 2: Corrigir subscriptions.ts

**Files:**
- Modify: `src/domains/financial/subscriptions.ts`
- Create: `src/domains/financial/__tests__/subscriptions.test.ts`

- [ ] **Step 1: Escrever teste para o handler de stock.appointment_restore**

```typescript
// src/domains/financial/__tests__/subscriptions.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { TransactionType } from '@prisma/client'

const mockCreate = vi.fn().mockResolvedValue({ id: 'tx-1' })
const capturedHandlers: Record<string, (payload: unknown) => Promise<void>> = {}

vi.mock('../transaction.repository', () => ({
  transactionRepository: { create: mockCreate },
}))

vi.mock('@/shared/events/event-bus', () => ({
  eventBus: {
    subscribe: vi.fn((event: string, handler: (p: unknown) => Promise<void>) => {
      capturedHandlers[event] = handler
    }),
    publish: vi.fn(),
  },
}))

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    appointment: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}))

import { registerFinancialSubscriptions } from '../subscriptions'

describe('registerFinancialSubscriptions', () => {
  beforeAll(() => {
    registerFinancialSubscriptions()
  })

  it('stock.appointment_restore cria EXPENSE com category SUPPLY_REVERSAL e amount positivo', async () => {
    mockCreate.mockClear()
    await capturedHandlers['stock.appointment_restore']({
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
      productName: 'Shampoo Belize',
      serviceName: 'Progressiva',
      customerName: 'Ana',
      quantity: 1,
      costPrice: 30,
      totalCost: 30,
      productId: 'prod-1',
    })

    expect(mockCreate).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        type: TransactionType.EXPENSE,
        category: 'Estorno de Insumo',
      }),
    )

    const createArg = mockCreate.mock.calls[0][1]
    expect(Number(createArg.amount)).toBeGreaterThan(0)
    expect(createArg.description).toContain('Shampoo Belize')
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
npx vitest run src/domains/financial/__tests__/subscriptions.test.ts
```

Esperado: FAIL — amount negativo ou category errada.

- [ ] **Step 3: Corrigir `subscriptions.ts`**

Substituir o conteúdo completo do arquivo:

```typescript
import { Prisma, TransactionType } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { eventBus } from "@/shared/events/event-bus";
import { FINANCIAL_CATEGORIES } from "./categories";

import { transactionRepository } from "./transaction.repository";

let financialSubscriptionsRegistered = false;

export function registerFinancialSubscriptions() {
  if (financialSubscriptionsRegistered) {
    return;
  }

  financialSubscriptionsRegistered = true;

  eventBus.subscribe("scheduling.appointment.paid", async (payload) => {
    const appt = await prisma.appointment.findUnique({
      where: { id: payload.appointmentId },
      select: {
        service: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    const serviceName = appt?.service?.name ?? "Serviço";
    const customerName = appt?.customer?.name ?? "";
    const description = customerName
      ? `Receita: ${serviceName} — ${customerName}`
      : `Receita: ${serviceName}`;

    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.INCOME,
      category: FINANCIAL_CATEGORIES.SERVICE,
      description,
      amount: new Prisma.Decimal(payload.netAmount),
      paidAt: new Date(),
      paymentMethod: payload.paymentMethod,
      grossAmount: new Prisma.Decimal(payload.grossAmount),
      discountAmount: new Prisma.Decimal(payload.discountAmount),
      tipAmount: new Prisma.Decimal(payload.tipAmount),
      cardFeeAmount: new Prisma.Decimal(payload.cardFeeAmount),
      netAmount: new Prisma.Decimal(payload.netAmount),
      commissionAmount: payload.commissionAmount > 0
        ? new Prisma.Decimal(payload.commissionAmount)
        : undefined,
      professionalId: payload.commissionAmount > 0 ? payload.professionalId : undefined,
    });
  });

  eventBus.subscribe("scheduling.appointment.courtesy", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.EXPENSE,
      category: FINANCIAL_CATEGORIES.COURTESY,
      description: "Cortesia — serviço sem cobrança",
      amount: new Prisma.Decimal(payload.grossAmount),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("product.sold", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      type: TransactionType.INCOME,
      category: FINANCIAL_CATEGORIES.PRODUCT_SALE,
      description: `Venda: ${payload.productName} × ${payload.quantity} un.`,
      amount: new Prisma.Decimal(payload.totalAmount),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("stock.purchased", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      type: TransactionType.EXPENSE,
      category: FINANCIAL_CATEGORIES.STOCK_PURCHASE,
      description: `Compra: ${payload.productName} × ${payload.quantity} un.`,
      amount: new Prisma.Decimal(payload.totalAmount),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("stock.appointment_use", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.EXPENSE,
      category: FINANCIAL_CATEGORIES.SUPPLY_USE,
      description: `Insumo: ${payload.productName} × ${payload.quantity} un. — ${payload.serviceName}`,
      amount: new Prisma.Decimal(payload.totalCost),
      paidAt: new Date(),
    });
  });

  eventBus.subscribe("stock.appointment_restore", async (payload) => {
    await transactionRepository.create(payload.tenantId, {
      appointmentId: payload.appointmentId,
      type: TransactionType.EXPENSE,
      category: FINANCIAL_CATEGORIES.SUPPLY_REVERSAL,
      description: `Estorno de insumo: ${payload.productName} × ${payload.quantity} un. — ${payload.serviceName}`,
      amount: new Prisma.Decimal(payload.totalCost),
      paidAt: new Date(),
    });
  });
}
```

- [ ] **Step 4: Rodar o teste**

```bash
npx vitest run src/domains/financial/__tests__/subscriptions.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/financial/subscriptions.ts src/domains/financial/__tests__/subscriptions.test.ts
git commit -m "fix(financial): corrige estorno de insumo — amount positivo e categoria SUPPLY_REVERSAL"
```

---

## Task 3: Filtros category e professionalId no repository

**Files:**
- Modify: `src/domains/financial/transaction.repository.ts`
- Modify: `src/domains/financial/types.ts`

- [ ] **Step 1: Atualizar `TransactionFilters` e o método `list` no repository**

Substituir o conteúdo de `src/domains/financial/transaction.repository.ts`:

```typescript
import { type Prisma, TransactionType, type Transaction } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

export type TransactionFilters = {
  type?: TransactionType;
  category?: string;
  professionalId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export class TransactionRepository {
  async list(tenantId: string, filters: TransactionFilters = {}) {
    const { type, category, professionalId, from, to, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.TransactionWhereInput = {
      tenantId,
      ...(type && { type }),
      ...(category && { category }),
      ...(professionalId && { professionalId }),
      ...(from || to
        ? {
            paidAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { appointment: true },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async create(
    tenantId: string,
    data: Omit<Prisma.TransactionUncheckedCreateInput, "tenantId">,
  ): Promise<Transaction> {
    return prisma.transaction.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }
}

export const transactionRepository = new TransactionRepository();
```

- [ ] **Step 2: Adicionar `category` e `professionalId` ao schema Zod em `types.ts`**

```typescript
// src/domains/financial/types.ts
import { TransactionType } from "@prisma/client";
import { z } from "zod";

export const listTransactionsSchema = z.object({
  type: z.nativeEnum(TransactionType).optional(),
  category: z.string().optional(),
  professionalId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsSchema>;

export const createTransactionSchema = z.object({
  appointmentId: z.string().cuid().optional(),
  type: z.nativeEnum(TransactionType),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(200),
  amount: z.number().positive(),
  paidAt: z.string().datetime().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/domains/financial/transaction.repository.ts src/domains/financial/types.ts
git commit -m "feat(financial): adiciona filtros category e professionalId ao repository"
```

---

## Task 4: Propagar filtros na API de transações

**Files:**
- Modify: `src/app/api/financial/transactions/route.ts`

- [ ] **Step 1: Atualizar o handler GET para extrair e propagar os novos filtros**

Substituir o conteúdo completo de `src/app/api/financial/transactions/route.ts`:

```typescript
import { financialService } from "@/domains/financial/financial.service";
import { createTransactionSchema, listTransactionsSchema } from "@/domains/financial/types";
import { TransactionType } from "@prisma/client";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { created } from "@/shared/http/responses";
import { validateInput } from "@/shared/http/validate-input";

export async function GET(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.view);

    const { searchParams } = new URL(request.url);
    const query = listTransactionsSchema.parse({
      type: searchParams.get("type") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      professionalId: searchParams.get("professionalId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    const result = await financialService.list(session.tenantId, {
      type: query.type as TransactionType | undefined,
      category: query.category,
      professionalId: query.professionalId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.manage);
    const input = await validateInput(request, createTransactionSchema);
    const transaction = await financialService.create(session.tenantId, input);
    return created(transaction);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/financial/transactions/route.ts
git commit -m "feat(financial): propaga filtros category e professionalId na API de transações"
```

---

## Task 5: Corrigir Summary API com breakdown de custos

**Files:**
- Modify: `src/app/api/financial/summary/route.ts`

- [ ] **Step 1: Substituir o handler GET com cálculo de breakdown**

Substituir o conteúdo completo de `src/app/api/financial/summary/route.ts`:

```typescript
import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { FINANCIAL_CATEGORIES, isReversal } from "@/domains/financial/categories";

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.financial.view);
    const url = new URL(request.url);
    const { from, to } = querySchema.parse(Object.fromEntries(url.searchParams));

    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: session.tenantId,
        paidAt: { gte: new Date(from), lte: new Date(to) },
      },
    });

    const income = transactions.filter((t) => t.type === TransactionType.INCOME);
    const expenses = transactions.filter((t) => t.type === TransactionType.EXPENSE);

    const grossRevenue = income.reduce((s, t) => s + Number(t.grossAmount ?? t.amount), 0);
    const discounts = income.reduce((s, t) => s + Number(t.discountAmount ?? 0), 0);
    const tips = income.reduce((s, t) => s + Number(t.tipAmount ?? 0), 0);
    const cardFees = income.reduce((s, t) => s + Number(t.cardFeeAmount ?? 0), 0);
    const netRevenue = income.reduce((s, t) => s + Number(t.netAmount ?? t.amount), 0);
    const commissions = income.reduce((s, t) => s + Number(t.commissionAmount ?? 0), 0);

    const isReversalTx = (t: (typeof transactions)[0]) =>
      isReversal(t.category, Number(t.amount));

    const supplyExpenses = expenses
      .filter((t) => t.category === FINANCIAL_CATEGORIES.SUPPLY_USE && !isReversalTx(t))
      .reduce((s, t) => s + Number(t.amount), 0);

    const supplyReversals = expenses
      .filter(isReversalTx)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    const netSupplyCost = Math.max(0, supplyExpenses - supplyReversals);

    const stockPurchases = expenses
      .filter((t) => t.category === FINANCIAL_CATEGORIES.STOCK_PURCHASE && !isReversalTx(t))
      .reduce((s, t) => s + Number(t.amount), 0);

    const courtesies = expenses
      .filter((t) => t.category === FINANCIAL_CATEGORIES.COURTESY && !isReversalTx(t))
      .reduce((s, t) => s + Number(t.amount), 0);

    const operationalExpenses = expenses
      .filter(
        (t) =>
          !isReversalTx(t) &&
          t.category !== FINANCIAL_CATEGORIES.SUPPLY_USE &&
          t.category !== FINANCIAL_CATEGORIES.STOCK_PURCHASE &&
          t.category !== FINANCIAL_CATEGORIES.COURTESY,
      )
      .reduce((s, t) => s + Number(t.amount), 0);

    const totalExpenses = netSupplyCost + stockPurchases + courtesies + operationalExpenses;
    const profit = netRevenue - totalExpenses;

    return Response.json({
      grossRevenue,
      discounts,
      tips,
      cardFees,
      netRevenue,
      supplyExpenses,
      supplyReversals,
      netSupplyCost,
      stockPurchases,
      courtesies,
      operationalExpenses,
      totalExpenses,
      profit,
      commissions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/financial/summary/route.ts
git commit -m "feat(financial): summary com breakdown de custos por categoria"
```

---

## Task 6: Corrigir transaction-card — ícone âmbar + badges

**Files:**
- Modify: `src/components/domain/financial/transaction-card.tsx`

- [ ] **Step 1: Substituir o conteúdo completo do componente**

```typescript
// src/components/domain/financial/transaction-card.tsx
'use client'

import { ArrowUpCircle, ArrowDownCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isReversal } from '@/domains/financial/categories'
import type { Transaction } from '@/hooks/financial/use-transactions'

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  'Serviço':               { label: 'Serviço',   className: 'bg-slate-100 text-slate-600' },
  'Venda de Produto':      { label: 'Venda',     className: 'bg-slate-100 text-slate-600' },
  'Compra de Estoque':     { label: 'Compra',    className: 'bg-gray-100 text-gray-600' },
  'Insumo de Atendimento': { label: 'Insumo',    className: 'bg-purple-50 text-purple-700' },
  'Despesa Variável':      { label: 'Variável',  className: 'bg-orange-50 text-orange-700' },
  'Despesa Fixa':          { label: 'Fixo',      className: 'bg-blue-50 text-blue-700' },
  'Cortesia':              { label: 'Cortesia',  className: 'bg-amber-50 text-amber-700' },
  'Estorno de Insumo':     { label: 'Estorno',   className: 'bg-amber-50 text-amber-700' },
}

type Props = {
  transaction: Transaction
}

export function TransactionCard({ transaction }: Props) {
  const isIncome = transaction.type === 'INCOME'
  const amount = Number(transaction.amount)
  const isReversalEntry = isReversal(transaction.category, amount)
  const isCredit = isIncome || isReversalEntry
  const displayAmount = Math.abs(amount)

  const badge = CATEGORY_BADGE[transaction.category]

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          isIncome
            ? 'bg-emerald-50'
            : isReversalEntry
            ? 'bg-amber-50'
            : 'bg-red-50',
        )}
      >
        {isIncome ? (
          <ArrowUpCircle className="size-5 text-emerald-600" />
        ) : isReversalEntry ? (
          <RotateCcw className="size-5 text-amber-600" />
        ) : (
          <ArrowDownCircle className="size-5 text-red-600" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">
          {transaction.description}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-xs text-slate-500">
            {transaction.paidAt
              ? new Date(transaction.paidAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Sem data'}
          </p>
          {badge && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                badge.className,
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          'shrink-0 text-sm font-semibold',
          isIncome
            ? 'text-emerald-700'
            : isReversalEntry
            ? 'text-amber-700'
            : 'text-red-700',
        )}
      >
        {isCredit ? '+' : '−'}R$
        {displayAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/financial/transaction-card.tsx
git commit -m "fix(financial): exibe estorno como crédito âmbar com badge de categoria"
```

---

## Task 7: Filtros no hook e no TransactionList

**Files:**
- Modify: `src/hooks/financial/use-transactions.ts`
- Modify: `src/components/domain/financial/transaction-list.tsx`

- [ ] **Step 1: Adicionar `category` e `professionalId` ao hook**

Substituir o conteúdo completo de `src/hooks/financial/use-transactions.ts`:

```typescript
// src/hooks/financial/use-transactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type TransactionType = 'INCOME' | 'EXPENSE'

export type Transaction = {
  id: string
  type: TransactionType
  category: string
  description: string
  amount: string
  paidAt: string | null
  appointmentId: string | null
  createdAt: string
}

export type TransactionsPage = {
  data: Transaction[]
  total: number
  page: number
  pageSize: number
}

export type CreateTransactionInput = {
  appointmentId?: string
  type: TransactionType
  category: string
  description: string
  amount: number
  paidAt?: string
}

type ListParams = {
  from?: string
  to?: string
  type?: TransactionType
  category?: string
  professionalId?: string
  page?: number
  pageSize?: number
}

async function listTransactions(params: ListParams): Promise<TransactionsPage> {
  const url = new URL('/api/financial/transactions', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.type) url.searchParams.set('type', params.type)
  if (params.category) url.searchParams.set('category', params.category)
  if (params.professionalId) url.searchParams.set('professionalId', params.professionalId)
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar transações')
  return res.json()
}

async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await fetch('/api/financial/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao registrar transação')
  }
  return res.json()
}

export function useTransactions(params: ListParams = {}) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => listTransactions(params),
    staleTime: 30 * 1000,
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
```

- [ ] **Step 2: Adicionar props `category` e `professionalId` ao `TransactionList`**

Substituir o conteúdo completo de `src/components/domain/financial/transaction-list.tsx`:

```typescript
// src/components/domain/financial/transaction-list.tsx
'use client'

import { DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionCard } from './transaction-card'
import { useTransactions } from '@/hooks/financial/use-transactions'
import type { TransactionType } from '@/hooks/financial/use-transactions'

type Props = {
  from?: string
  to?: string
  type?: TransactionType
  category?: string
  professionalId?: string
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
}

export function TransactionList({
  from,
  to,
  type,
  category,
  professionalId,
  page = 1,
  pageSize = 20,
  onPageChange,
}: Props) {
  const { data, isLoading, isError, refetch } = useTransactions({
    from,
    to,
    type,
    category,
    professionalId,
    page,
    pageSize,
  })

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">Erro ao carregar transações.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
        <DollarSign className="size-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">Nenhuma transação encontrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.data.map((t) => (
        <TransactionCard key={t.id} transaction={t} />
      ))}

      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="text-xs text-slate-500">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/financial/use-transactions.ts src/components/domain/financial/transaction-list.tsx
git commit -m "feat(financial): adiciona filtros category e professionalId ao hook e à TransactionList"
```

---

## Task 8: 4 filtros completos no histórico de transações

**Files:**
- Modify: `src/app/(app)/financeiro/transacoes/page.tsx`

- [ ] **Step 1: Substituir o conteúdo completo da página**

```typescript
// src/app/(app)/financeiro/transacoes/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TransactionList } from '@/components/domain/financial/transaction-list'
import { usePermissions } from '@/hooks/use-permissions'
import { useTeamMembers } from '@/hooks/iam/use-team'
import { FINANCIAL_CATEGORIES } from '@/domains/financial/categories'
import type { TransactionType } from '@/hooks/financial/use-transactions'

const CATEGORIES = [
  FINANCIAL_CATEGORIES.SERVICE,
  FINANCIAL_CATEGORIES.PRODUCT_SALE,
  FINANCIAL_CATEGORIES.STOCK_PURCHASE,
  FINANCIAL_CATEGORIES.SUPPLY_USE,
  FINANCIAL_CATEGORIES.SUPPLY_REVERSAL,
  FINANCIAL_CATEGORIES.COURTESY,
  FINANCIAL_CATEGORIES.FIXED_EXPENSE,
  FINANCIAL_CATEGORIES.VARIABLE,
]

export default function TransacoesPage() {
  const { can } = usePermissions()
  const { data: team = [] } = useTeamMembers()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState<'all' | TransactionType>('all')
  const [category, setCategory] = useState('all')
  const [professionalId, setProfessionalId] = useState('all')
  const [page, setPage] = useState(1)

  if (!can('financeiro', 'view')) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Você não tem permissão para acessar o financeiro.
          </p>
        </div>
      </div>
    )
  }

  function handleFilterChange(fn: () => void) {
    fn()
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/financeiro">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Histórico de transações
        </h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        {/* Período */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => handleFilterChange(() => setFrom(e.target.value))}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => handleFilterChange(() => setTo(e.target.value))}
            />
          </div>
        </div>

        {/* Tipo + Categoria */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={type}
            onValueChange={(v) => handleFilterChange(() => setType(v as typeof type))}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Tipo: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="INCOME">Receita</SelectItem>
              <SelectItem value="EXPENSE">Despesa / Estorno</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={category}
            onValueChange={(v) => handleFilterChange(() => setCategory(v))}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Categoria: Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Profissional */}
        {team.length > 0 && (
          <Select
            value={professionalId}
            onValueChange={(v) => handleFilterChange(() => setProfessionalId(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Profissional: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {team.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <TransactionList
        from={from ? new Date(from + 'T00:00:00').toISOString() : undefined}
        to={to ? new Date(to + 'T23:59:59').toISOString() : undefined}
        type={type === 'all' ? undefined : type}
        category={category === 'all' ? undefined : category}
        professionalId={professionalId === 'all' ? undefined : professionalId}
        page={page}
        pageSize={20}
        onPageChange={setPage}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/financeiro/transacoes/page.tsx
git commit -m "feat(financial): 4 filtros completos no histórico de transações"
```

---

## Task 9: Breakdown e filtros no dashboard financeiro

**Files:**
- Modify: `src/app/(app)/financeiro/page.tsx`

- [ ] **Step 1: Substituir o conteúdo completo da página**

```typescript
// src/app/(app)/financeiro/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinancialDaySummary } from "@/components/domain/financial/day-summary";
import { TransactionList } from "@/components/domain/financial/transaction-list";
import { usePermissions } from "@/hooks/use-permissions";
import { usePendingPayments, useFinancialSummary } from "@/hooks/financial/use-checkout";
import { FINANCIAL_CATEGORIES } from "@/domains/financial/categories";
import type { TransactionType } from "@/hooks/financial/use-transactions";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type SummaryData = {
  grossRevenue: number;
  discounts: number;
  tips: number;
  cardFees: number;
  netRevenue: number;
  supplyExpenses: number;
  supplyReversals: number;
  netSupplyCost: number;
  stockPurchases: number;
  courtesies: number;
  operationalExpenses: number;
  totalExpenses: number;
  profit: number;
};

const CATEGORIES = [
  FINANCIAL_CATEGORIES.SERVICE,
  FINANCIAL_CATEGORIES.PRODUCT_SALE,
  FINANCIAL_CATEGORIES.STOCK_PURCHASE,
  FINANCIAL_CATEGORIES.SUPPLY_USE,
  FINANCIAL_CATEGORIES.SUPPLY_REVERSAL,
  FINANCIAL_CATEGORIES.COURTESY,
  FINANCIAL_CATEGORIES.FIXED_EXPENSE,
  FINANCIAL_CATEGORIES.VARIABLE,
];

export default function FinanceiroPage() {
  const { can } = usePermissions();
  const { data: pending = [] } = usePendingPayments();
  const [txType, setTxType] = useState<"all" | TransactionType>("all");
  const [txCategory, setTxCategory] = useState("all");

  const today = new Date();
  const from = startOfMonth(today).toISOString();
  const to = endOfDay(today).toISOString();
  const { data: summary } = useFinancialSummary(from, to) as { data: SummaryData | undefined };

  if (!can("financeiro", "view")) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Você não tem permissão para acessar o financeiro.
          </p>
        </div>
      </div>
    );
  }

  const dayFrom = new Date();
  dayFrom.setHours(0, 0, 0, 0);
  const dayTo = endOfDay(today);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Financeiro</h1>
        <p className="mt-1 text-sm text-slate-500">Resumo do mês atual</p>
      </div>

      {(pending as unknown[]).length > 0 && (
        <Link href="/financeiro/cobrancas">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 hover:bg-amber-100 transition-colors">
            <AlertCircle className="size-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {(pending as unknown[]).length} cobrança
                {(pending as unknown[]).length !== 1 ? "s" : ""} pendente
                {(pending as unknown[]).length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-600">Clique para ver e registrar pagamentos</p>
            </div>
            <ArrowRight className="size-4 text-amber-600" />
          </div>
        </Link>
      )}

      {summary && (
        <div className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-700">Resultado do mês</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Receita bruta</span>
              <span>{fmt(summary.grossRevenue)}</span>
            </div>
            {summary.discounts > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Descontos</span>
                <span>-{fmt(summary.discounts)}</span>
              </div>
            )}
            {summary.tips > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Gorjetas</span>
                <span>+{fmt(summary.tips)}</span>
              </div>
            )}
            {summary.cardFees > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Taxas de cartão</span>
                <span>-{fmt(summary.cardFees)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium border-t border-slate-100 pt-1.5">
              <span>Receita líquida</span>
              <span>{fmt(summary.netRevenue)}</span>
            </div>

            {/* Breakdown de despesas */}
            {summary.supplyExpenses > 0 && (
              <div className="space-y-0.5 pl-2 border-l-2 border-slate-100 mt-1">
                <div className="flex justify-between text-slate-500">
                  <span>Insumos de serviço</span>
                  <span>-{fmt(summary.supplyExpenses)}</span>
                </div>
                {summary.supplyReversals > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span className="pl-2 text-xs">↩ Estornos de insumo</span>
                    <span>+{fmt(summary.supplyReversals)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 text-xs">
                  <span className="pl-2">Custo líquido</span>
                  <span>-{fmt(summary.netSupplyCost)}</span>
                </div>
              </div>
            )}
            {summary.stockPurchases > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Compras de estoque</span>
                <span>-{fmt(summary.stockPurchases)}</span>
              </div>
            )}
            {summary.operationalExpenses > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Despesas operacionais</span>
                <span>-{fmt(summary.operationalExpenses)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Total despesas</span>
              <span>-{fmt(summary.totalExpenses)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-1.5">
              <span>Lucro real</span>
              <span className={summary.profit >= 0 ? "text-emerald-700" : "text-red-600"}>
                {fmt(summary.profit)}
              </span>
            </div>
          </div>
        </div>
      )}

      <FinancialDaySummary />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Transações de hoje</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/financeiro/despesas" className="flex items-center gap-1 text-slate-500">
                Despesas <ArrowRight className="size-3" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link
                href="/financeiro/transacoes"
                className="flex items-center gap-1 text-slate-500"
              >
                Ver histórico <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Filtros locais das transações do dia */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Select
            value={txType}
            onValueChange={(v) => setTxType(v as typeof txType)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Tipo: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="INCOME">Receita</SelectItem>
              <SelectItem value="EXPENSE">Despesa / Estorno</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={txCategory}
            onValueChange={(v) => setTxCategory(v)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Categoria: Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TransactionList
          from={dayFrom.toISOString()}
          to={dayTo.toISOString()}
          type={txType === "all" ? undefined : txType}
          category={txCategory === "all" ? undefined : txCategory}
          pageSize={10}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/financeiro/page.tsx
git commit -m "feat(financial): breakdown de custos e filtros no dashboard financeiro"
```

---

## Task 10: Corrigir reports service e relatório financeiro

**Files:**
- Modify: `src/domains/reports/types.ts`
- Modify: `src/domains/reports/reports.service.ts`
- Modify: `src/app/(app)/relatorios/financeiro/page.tsx`

- [ ] **Step 1: Adicionar `estornos` ao tipo `FinancialReport`**

Em `src/domains/reports/types.ts`, localizar o tipo `FinancialReport` e adicionar o campo `estornos`:

```typescript
export type FinancialReport = {
  kpis: {
    receita: number
    despesa: number
    estornos: number
    saldo: number
    ticketMedio: number
  }
  rows: FinancialReportRow[]
}
```

- [ ] **Step 2: Corrigir o cálculo de despesa no `reports.service.ts`**

Adicionar o import de `isReversal` no topo de `src/domains/reports/reports.service.ts`, após os imports existentes:

```typescript
import { isReversal } from '@/domains/financial/categories'
```

Substituir o método `getFinancialReport` completo em `src/domains/reports/reports.service.ts`:

```typescript
async getFinancialReport(
  tenantId: string,
  input: FinancialReportInput,
): Promise<FinancialReport> {
  const from = input.from ? new Date(input.from) : defaultFrom()
  const to = input.to ? new Date(input.to) : defaultTo()

  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      ...(input.type && { type: input.type }),
      paidAt: { gte: from, lte: to },
      ...((input.professionalId || input.serviceId) && {
        appointment: {
          ...(input.professionalId && { professionalId: input.professionalId }),
          ...(input.serviceId && { serviceId: input.serviceId }),
        },
      }),
    },
    include: {
      appointment: {
        include: {
          professional: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
      },
    },
  })

  const isReversalTx = (t: (typeof transactions)[0]) =>
    isReversal(t.category, Number(t.amount))

  const receita = transactions
    .filter((t) => t.type === TransactionType.INCOME)
    .reduce((s, t) => s + Number(t.amount), 0)

  const estornos = transactions
    .filter((t) => t.type === TransactionType.EXPENSE && isReversalTx(t))
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  const grossExpenses = transactions
    .filter((t) => t.type === TransactionType.EXPENSE && !isReversalTx(t))
    .reduce((s, t) => s + Number(t.amount), 0)

  const despesa = Math.max(0, grossExpenses - estornos)

  const appointmentIdsComReceita = new Set(
    transactions
      .filter((t) => t.type === TransactionType.INCOME && t.appointmentId)
      .map((t) => t.appointmentId),
  )
  const ticketMedio =
    appointmentIdsComReceita.size > 0 ? receita / appointmentIdsComReceita.size : 0

  const byGroup = new Map<string, { label: string; quantidade: number; receita: number }>()
  for (const tx of transactions.filter((t) => t.type === TransactionType.INCOME)) {
    const label =
      input.groupBy === 'profissional'
        ? (tx.appointment?.professional?.name ?? 'Sem profissional')
        : (tx.appointment?.service?.name ?? 'Sem serviço')
    const prev = byGroup.get(label) ?? { label, quantidade: 0, receita: 0 }
    byGroup.set(label, {
      label,
      quantidade: prev.quantidade + 1,
      receita: prev.receita + Number(tx.amount),
    })
  }
  const rows = [...byGroup.values()].sort((a, b) => b.receita - a.receita)

  return {
    kpis: { receita, despesa, estornos, saldo: receita - despesa, ticketMedio },
    rows,
  }
}
```

Também adicionar o import de `isReversal` no topo do arquivo:

```typescript
import { isReversal } from '@/domains/financial/categories'
```

- [ ] **Step 3: Adicionar KPI de estornos na página do relatório**

Em `src/app/(app)/relatorios/financeiro/page.tsx`, localizar o array `kpis` e adicionar o card de estornos:

```typescript
const kpis: KpiCard[] = data
  ? [
      { label: 'Receita', value: fmtBRL(data.kpis.receita) },
      { label: 'Despesa', value: fmtBRL(data.kpis.despesa) },
      ...(data.kpis.estornos > 0
        ? [{ label: 'Estornos', value: fmtBRL(data.kpis.estornos) }]
        : []),
      { label: 'Saldo', value: fmtBRL(data.kpis.saldo) },
      { label: 'Ticket médio', value: fmtBRL(data.kpis.ticketMedio) },
    ]
  : []
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/domains/reports/types.ts src/domains/reports/reports.service.ts src/app/\(app\)/relatorios/financeiro/page.tsx
git commit -m "fix(reports): corrige cálculo de despesas excluindo estornos e exibe KPI de estornos"
```

---

## Task 11: Branch, PR e finalização

- [ ] **Step 1: Verificar que está em uma branch dedicada**

```bash
git branch --show-current
```

Se estiver em `main`, criar a branch antes de iniciar os tasks (voltar ao Task 1 e criar a branch primeiro):

```bash
git checkout -b feat/financial-corrections
```

- [ ] **Step 2: Rodar TypeScript e testes finais**

```bash
npx tsc --noEmit && npx vitest run
```

Esperado: zero erros TypeScript, todos os testes passando.

- [ ] **Step 3: Abrir PR para main**

```bash
gh pr create \
  --title "fix(financial): corrige estornos, adiciona filtros e breakdown de custos" \
  --body "$(cat <<'EOF'
## Resumo
- Corrige exibição de estornos de insumo (duplo negativo → crédito âmbar +R$)
- Adiciona badges de categoria em todos os cards de transação
- Inclui 4 filtros completos no histórico (período, tipo, categoria, profissional)
- Adiciona filtros de tipo e categoria no dashboard financeiro
- Corrige summary API com breakdown: insumos, estornos, compras, operacional
- Corrige cálculo de despesas no relatório financeiro (exclui estornos do total)
- Adiciona KPI de estornos no relatório quando há valores

## Plano de teste
- [ ] Verificar que estornos de insumo aparecem como +R$ âmbar na lista de transações
- [ ] Confirmar que `-R$-30,00` não aparece mais em nenhuma transação
- [ ] Testar filtro por período, tipo, categoria e profissional no histórico
- [ ] Conferir o painel "Resultado do mês" com breakdown de insumos/estornos
- [ ] Verificar KPIs no relatório financeiro com e sem estornos

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notas de compatibilidade retroativa

Registros existentes com `category = 'Insumo de Atendimento'` e `amount < 0` continuam funcionando:
- `isReversal(category, amount)` retorna `true` para `amount < 0`
- O card exibe como crédito âmbar automaticamente
- O summary e o reports service calculam corretamente via `Math.abs(amount)`
