# Relatórios Avançados — Plano de Implementação

> **Para agentes:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Goal:** Implementar seção /relatorios com 4 tipos de relatório (Financeiro, Agendamentos, Clientes, Profissionais), filtros de período + filtros específicos por tipo, KPIs, tabela de detalhamento, exportação CSV e logo clicável voltando ao dashboard.

**Architecture:** 4 endpoints dedicados em `/api/reports/*` que executam queries analíticas (findMany + aggregate em JS) diretamente via Prisma no `ReportsService`. Frontend com layout compartilhado, filtros via useState em cada página, hooks TanStack Query por relatório, componentes genéricos reutilizáveis.

**Tech Stack:** Next.js 15 App Router, Prisma, Zod, TanStack Query v5, Shadcn UI, TailwindCSS, Lucide React

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/components/app/app-shell.tsx` | Modificar | Logo clicável → /dashboard + item Relatórios no nav |
| `src/lib/dates.ts` | Criar | Helpers de data (startOfDay, startOfMonth, etc.) |
| `src/lib/csv.ts` | Criar | exportCsv() — gera e dispara download de CSV |
| `src/domains/reports/types.ts` | Criar | Schemas Zod de input e tipos de output de cada relatório |
| `src/domains/reports/reports.service.ts` | Criar | Queries analíticas Prisma para os 4 relatórios |
| `src/app/api/reports/financial/route.ts` | Criar | GET /api/reports/financial |
| `src/app/api/reports/appointments/route.ts` | Criar | GET /api/reports/appointments |
| `src/app/api/reports/customers/route.ts` | Criar | GET /api/reports/customers |
| `src/app/api/reports/professionals/route.ts` | Criar | GET /api/reports/professionals |
| `src/hooks/reports/use-financial-report.ts` | Criar | Hook TanStack Query para relatório financeiro |
| `src/hooks/reports/use-appointments-report.ts` | Criar | Hook TanStack Query para relatório de agendamentos |
| `src/hooks/reports/use-customers-report.ts` | Criar | Hook TanStack Query para relatório de clientes |
| `src/hooks/reports/use-professionals-report.ts` | Criar | Hook TanStack Query para relatório de profissionais |
| `src/components/domain/reports/period-filter.tsx` | Criar | Pills de período + date picker personalizado |
| `src/components/domain/reports/report-kpis.tsx` | Criar | Grid de cards KPI reutilizável |
| `src/components/domain/reports/report-table.tsx` | Criar | Tabela genérica com colunas configuráveis |
| `src/components/domain/reports/export-csv-button.tsx` | Criar | Botão de exportação CSV |
| `src/components/domain/reports/reports-sidebar.tsx` | Criar | Menu lateral interno com 4 itens |
| `src/app/(app)/relatorios/layout.tsx` | Criar | Layout com sidebar de relatórios |
| `src/app/(app)/relatorios/page.tsx` | Criar | Redirect para /relatorios/financeiro |
| `src/app/(app)/relatorios/financeiro/page.tsx` | Criar | Página do relatório financeiro |
| `src/app/(app)/relatorios/agendamentos/page.tsx` | Criar | Página do relatório de agendamentos |
| `src/app/(app)/relatorios/clientes/page.tsx` | Criar | Página do relatório de clientes |
| `src/app/(app)/relatorios/profissionais/page.tsx` | Criar | Página do relatório de profissionais |

---

## Task 0: Logo clicável + "Relatórios" no nav

**Files:**
- Modify: `src/components/app/app-shell.tsx`

- [ ] **Passo 1: Adicionar Link no logo da sidebar desktop**

Em `src/components/app/app-shell.tsx`, substitua o bloco do logo da sidebar (a `<div>` com `flex items-center gap-3` que tem o `Sparkles`) por um Link:

```tsx
// Antes (linha ~78):
<div className="flex items-center gap-3">
  <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 shadow-sm">
    <Sparkles className="size-5" />
  </div>
  <div>
    <p className="text-xs font-semibold tracking-[0.24em] text-rose-500 uppercase">
      SaaS Estética
    </p>
    <h1 className="text-lg font-semibold text-slate-950">
      Operational Workspace
    </h1>
  </div>
</div>

// Depois:
<Link
  href="/dashboard"
  title="Ir para Dashboard"
  className="flex items-center gap-3 rounded-2xl p-1 transition hover:bg-rose-50"
>
  <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 shadow-sm">
    <Sparkles className="size-5" />
  </div>
  <div>
    <p className="text-xs font-semibold tracking-[0.24em] text-rose-500 uppercase">
      SaaS Estética
    </p>
    <h1 className="text-lg font-semibold text-slate-950">
      Operational Workspace
    </h1>
  </div>
</Link>
```

- [ ] **Passo 2: Adicionar Link no ícone do header mobile**

Ainda em `app-shell.tsx`, no `<header>`, substitua a `<div className="xl:hidden">` que contém o Sparkles:

```tsx
// Antes (linha ~190):
<div className="xl:hidden">
  <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
    <Sparkles className="size-5" />
  </div>
</div>

// Depois:
<div className="xl:hidden">
  <Link
    href="/dashboard"
    title="Ir para Dashboard"
    className="inline-flex size-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 transition hover:bg-rose-200"
  >
    <Sparkles className="size-5" />
  </Link>
</div>
```

- [ ] **Passo 3: Adicionar "Relatórios" ao NAV_ITEMS e importar BarChart2**

No topo do arquivo, adicione `BarChart2` ao import do lucide-react:

```tsx
import {
  BarChart2,
  CalendarDays,
  CreditCard,
  LogOut,
  Settings,
  Sparkles,
  Users,
  UserCog,
} from 'lucide-react'
```

No array `NAV_ITEMS`, adicione após o item "Financeiro":

```tsx
{
  label: 'Relatórios',
  description: 'Análises e exportações',
  icon: BarChart2,
  href: '/relatorios',
  permission: 'financial:view',
},
```

- [ ] **Passo 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(nav): logo clicável → dashboard + adiciona Relatórios ao menu"
```

---

## Task 1: Helpers de data e utilitário CSV

**Files:**
- Create: `src/lib/dates.ts`
- Create: `src/lib/csv.ts`

- [ ] **Passo 1: Criar `src/lib/dates.ts`**

```typescript
export function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

export function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  const diff = day === 0 ? -6 : 1 - day // segunda-feira
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d)
  const r = new Date(start)
  r.setDate(r.getDate() + 6)
  r.setHours(23, 59, 59, 999)
  return r
}

export function startOfPrevMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0)
}

export function endOfPrevMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999)
}

export function defaultFrom(): Date {
  return startOfMonth(new Date())
}

export function defaultTo(): Date {
  return endOfDay(new Date())
}
```

- [ ] **Passo 2: Criar `src/lib/csv.ts`**

```typescript
export function exportCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ]

  const blob = new Blob(['﻿' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

> O `﻿` (BOM) garante que o Excel abre o CSV com acentos corretamente.

- [ ] **Passo 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/dates.ts src/lib/csv.ts
git commit -m "feat(lib): helpers de data e utilitário exportCsv"
```

---

## Task 2: Tipos e Service do domínio reports

**Files:**
- Create: `src/domains/reports/types.ts`
- Create: `src/domains/reports/reports.service.ts`

- [ ] **Passo 1: Criar `src/domains/reports/types.ts`**

```typescript
import { AppointmentStatus, TransactionType } from '@prisma/client'
import { z } from 'zod'

// ── Financeiro ──────────────────────────────────────────────────────────────

export const financialReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  professionalId: z.string().uuid().optional(),
  serviceId: z.string().cuid().optional(),
  groupBy: z.enum(['profissional', 'servico']).default('servico'),
})

export type FinancialReportInput = z.infer<typeof financialReportSchema>

export type FinancialReportRow = {
  label: string
  quantidade: number
  receita: number
}

export type FinancialReport = {
  kpis: {
    receita: number
    despesa: number
    saldo: number
    ticketMedio: number
  }
  rows: FinancialReportRow[]
}

// ── Agendamentos ─────────────────────────────────────────────────────────────

export const appointmentsReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.array(z.nativeEnum(AppointmentStatus)).optional(),
  professionalId: z.string().uuid().optional(),
  serviceId: z.string().cuid().optional(),
  groupBy: z.enum(['profissional', 'servico']).default('profissional'),
})

export type AppointmentsReportInput = z.infer<typeof appointmentsReportSchema>

export type AppointmentsReportRow = {
  label: string
  total: number
  concluidos: number
  cancelados: number
  naoCompareceu: number
}

export type AppointmentsReport = {
  kpis: {
    total: number
    concluidos: number
    cancelados: number
    naoCompareceu: number
    taxaConclusao: number
  }
  rows: AppointmentsReportRow[]
}

// ── Clientes ──────────────────────────────────────────────────────────────────

export const customersReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  professionalId: z.string().uuid().optional(),
  serviceId: z.string().cuid().optional(),
})

export type CustomersReportInput = z.infer<typeof customersReportSchema>

export type CustomersReportRow = {
  clienteNome: string
  atendimentos: number
  receita: number
  ultimoAtendimento: string
}

export type CustomersReport = {
  kpis: {
    totalAtivos: number
    novosNoPeriodo: number
    retorno: number
  }
  rows: CustomersReportRow[]
}

// ── Profissionais ─────────────────────────────────────────────────────────────

export const professionalsReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  professionalIds: z.array(z.string().uuid()).optional(),
  serviceId: z.string().cuid().optional(),
  status: z.array(z.nativeEnum(AppointmentStatus)).optional(),
})

export type ProfessionalsReportInput = z.infer<typeof professionalsReportSchema>

export type ProfessionalsReportRow = {
  profissionalNome: string
  atendimentos: number
  receita: number
  ticketMedio: number
}

export type ProfessionalsReport = {
  kpis: {
    totalAtendimentos: number
    receitaTotal: number
  }
  rows: ProfessionalsReportRow[]
}
```

- [ ] **Passo 2: Criar `src/domains/reports/reports.service.ts`**

```typescript
import { AppointmentStatus, TransactionType } from '@prisma/client'

import { prisma } from '@/shared/database/prisma'
import { defaultFrom, defaultTo } from '@/lib/dates'

import type {
  AppointmentsReport,
  AppointmentsReportInput,
  CustomersReport,
  CustomersReportInput,
  FinancialReport,
  FinancialReportInput,
  ProfessionalsReport,
  ProfessionalsReportInput,
} from './types'

export class ReportsService {
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
        ...(input.professionalId && {
          appointment: { professionalId: input.professionalId },
        }),
        ...(input.serviceId && {
          appointment: { serviceId: input.serviceId },
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

    const receita = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + Number(t.amount), 0)

    const despesa = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + Number(t.amount), 0)

    const completedCount = await prisma.appointment.count({
      where: {
        tenantId,
        status: AppointmentStatus.COMPLETED,
        startsAt: { gte: from, lte: to },
      },
    })

    const ticketMedio = completedCount > 0 ? receita / completedCount : 0

    const byGroup = new Map<string, { label: string; quantidade: number; receita: number }>()
    for (const tx of transactions) {
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
      kpis: { receita, despesa, saldo: receita - despesa, ticketMedio },
      rows,
    }
  }

  async getAppointmentsReport(
    tenantId: string,
    input: AppointmentsReportInput,
  ): Promise<AppointmentsReport> {
    const from = input.from ? new Date(input.from) : defaultFrom()
    const to = input.to ? new Date(input.to) : defaultTo()

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        startsAt: { gte: from, lte: to },
        ...(input.status?.length && { status: { in: input.status } }),
        ...(input.professionalId && { professionalId: input.professionalId }),
        ...(input.serviceId && { serviceId: input.serviceId }),
      },
      include: {
        professional: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    })

    const total = appointments.length
    const concluidos = appointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length
    const cancelados = appointments.filter((a) => a.status === AppointmentStatus.CANCELLED).length
    const naoCompareceu = appointments.filter((a) => a.status === AppointmentStatus.NO_SHOW).length
    const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0

    type RowAcc = { label: string; total: number; concluidos: number; cancelados: number; naoCompareceu: number }
    const byGroup = new Map<string, RowAcc>()
    for (const apt of appointments) {
      const label =
        input.groupBy === 'servico'
          ? (apt.service?.name ?? 'Sem serviço')
          : (apt.professional?.name ?? 'Sem profissional')
      const prev = byGroup.get(label) ?? { label, total: 0, concluidos: 0, cancelados: 0, naoCompareceu: 0 }
      byGroup.set(label, {
        label,
        total: prev.total + 1,
        concluidos: prev.concluidos + (apt.status === AppointmentStatus.COMPLETED ? 1 : 0),
        cancelados: prev.cancelados + (apt.status === AppointmentStatus.CANCELLED ? 1 : 0),
        naoCompareceu: prev.naoCompareceu + (apt.status === AppointmentStatus.NO_SHOW ? 1 : 0),
      })
    }
    const rows = [...byGroup.values()].sort((a, b) => b.total - a.total)

    return { kpis: { total, concluidos, cancelados, naoCompareceu, taxaConclusao }, rows }
  }

  async getCustomersReport(
    tenantId: string,
    input: CustomersReportInput,
  ): Promise<CustomersReport> {
    const from = input.from ? new Date(input.from) : defaultFrom()
    const to = input.to ? new Date(input.to) : defaultTo()

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        startsAt: { gte: from, lte: to },
        status: { not: AppointmentStatus.CANCELLED },
        ...(input.professionalId && { professionalId: input.professionalId }),
        ...(input.serviceId && { serviceId: input.serviceId }),
      },
      include: {
        customer: { select: { id: true, name: true } },
        transactions: { select: { amount: true, type: true } },
      },
      orderBy: { startsAt: 'desc' },
    })

    type CustomerAcc = {
      nome: string
      atendimentos: number
      receita: number
      ultimoAtendimento: Date
    }
    const byCustomer = new Map<string, CustomerAcc>()
    for (const apt of appointments) {
      const prev = byCustomer.get(apt.customerId)
      const receita = apt.transactions
        .filter((t) => t.type === TransactionType.INCOME)
        .reduce((s, t) => s + Number(t.amount), 0)
      byCustomer.set(apt.customerId, {
        nome: apt.customer.name,
        atendimentos: (prev?.atendimentos ?? 0) + 1,
        receita: (prev?.receita ?? 0) + receita,
        ultimoAtendimento: prev
          ? prev.ultimoAtendimento > apt.startsAt
            ? prev.ultimoAtendimento
            : apt.startsAt
          : apt.startsAt,
      })
    }

    const totalAtivos = byCustomer.size
    const retorno = [...byCustomer.values()].filter((c) => c.atendimentos >= 2).length

    const novosNoPeriodo = await prisma.customer.count({
      where: { tenantId, createdAt: { gte: from, lte: to } },
    })

    const rows = [...byCustomer.values()]
      .sort((a, b) => b.atendimentos - a.atendimentos)
      .map((c) => ({
        clienteNome: c.nome,
        atendimentos: c.atendimentos,
        receita: c.receita,
        ultimoAtendimento: c.ultimoAtendimento.toISOString(),
      }))

    return { kpis: { totalAtivos, novosNoPeriodo, retorno }, rows }
  }

  async getProfessionalsReport(
    tenantId: string,
    input: ProfessionalsReportInput,
  ): Promise<ProfessionalsReport> {
    const from = input.from ? new Date(input.from) : defaultFrom()
    const to = input.to ? new Date(input.to) : defaultTo()

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        startsAt: { gte: from, lte: to },
        ...(input.status?.length && { status: { in: input.status } }),
        ...(input.professionalIds?.length && {
          professionalId: { in: input.professionalIds },
        }),
        ...(input.serviceId && { serviceId: input.serviceId }),
      },
      include: {
        professional: { select: { id: true, name: true } },
        transactions: { select: { amount: true, type: true } },
      },
    })

    type ProfAcc = { nome: string; atendimentos: number; receita: number }
    const byProf = new Map<string, ProfAcc>()
    for (const apt of appointments) {
      const prev = byProf.get(apt.professionalId)
      const receita = apt.transactions
        .filter((t) => t.type === TransactionType.INCOME)
        .reduce((s, t) => s + Number(t.amount), 0)
      byProf.set(apt.professionalId, {
        nome: apt.professional.name,
        atendimentos: (prev?.atendimentos ?? 0) + 1,
        receita: (prev?.receita ?? 0) + receita,
      })
    }

    const totalAtendimentos = appointments.length
    const receitaTotal = [...byProf.values()].reduce((s, p) => s + p.receita, 0)

    const rows = [...byProf.values()]
      .sort((a, b) => b.receita - a.receita)
      .map((p) => ({
        profissionalNome: p.nome,
        atendimentos: p.atendimentos,
        receita: p.receita,
        ticketMedio: p.atendimentos > 0 ? p.receita / p.atendimentos : 0,
      }))

    return { kpis: { totalAtendimentos, receitaTotal }, rows }
  }
}

export const reportsService = new ReportsService()
```

- [ ] **Passo 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 4: Commit**

```bash
git add src/domains/reports/
git commit -m "feat(reports): tipos Zod e ReportsService com 4 queries analíticas"
```

---

## Task 3: API Routes dos relatórios

**Files:**
- Create: `src/app/api/reports/financial/route.ts`
- Create: `src/app/api/reports/appointments/route.ts`
- Create: `src/app/api/reports/customers/route.ts`
- Create: `src/app/api/reports/professionals/route.ts`

- [ ] **Passo 1: Criar `src/app/api/reports/financial/route.ts`**

```typescript
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { reportsService } from '@/domains/reports/reports.service'
import { financialReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.financial.view)

    const url = new URL(request.url)
    const sp = url.searchParams
    const input = financialReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      type: sp.get('type') ?? undefined,
      professionalId: sp.get('professionalId') ?? undefined,
      serviceId: sp.get('serviceId') ?? undefined,
      groupBy: sp.get('groupBy') ?? undefined,
    })

    const result = await reportsService.getFinancialReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 2: Criar `src/app/api/reports/appointments/route.ts`**

```typescript
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { reportsService } from '@/domains/reports/reports.service'
import { appointmentsReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.appointments.view)

    const url = new URL(request.url)
    const sp = url.searchParams
    const input = appointmentsReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      status: sp.getAll('status').length > 0 ? sp.getAll('status') : undefined,
      professionalId: sp.get('professionalId') ?? undefined,
      serviceId: sp.get('serviceId') ?? undefined,
      groupBy: sp.get('groupBy') ?? undefined,
    })

    const result = await reportsService.getAppointmentsReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 3: Criar `src/app/api/reports/customers/route.ts`**

```typescript
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { reportsService } from '@/domains/reports/reports.service'
import { customersReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.customers.view)

    const url = new URL(request.url)
    const sp = url.searchParams
    const input = customersReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      professionalId: sp.get('professionalId') ?? undefined,
      serviceId: sp.get('serviceId') ?? undefined,
    })

    const result = await reportsService.getCustomersReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 4: Criar `src/app/api/reports/professionals/route.ts`**

```typescript
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { reportsService } from '@/domains/reports/reports.service'
import { professionalsReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.appointments.view)

    const url = new URL(request.url)
    const sp = url.searchParams
    const input = professionalsReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      professionalIds: sp.getAll('professionalIds').length > 0 ? sp.getAll('professionalIds') : undefined,
      serviceId: sp.get('serviceId') ?? undefined,
      status: sp.getAll('status').length > 0 ? sp.getAll('status') : undefined,
    })

    const result = await reportsService.getProfessionalsReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Passo 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 6: Commit**

```bash
git add src/app/api/reports/
git commit -m "feat(api): endpoints GET /api/reports/{financial,appointments,customers,professionals}"
```

---

## Task 4: Hooks TanStack Query

**Files:**
- Create: `src/hooks/reports/use-financial-report.ts`
- Create: `src/hooks/reports/use-appointments-report.ts`
- Create: `src/hooks/reports/use-customers-report.ts`
- Create: `src/hooks/reports/use-professionals-report.ts`

- [ ] **Passo 1: Criar `src/hooks/reports/use-financial-report.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import type { FinancialReport } from '@/domains/reports/types'

export type FinancialReportParams = {
  from?: string
  to?: string
  type?: 'INCOME' | 'EXPENSE'
  professionalId?: string
  serviceId?: string
  groupBy?: 'profissional' | 'servico'
}

async function fetchFinancialReport(params: FinancialReportParams): Promise<FinancialReport> {
  const url = new URL('/api/reports/financial', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.type) url.searchParams.set('type', params.type)
  if (params.professionalId) url.searchParams.set('professionalId', params.professionalId)
  if (params.serviceId) url.searchParams.set('serviceId', params.serviceId)
  if (params.groupBy) url.searchParams.set('groupBy', params.groupBy)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar relatório financeiro')
  return res.json()
}

export function useFinancialReport(params: FinancialReportParams) {
  return useQuery({
    queryKey: ['reports', 'financial', params],
    queryFn: () => fetchFinancialReport(params),
    staleTime: 60_000,
  })
}
```

- [ ] **Passo 2: Criar `src/hooks/reports/use-appointments-report.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import type { AppointmentsReport } from '@/domains/reports/types'

export type AppointmentsReportParams = {
  from?: string
  to?: string
  status?: string[]
  professionalId?: string
  serviceId?: string
  groupBy?: 'profissional' | 'servico'
}

async function fetchAppointmentsReport(params: AppointmentsReportParams): Promise<AppointmentsReport> {
  const url = new URL('/api/reports/appointments', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  params.status?.forEach((s) => url.searchParams.append('status', s))
  if (params.professionalId) url.searchParams.set('professionalId', params.professionalId)
  if (params.serviceId) url.searchParams.set('serviceId', params.serviceId)
  if (params.groupBy) url.searchParams.set('groupBy', params.groupBy)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar relatório de agendamentos')
  return res.json()
}

export function useAppointmentsReport(params: AppointmentsReportParams) {
  return useQuery({
    queryKey: ['reports', 'appointments', params],
    queryFn: () => fetchAppointmentsReport(params),
    staleTime: 60_000,
  })
}
```

- [ ] **Passo 3: Criar `src/hooks/reports/use-customers-report.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import type { CustomersReport } from '@/domains/reports/types'

export type CustomersReportParams = {
  from?: string
  to?: string
  professionalId?: string
  serviceId?: string
}

async function fetchCustomersReport(params: CustomersReportParams): Promise<CustomersReport> {
  const url = new URL('/api/reports/customers', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.professionalId) url.searchParams.set('professionalId', params.professionalId)
  if (params.serviceId) url.searchParams.set('serviceId', params.serviceId)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar relatório de clientes')
  return res.json()
}

export function useCustomersReport(params: CustomersReportParams) {
  return useQuery({
    queryKey: ['reports', 'customers', params],
    queryFn: () => fetchCustomersReport(params),
    staleTime: 60_000,
  })
}
```

- [ ] **Passo 4: Criar `src/hooks/reports/use-professionals-report.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import type { ProfessionalsReport } from '@/domains/reports/types'

export type ProfessionalsReportParams = {
  from?: string
  to?: string
  professionalIds?: string[]
  serviceId?: string
  status?: string[]
}

async function fetchProfessionalsReport(params: ProfessionalsReportParams): Promise<ProfessionalsReport> {
  const url = new URL('/api/reports/professionals', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  params.professionalIds?.forEach((id) => url.searchParams.append('professionalIds', id))
  if (params.serviceId) url.searchParams.set('serviceId', params.serviceId)
  params.status?.forEach((s) => url.searchParams.append('status', s))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar relatório de profissionais')
  return res.json()
}

export function useProfessionalsReport(params: ProfessionalsReportParams) {
  return useQuery({
    queryKey: ['reports', 'professionals', params],
    queryFn: () => fetchProfessionalsReport(params),
    staleTime: 60_000,
  })
}
```

- [ ] **Passo 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 6: Commit**

```bash
git add src/hooks/reports/
git commit -m "feat(hooks): hooks TanStack Query para os 4 relatórios"
```

---

## Task 5: Componentes compartilhados de relatórios

**Files:**
- Create: `src/components/domain/reports/period-filter.tsx`
- Create: `src/components/domain/reports/report-kpis.tsx`
- Create: `src/components/domain/reports/report-table.tsx`
- Create: `src/components/domain/reports/export-csv-button.tsx`
- Create: `src/components/domain/reports/reports-sidebar.tsx`

- [ ] **Passo 1: Criar `src/components/domain/reports/period-filter.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfPrevMonth, endOfPrevMonth,
} from '@/lib/dates'

export type PeriodValue = { from: string; to: string }

type Preset = 'hoje' | 'semana' | 'mes' | 'mes-passado' | 'personalizado'

function toISO(d: Date) {
  return d.toISOString()
}

function presetToPeriod(preset: Exclude<Preset, 'personalizado'>): PeriodValue {
  const now = new Date()
  const map: Record<Exclude<Preset, 'personalizado'>, PeriodValue> = {
    hoje: { from: toISO(startOfDay(now)), to: toISO(endOfDay(now)) },
    semana: { from: toISO(startOfWeek(now)), to: toISO(endOfWeek(now)) },
    mes: { from: toISO(startOfMonth(now)), to: toISO(endOfDay(now)) },
    'mes-passado': { from: toISO(startOfPrevMonth(now)), to: toISO(endOfPrevMonth(now)) },
  }
  return map[preset]
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'personalizado', label: 'Personalizado' },
]

type Props = {
  onChange: (v: PeriodValue) => void
}

export function PeriodFilter({ onChange }: Props) {
  const [active, setActive] = useState<Preset>('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  function handlePreset(preset: Preset) {
    setActive(preset)
    if (preset !== 'personalizado') {
      onChange(presetToPeriod(preset))
    }
  }

  function handleCustomChange(from: string, to: string) {
    if (from && to) {
      onChange({
        from: toISO(startOfDay(new Date(from))),
        to: toISO(endOfDay(new Date(to))),
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-medium transition',
              active === key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {active === 'personalizado' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value)
              handleCustomChange(e.target.value, customTo)
            }}
            className="w-36 text-sm"
          />
          <span className="text-xs text-slate-400">até</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value)
              handleCustomChange(customFrom, e.target.value)
            }}
            className="w-36 text-sm"
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 2: Criar `src/components/domain/reports/report-kpis.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export type KpiCard = {
  label: string
  value: string | number
}

type Props = {
  cards: KpiCard[]
  isLoading: boolean
}

export function ReportKpis({ cards, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Passo 3: Criar `src/components/domain/reports/report-table.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export type ReportColumn = {
  key: string
  header: string
  align?: 'left' | 'right'
  format?: (value: unknown) => string
}

type Props = {
  columns: ReportColumn[]
  rows: object[]
  isLoading: boolean
  emptyMessage?: string
}

export function ReportTable({ columns, rows, isLoading, emptyMessage = 'Nenhum dado no período.' }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, i) => {
            const r = row as Record<string, unknown>
            return (
              <tr key={i} className="bg-white hover:bg-slate-50 transition">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-slate-700 ${
                      col.align === 'right' ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    {col.format ? col.format(r[col.key]) : String(r[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Passo 4: Criar `src/components/domain/reports/export-csv-button.tsx`**

```tsx
'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportCsv } from '@/lib/csv'

type Props = {
  rows: Record<string, unknown>[]
  filename: string
  isLoading: boolean
}

export function ExportCsvButton({ rows, filename, isLoading }: Props) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isLoading || rows.length === 0}
      onClick={() => exportCsv(rows, filename)}
      className="gap-2"
    >
      <Download className="size-3.5" />
      Exportar CSV
    </Button>
  )
}
```

- [ ] **Passo 5: Criar `src/components/domain/reports/reports-sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Calendar, Users, Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'

const REPORT_ITEMS = [
  { label: 'Financeiro', href: '/relatorios/financeiro', icon: BarChart2 },
  { label: 'Agendamentos', href: '/relatorios/agendamentos', icon: Calendar },
  { label: 'Clientes', href: '/relatorios/clientes', icon: Users },
  { label: 'Profissionais', href: '/relatorios/profissionais', icon: Scissors },
] as const

export function ReportsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Tipo de relatório
      </p>
      {REPORT_ITEMS.map(({ label, href, icon: Icon }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-rose-50 text-rose-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Passo 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 7: Commit**

```bash
git add src/components/domain/reports/
git commit -m "feat(components): PeriodFilter, ReportKpis, ReportTable, ExportCsvButton, ReportsSidebar"
```

---

## Task 6: Layout e páginas de relatórios

**Files:**
- Create: `src/app/(app)/relatorios/layout.tsx`
- Create: `src/app/(app)/relatorios/page.tsx`
- Create: `src/app/(app)/relatorios/financeiro/page.tsx`
- Create: `src/app/(app)/relatorios/agendamentos/page.tsx`
- Create: `src/app/(app)/relatorios/clientes/page.tsx`
- Create: `src/app/(app)/relatorios/profissionais/page.tsx`

- [ ] **Passo 1: Criar `src/app/(app)/relatorios/layout.tsx`**

```tsx
import type { ReactNode } from 'react'
import { ReportsSidebar } from '@/components/domain/reports/reports-sidebar'

export default function RelatoriosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Relatórios</h1>
        <p className="mt-1 text-sm text-slate-500">Análises detalhadas do seu negócio</p>
      </div>
      <div className="flex gap-8">
        <aside className="w-52 shrink-0">
          <ReportsSidebar />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Criar `src/app/(app)/relatorios/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

export default function RelatoriosPage() {
  redirect('/relatorios/financeiro')
}
```

- [ ] **Passo 3: Criar `src/app/(app)/relatorios/financeiro/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useFinancialReport } from '@/hooks/reports/use-financial-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { startOfMonth, endOfDay } from '@/lib/dates'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

const COLUMNS: ReportColumn[] = [
  { key: 'label', header: 'Nome' },
  { key: 'quantidade', header: 'Transações', align: 'right' },
  { key: 'receita', header: 'Receita', align: 'right', format: (v) => fmtBRL(Number(v)) },
]

export default function RelatorioFinanceiroPage() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [groupBy, setGroupBy] = useState<'profissional' | 'servico'>('servico')
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | ''>('')

  const { data, isLoading, isError } = useFinancialReport({
    from: period.from,
    to: period.to,
    groupBy,
    type: type || undefined,
  })

  if (!can('financial:view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar dados financeiros.</p>
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
        Erro ao carregar relatório. Tente recarregar a página.
      </p>
    )
  }

  const kpis: KpiCard[] = data
    ? [
        { label: 'Receita', value: fmtBRL(data.kpis.receita) },
        { label: 'Despesa', value: fmtBRL(data.kpis.despesa) },
        { label: 'Saldo', value: fmtBRL(data.kpis.saldo) },
        { label: 'Ticket médio', value: fmtBRL(data.kpis.ticketMedio) },
      ]
    : []

  const csvRows = (data?.rows ?? []).map((r) => ({
    Nome: r.label,
    Transações: r.quantidade,
    'Receita (R$)': r.receita.toFixed(2),
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <PeriodFilter onChange={setPeriod} />
        <div className="flex flex-wrap gap-3">
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tipo: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="INCOME">Receita</SelectItem>
              <SelectItem value="EXPENSE">Despesa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Agrupar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="servico">Agrupar por serviço</SelectItem>
              <SelectItem value="profissional">Agrupar por profissional</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <ExportCsvButton rows={csvRows} filename="relatorio-financeiro.csv" isLoading={isLoading} />
          </div>
        </div>
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />
      <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
    </div>
  )
}
```

- [ ] **Passo 4: Criar `src/app/(app)/relatorios/agendamentos/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useAppointmentsReport } from '@/hooks/reports/use-appointments-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { startOfMonth, endOfDay } from '@/lib/dates'

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
}

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

const COLUMNS: ReportColumn[] = [
  { key: 'label', header: 'Nome' },
  { key: 'total', header: 'Total', align: 'right' },
  { key: 'concluidos', header: 'Concluídos', align: 'right' },
  { key: 'cancelados', header: 'Cancelados', align: 'right' },
  { key: 'naoCompareceu', header: 'Não compareceu', align: 'right' },
]

export default function RelatorioAgendamentosPage() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [status, setStatus] = useState<string>('')
  const [groupBy, setGroupBy] = useState<'profissional' | 'servico'>('profissional')

  const { data, isLoading, isError } = useAppointmentsReport({
    from: period.from,
    to: period.to,
    status: status ? [status] : undefined,
    groupBy,
  })

  if (!can('appointments:view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar agendamentos.</p>
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
        Erro ao carregar relatório. Tente recarregar a página.
      </p>
    )
  }

  const kpis: KpiCard[] = data
    ? [
        { label: 'Total', value: data.kpis.total },
        { label: 'Concluídos', value: data.kpis.concluidos },
        { label: 'Cancelados', value: data.kpis.cancelados },
        { label: 'Taxa de conclusão', value: `${data.kpis.taxaConclusao}%` },
      ]
    : []

  const csvRows = (data?.rows ?? []).map((r) => ({
    Nome: r.label,
    Total: r.total,
    Concluídos: r.concluidos,
    Cancelados: r.cancelados,
    'Não compareceu': r.naoCompareceu,
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <PeriodFilter onChange={setPeriod} />
        <div className="flex flex-wrap gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Status: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Agrupar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profissional">Agrupar por profissional</SelectItem>
              <SelectItem value="servico">Agrupar por serviço</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <ExportCsvButton rows={csvRows} filename="relatorio-agendamentos.csv" isLoading={isLoading} />
          </div>
        </div>
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />
      <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
    </div>
  )
}
```

- [ ] **Passo 5: Criar `src/app/(app)/relatorios/clientes/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useCustomersReport } from '@/hooks/reports/use-customers-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { startOfMonth, endOfDay } from '@/lib/dates'

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

const COLUMNS: ReportColumn[] = [
  { key: 'clienteNome', header: 'Cliente' },
  { key: 'atendimentos', header: 'Atendimentos', align: 'right' },
  { key: 'receita', header: 'Receita', align: 'right', format: (v) => fmtBRL(Number(v)) },
  { key: 'ultimoAtendimento', header: 'Último atendimento', align: 'right', format: (v) => fmtDate(String(v)) },
]

export default function RelatorioClientesPage() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)

  const { data, isLoading, isError } = useCustomersReport({
    from: period.from,
    to: period.to,
  })

  if (!can('customers:view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar clientes.</p>
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
        Erro ao carregar relatório. Tente recarregar a página.
      </p>
    )
  }

  const kpis: KpiCard[] = data
    ? [
        { label: 'Clientes ativos', value: data.kpis.totalAtivos },
        { label: 'Novos no período', value: data.kpis.novosNoPeriodo },
        { label: 'Retorno (2+ visitas)', value: data.kpis.retorno },
      ]
    : []

  const csvRows = (data?.rows ?? []).map((r) => ({
    Cliente: r.clienteNome,
    Atendimentos: r.atendimentos,
    'Receita (R$)': r.receita.toFixed(2),
    'Último atendimento': fmtDate(r.ultimoAtendimento),
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <PeriodFilter onChange={setPeriod} />
        <div className="flex justify-end">
          <ExportCsvButton rows={csvRows} filename="relatorio-clientes.csv" isLoading={isLoading} />
        </div>
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />
      <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
    </div>
  )
}
```

- [ ] **Passo 6: Criar `src/app/(app)/relatorios/profissionais/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useProfessionalsReport } from '@/hooks/reports/use-professionals-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { startOfMonth, endOfDay } from '@/lib/dates'

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

const COLUMNS: ReportColumn[] = [
  { key: 'profissionalNome', header: 'Profissional' },
  { key: 'atendimentos', header: 'Atendimentos', align: 'right' },
  { key: 'receita', header: 'Receita', align: 'right', format: (v) => fmtBRL(Number(v)) },
  { key: 'ticketMedio', header: 'Ticket médio', align: 'right', format: (v) => fmtBRL(Number(v)) },
]

export default function RelatorioProfissionaisPage() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [status, setStatus] = useState<string>('')

  const { data, isLoading, isError } = useProfessionalsReport({
    from: period.from,
    to: period.to,
    status: status ? [status] : undefined,
  })

  if (!can('appointments:view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar este relatório.</p>
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
        Erro ao carregar relatório. Tente recarregar a página.
      </p>
    )
  }

  const kpis: KpiCard[] = data
    ? [
        { label: 'Total de atendimentos', value: data.kpis.totalAtendimentos },
        { label: 'Receita total', value: fmtBRL(data.kpis.receitaTotal) },
      ]
    : []

  const csvRows = (data?.rows ?? []).map((r) => ({
    Profissional: r.profissionalNome,
    Atendimentos: r.atendimentos,
    'Receita (R$)': r.receita.toFixed(2),
    'Ticket médio (R$)': r.ticketMedio.toFixed(2),
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <PeriodFilter onChange={setPeriod} />
        <div className="flex flex-wrap gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Status: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <ExportCsvButton rows={csvRows} filename="relatorio-profissionais.csv" isLoading={isLoading} />
          </div>
        </div>
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />
      <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
    </div>
  )
}
```

- [ ] **Passo 7: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 8: Build para validar**

```bash
npm run build
```

Esperado: compilação sem erros.

- [ ] **Passo 9: Commit**

```bash
git add src/app/\(app\)/relatorios/
git commit -m "feat(relatorios): páginas de relatórios — financeiro, agendamentos, clientes, profissionais"
```

---

## Task 7: Verificação final em desenvolvimento

- [ ] **Passo 1: Iniciar o servidor de desenvolvimento**

```bash
npm run dev
```

- [ ] **Passo 2: Verificar logo clicável**

Abrir http://localhost:3000, navegar para qualquer página e clicar no logo `✨` da sidebar — deve ir para `/dashboard`.

- [ ] **Passo 3: Verificar Relatórios no menu**

O item "Relatórios" deve aparecer no menu lateral abaixo de "Financeiro".

- [ ] **Passo 4: Verificar redirect**

Acessar http://localhost:3000/relatorios deve redirecionar para http://localhost:3000/relatorios/financeiro.

- [ ] **Passo 5: Verificar cada relatório**

Para cada um dos 4 relatórios:
1. Filtros de período (pills) funcionam e atualizam a query
2. Filtros específicos (tipo, status, agrupamento) funcionam
3. KPIs e tabela renderizam com estado de loading (Skeleton)
4. Botão "Exportar CSV" fica habilitado após carregar dados e dispara download

- [ ] **Passo 6: Commit final**

```bash
git add -A
git commit -m "feat(relatorios): verificação final — seção de relatórios avançados completa"
```
