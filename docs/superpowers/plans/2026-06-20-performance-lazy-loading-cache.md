# Performance — Lazy Loading e Cache — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir bug de contagem no CustomerList, converter 6 páginas para Server Components com Suspense, padronizar staleTime por domínio e otimizar selects nos repositories de agendamento e transação.

**Architecture:** Páginas de relatórios e produtos têm 'use client' desnecessário no page.tsx; o estado é extraído para `*-client.tsx` enquanto o page.tsx vira Server Component com `<Suspense>`. Hooks de dados estáticos têm staleTime muito baixo; mutations já invalidam corretamente. Repositories trazem campos além do necessário; findAll do Appointment e list do Transaction ganham selects mínimos.

**Tech Stack:** Next.js 15 App Router, TanStack Query v5, Prisma, TypeScript strict, Shadcn UI / Tailwind

## Global Constraints

- Idioma PT-BR em todos os textos voltados ao usuário
- `tenantId` sempre do token, nunca do body
- TypeScript strict — sem `any`, sem `as unknown as`
- `npx tsc --noEmit` e `npx vitest run` devem passar após cada task
- Commit ao final de cada task com mensagem em PT-BR
- Branch: `feat/perf-lazy-loading-cache` (criada na Task 1)

---

## Mapa de arquivos

### Criados
| Arquivo | Responsabilidade |
|---|---|
| `src/components/domain/reports/report-skeleton.tsx` | Skeleton genérico de relatório (filtros + KPIs + tabela) |
| `src/app/(app)/relatorios/financeiro/financeiro-client.tsx` | Conteúdo atual do page.tsx de financeiro |
| `src/app/(app)/relatorios/agendamentos/agendamentos-client.tsx` | Conteúdo atual do page.tsx de agendamentos |
| `src/app/(app)/relatorios/clientes/clientes-client.tsx` | Conteúdo atual do page.tsx de clientes |
| `src/app/(app)/relatorios/profissionais/profissionais-client.tsx` | Conteúdo atual do page.tsx de profissionais |
| `src/app/(app)/produtos/produtos-client.tsx` | Conteúdo atual do page.tsx de produtos |

### Modificados
| Arquivo | O que muda |
|---|---|
| `src/components/domain/crm/customer-list.tsx:119` | `data.data.length` → `data.total` |
| `src/app/(app)/relatorios/financeiro/page.tsx` | Server Component + Suspense |
| `src/app/(app)/relatorios/agendamentos/page.tsx` | Server Component + Suspense |
| `src/app/(app)/relatorios/clientes/page.tsx` | Server Component + Suspense |
| `src/app/(app)/relatorios/profissionais/page.tsx` | Server Component + Suspense |
| `src/app/(app)/servicos/page.tsx` | Remove `'use client'`, adiciona metadata |
| `src/app/(app)/produtos/page.tsx` | Server Component + Suspense |
| `src/hooks/iam/use-roles.ts:60` | staleTime 30s → 5 min |
| `src/hooks/iam/use-team.ts:132,141,149` | staleTime 60s/30s/60s → 5 min nos 3 queries |
| `src/hooks/iam/use-member-services.ts:35` | staleTime 30s → 5 min |
| `src/hooks/dashboard/use-dashboard-metrics.ts:27` | staleTime 20s → 30s |
| `src/domains/scheduling/appointment.repository.ts` | include customer/professional/service com select mínimo em findAll |
| `src/domains/financial/transaction.repository.ts` | Remove include appointment (não usado na lista) |

---

## Task 1: Criar branch e corrigir bug de contagem no CustomerList

**Files:**
- Modify: `src/components/domain/crm/customer-list.tsx:119`

**Interfaces:**
- Consumes: `data.total: number` (já retornado pela API via `prisma.customer.count()`)
- Produces: exibe "X clientes encontrados" com total real

- [ ] **Step 1: Criar branch de feature**

```bash
git checkout -b feat/perf-lazy-loading-cache
```

- [ ] **Step 2: Abrir o arquivo e localizar o bug**

Abrir `src/components/domain/crm/customer-list.tsx` e localizar a linha 119:
```tsx
{data.data.length} cliente{data.data.length !== 1 ? 's' : ''} encontrado{data.data.length !== 1 ? 's' : ''}
```
Esta linha mostra o número de itens da página atual (ex: 10), não o total real (ex: 247).

- [ ] **Step 3: Corrigir para usar data.total**

Substituir a linha 119 pela versão correta:
```tsx
{data.total} cliente{data.total !== 1 ? 's' : ''} encontrado{data.total !== 1 ? 's' : ''}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: zero erros. `data.total` já existe no tipo `CustomersPage` retornado pelo hook `useCustomers`.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/crm/customer-list.tsx
git commit -m "fix(crm): corrigir contagem de clientes — exibir total real em vez de itens da página"
```

---

## Task 2: Criar ReportSkeleton compartilhado

**Files:**
- Create: `src/components/domain/reports/report-skeleton.tsx`

**Interfaces:**
- Produces: `<ReportSkeleton />` — skeleton sem props, usado como `fallback` em todos os `<Suspense>` de relatórios e produtos

- [ ] **Step 1: Criar o componente**

Criar `src/components/domain/reports/report-skeleton.tsx`:
```tsx
import { Skeleton } from '@/components/ui/skeleton'

export function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="ml-auto h-9 w-32" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white">
        <div className="p-4 border-b border-slate-100">
          <Skeleton className="h-4 w-full" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
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
git add src/components/domain/reports/report-skeleton.tsx
git commit -m "feat(reports): adicionar ReportSkeleton compartilhado para Suspense fallback"
```

---

## Task 3: Converter relatório financeiro para Server Component

**Files:**
- Create: `src/app/(app)/relatorios/financeiro/financeiro-client.tsx`
- Modify: `src/app/(app)/relatorios/financeiro/page.tsx`

**Interfaces:**
- Consumes: `ReportSkeleton` de `@/components/domain/reports/report-skeleton`
- Produces: `page.tsx` é Server Component; `FinanceiroClient` é o componente client com a lógica atual

- [ ] **Step 1: Criar financeiro-client.tsx com o conteúdo atual do page.tsx**

Criar `src/app/(app)/relatorios/financeiro/financeiro-client.tsx`:
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

export function FinanceiroClient() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [groupBy, setGroupBy] = useState<'profissional' | 'servico'>('servico')
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'all'>('all')

  const { data, isLoading, isError } = useFinancialReport({
    from: period.from,
    to: period.to,
    groupBy,
    type: type === 'all' ? undefined : type,
  })

  if (!can('relatorios', 'view')) {
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
        ...(data.kpis.estornos > 0
          ? [{ label: 'Estornos', value: fmtBRL(data.kpis.estornos) }]
          : []),
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
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Tipo: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="INCOME">Receita</SelectItem>
              <SelectItem value="EXPENSE">Despesa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-full sm:w-48">
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

- [ ] **Step 2: Substituir page.tsx por Server Component**

Substituir o conteúdo de `src/app/(app)/relatorios/financeiro/page.tsx` por:
```tsx
import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { FinanceiroClient } from './financeiro-client'

export const metadata = { title: 'Relatório Financeiro · Estética SaaS' }

export default function RelatorioFinanceiroPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <FinanceiroClient />
    </Suspense>
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
git add src/app/\(app\)/relatorios/financeiro/
git commit -m "perf(reports): converter relatório financeiro para Server Component com Suspense"
```

---

## Task 4: Converter relatório de agendamentos para Server Component

**Files:**
- Create: `src/app/(app)/relatorios/agendamentos/agendamentos-client.tsx`
- Modify: `src/app/(app)/relatorios/agendamentos/page.tsx`

**Interfaces:**
- Consumes: `ReportSkeleton` de `@/components/domain/reports/report-skeleton`
- Produces: `AgendamentosClient` como componente client com lógica atual; page.tsx como Server Component

- [ ] **Step 1: Criar agendamentos-client.tsx**

Criar `src/app/(app)/relatorios/agendamentos/agendamentos-client.tsx`:
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

export function AgendamentosClient() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [status, setStatus] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<'profissional' | 'servico'>('profissional')

  const { data, isLoading, isError } = useAppointmentsReport({
    from: period.from,
    to: period.to,
    status: status !== 'all' ? [status] : undefined,
    groupBy,
  })

  if (!can('relatorios', 'view')) {
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
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Status: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-full sm:w-48">
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

- [ ] **Step 2: Substituir page.tsx por Server Component**

Substituir `src/app/(app)/relatorios/agendamentos/page.tsx` por:
```tsx
import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { AgendamentosClient } from './agendamentos-client'

export const metadata = { title: 'Relatório de Agendamentos · Estética SaaS' }

export default function RelatorioAgendamentosPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <AgendamentosClient />
    </Suspense>
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
git add src/app/\(app\)/relatorios/agendamentos/
git commit -m "perf(reports): converter relatório de agendamentos para Server Component com Suspense"
```

---

## Task 5: Converter relatório de clientes para Server Component

**Files:**
- Create: `src/app/(app)/relatorios/clientes/clientes-client.tsx`
- Modify: `src/app/(app)/relatorios/clientes/page.tsx`

**Interfaces:**
- Consumes: `ReportSkeleton` de `@/components/domain/reports/report-skeleton`
- Produces: `ClientesClient` como componente client; page.tsx como Server Component

- [ ] **Step 1: Criar clientes-client.tsx**

Criar `src/app/(app)/relatorios/clientes/clientes-client.tsx`:
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

export function ClientesClient() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)

  const { data, isLoading, isError } = useCustomersReport({
    from: period.from,
    to: period.to,
  })

  if (!can('relatorios', 'view')) {
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

- [ ] **Step 2: Substituir page.tsx por Server Component**

Substituir `src/app/(app)/relatorios/clientes/page.tsx` por:
```tsx
import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { ClientesClient } from './clientes-client'

export const metadata = { title: 'Relatório de Clientes · Estética SaaS' }

export default function RelatorioClientesPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ClientesClient />
    </Suspense>
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
git add src/app/\(app\)/relatorios/clientes/
git commit -m "perf(reports): converter relatório de clientes para Server Component com Suspense"
```

---

## Task 6: Converter relatório de profissionais para Server Component

**Files:**
- Create: `src/app/(app)/relatorios/profissionais/profissionais-client.tsx`
- Modify: `src/app/(app)/relatorios/profissionais/page.tsx`

**Interfaces:**
- Consumes: `ReportSkeleton` de `@/components/domain/reports/report-skeleton`
- Produces: `ProfissionaisClient` como componente client; page.tsx como Server Component

- [ ] **Step 1: Criar profissionais-client.tsx**

Criar `src/app/(app)/relatorios/profissionais/profissionais-client.tsx`:
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

export function ProfissionaisClient() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [status, setStatus] = useState<string>('all')

  const { data, isLoading, isError } = useProfessionalsReport({
    from: period.from,
    to: period.to,
    status: status !== 'all' ? [status] : undefined,
  })

  if (!can('relatorios', 'view')) {
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
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Status: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
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

- [ ] **Step 2: Substituir page.tsx por Server Component**

Substituir `src/app/(app)/relatorios/profissionais/page.tsx` por:
```tsx
import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { ProfissionaisClient } from './profissionais-client'

export const metadata = { title: 'Relatório de Profissionais · Estética SaaS' }

export default function RelatorioProfissionaisPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ProfissionaisClient />
    </Suspense>
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
git add src/app/\(app\)/relatorios/profissionais/
git commit -m "perf(reports): converter relatório de profissionais para Server Component com Suspense"
```

---

## Task 7: Converter página de serviços para Server Component

**Files:**
- Modify: `src/app/(app)/servicos/page.tsx`

**Interfaces:**
- Produces: page.tsx sem `'use client'`, com metadata — os filhos (ServiceCatalog, PackageCatalog etc.) já são Client Components internamente e continuam funcionando

**Contexto:** A página de serviços não tem `useState` próprio — os Tabs usam `defaultValue` (uncontrolled). Só precisa remover `'use client'` e adicionar `metadata`.

- [ ] **Step 1: Remover 'use client' e adicionar metadata**

Substituir a primeira linha de `src/app/(app)/servicos/page.tsx`:

Remover:
```tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

Substituir por:
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata = { title: 'Serviços · Estética SaaS' }
```

O restante do arquivo permanece idêntico.

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: zero erros. Server Components podem importar Client Components (Tabs, ServiceCatalog etc.) sem problema.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/servicos/page.tsx
git commit -m "perf(servicos): remover 'use client' desnecessário da página de serviços"
```

---

## Task 8: Converter página de produtos para Server Component

**Files:**
- Create: `src/app/(app)/produtos/produtos-client.tsx`
- Modify: `src/app/(app)/produtos/page.tsx`

**Interfaces:**
- Consumes: `ReportSkeleton` de `@/components/domain/reports/report-skeleton` como fallback do Suspense
- Produces: `ProdutosClient` com toda a lógica atual; page.tsx como Server Component fino

- [ ] **Step 1: Criar produtos-client.tsx com o conteúdo atual do page.tsx**

Criar `src/app/(app)/produtos/produtos-client.tsx` com todo o conteúdo atual de `produtos/page.tsx`, mas:
1. Manter `'use client'` na primeira linha
2. Renomear o export de `ProdutosPage` para `ProdutosClient`

```tsx
'use client'

import { useState } from 'react'
import { Plus, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProducts, useDeleteProduct, type Product } from '@/hooks/inventory/use-products'
import { useProductCategories } from '@/hooks/inventory/use-product-categories'
import { useStockMovements, type StockMovement } from '@/hooks/inventory/use-stock-movements'
import { ProductsTable } from '@/components/domain/inventory/ProductsTable'
import { CategoryManagerModal } from '@/components/domain/inventory/CategoryManagerModal'
import { ProductFormModal } from '@/components/domain/inventory/ProductFormModal'
import { StockPurchaseModal } from '@/components/domain/inventory/StockPurchaseModal'
import { StockSaleModal } from '@/components/domain/inventory/StockSaleModal'
import { StockMovementsTable } from '@/components/domain/inventory/StockMovementsTable'
import { toast } from 'sonner'

type TableProduct = {
  id: string
  name: string
  category: { id: string; name: string } | null
  salePrice: string
  stockQuantity: number
  lowStockAlert: number
}

export function ProdutosClient() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [saleModalOpen, setSaleModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const PAGE_SIZE = 10
  const { data: productsData, isLoading: loadingProducts } = useProducts({
    name: search || undefined,
    categoryId: categoryFilter,
    page,
    pageSize: PAGE_SIZE,
  })
  const { data: categories = [] } = useProductCategories()
  const { data: purchasesData } = useStockMovements({ type: 'PURCHASE' })
  const { data: salesData } = useStockMovements({ type: 'SALE' })
  const deleteProduct = useDeleteProduct()

  const products: Product[] = productsData?.data ?? []
  const purchases: StockMovement[] = purchasesData?.data ?? []
  const sales: StockMovement[] = salesData?.data ?? []

  const totalStock = products.reduce((acc, p) => acc + p.stockQuantity, 0)
  const totalPatrimony = products.reduce(
    (acc, p) => acc + Number(p.salePrice) * p.stockQuantity,
    0,
  )

  async function handleDelete(product: TableProduct) {
    if (!confirm(`Remover "${product.name}" do catálogo?`)) return
    try {
      await deleteProduct.mutateAsync(product.id)
      toast.success('Produto removido do catálogo')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover produto')
    }
  }

  function handleEdit(product: TableProduct) {
    const full = products.find((p) => p.id === product.id) ?? null
    setEditingProduct(full)
    setProductModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Produtos &amp; Estoque
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie seu catálogo, estoque e vendas
        </p>
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="compras">Compra de Estoque</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4 mt-4">
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Quantidade total em estoque:{' '}
            <strong className="text-foreground">{totalStock}</strong>
            {' · '}
            Patrimônio total:{' '}
            <strong className="text-foreground">
              {totalPatrimony.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="max-w-xs"
            />
            <Select
              onValueChange={(v) => {
                setCategoryFilter(v === 'all' ? undefined : v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => setCategoryModalOpen(true)}>
                <Tags className="mr-2 size-4" />
                CATEGORIAS
              </Button>
              <Button onClick={() => { setEditingProduct(null); setProductModalOpen(true) }}>
                <Plus className="mr-2 size-4" />
                ADICIONAR PRODUTO
              </Button>
            </div>
          </div>

          {loadingProducts ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <>
              <ProductsTable products={products} onEdit={handleEdit} onDelete={handleDelete} />
              {productsData && productsData.total > 0 && (() => {
                const totalPages = Math.ceil(productsData.total / PAGE_SIZE)
                return (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </TabsContent>

        <TabsContent value="compras" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setPurchaseModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              REGISTRAR COMPRA
            </Button>
          </div>
          <StockMovementsTable movements={purchases} mode="purchase" />
        </TabsContent>

        <TabsContent value="vendas" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setSaleModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              REGISTRAR VENDA
            </Button>
          </div>
          <StockMovementsTable movements={sales} mode="sale" />
        </TabsContent>
      </Tabs>

      <CategoryManagerModal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} />
      <ProductFormModal
        open={productModalOpen}
        onClose={() => { setProductModalOpen(false); setEditingProduct(null) }}
        product={editingProduct}
      />
      <StockPurchaseModal open={purchaseModalOpen} onClose={() => setPurchaseModalOpen(false)} />
      <StockSaleModal open={saleModalOpen} onClose={() => setSaleModalOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 2: Substituir page.tsx por Server Component**

Substituir `src/app/(app)/produtos/page.tsx` por:
```tsx
import { Suspense } from 'react'
import { ReportSkeleton } from '@/components/domain/reports/report-skeleton'
import { ProdutosClient } from './produtos-client'

export const metadata = { title: 'Produtos & Estoque · Estética SaaS' }

export default function ProdutosPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ProdutosClient />
    </Suspense>
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
git add src/app/\(app\)/produtos/
git commit -m "perf(produtos): converter página de produtos para Server Component com Suspense"
```

---

## Task 9: Padronizar staleTime por domínio nos hooks

**Files:**
- Modify: `src/hooks/iam/use-roles.ts:60`
- Modify: `src/hooks/iam/use-team.ts:132,141,149`
- Modify: `src/hooks/iam/use-member-services.ts:35`
- Modify: `src/hooks/dashboard/use-dashboard-metrics.ts:27`

**Interfaces:**
- Consumes: nenhum
- Produces: hooks com staleTime correto por categoria; invalidações já existentes continuam funcionando

**Contexto:** As mutations já chamam `invalidateQueries` corretamente em todos os casos (verificado na leitura do código). Esta task só ajusta os valores de staleTime.

- [ ] **Step 1: Corrigir use-roles.ts**

Em `src/hooks/iam/use-roles.ts`, linha 60:
```ts
// Antes
export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: fetchRoles, staleTime: 30 * 1000 })
}

// Depois
export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: fetchRoles, staleTime: 5 * 60 * 1000 })
}
```

- [ ] **Step 2: Corrigir use-team.ts (3 queries)**

Em `src/hooks/iam/use-team.ts`, localizar os três `useQuery` e atualizar:

```ts
// useTeamMembers — linha ~129 (staleTime: 60 * 1000 → 5 * 60 * 1000)
export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: fetchTeamMembers,
    staleTime: 5 * 60 * 1000,
  })
}

// useProfessionalsByService — linha ~136 (staleTime: 30 * 1000 → 5 * 60 * 1000)
export function useProfessionalsByService(serviceId: string | null) {
  return useQuery({
    queryKey: ['professionals-by-service', serviceId],
    queryFn: () => fetchProfessionalsByService(serviceId!),
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  })
}

// useTeamInvites — linha ~145 (staleTime: 60 * 1000 → 5 * 60 * 1000)
export function useTeamInvites() {
  return useQuery({
    queryKey: ['team-invites'],
    queryFn: fetchInvites,
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 3: Corrigir use-member-services.ts**

Em `src/hooks/iam/use-member-services.ts`, linha 35:
```ts
// Antes
    staleTime: 30 * 1000,

// Depois
    staleTime: 5 * 60 * 1000,
```

- [ ] **Step 4: Corrigir use-dashboard-metrics.ts**

Em `src/hooks/dashboard/use-dashboard-metrics.ts`, linha 27:
```ts
// Antes
    staleTime: 20_000,

// Depois
    staleTime: 30_000,
```

- [ ] **Step 5: Verificar TypeScript e testes**

```bash
npx tsc --noEmit
npx vitest run
```
Esperado: zero erros TypeScript, todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/iam/use-roles.ts src/hooks/iam/use-team.ts src/hooks/iam/use-member-services.ts src/hooks/dashboard/use-dashboard-metrics.ts
git commit -m "perf(hooks): padronizar staleTime por domínio — estáticos 5min, dashboard 30s"
```

---

## Task 10: Otimizar selects nos repositories

**Files:**
- Modify: `src/domains/scheduling/appointment.repository.ts`
- Modify: `src/domains/financial/transaction.repository.ts`

**Interfaces:**
- Consumes: nenhum
- Produces: `AppointmentRepository.findAll` retorna apenas os campos usados pelo frontend; `TransactionRepository.list` não inclui appointment (não usado por TransactionList/TransactionCard)

**Contexto importante:**
- `findAll` (lista da agenda) — os componentes usam `customer.{id,name,phone,notes}`, `professional.{id,name}`, `service.{id,name,duration}`. Email não é usado na listagem.
- `findById` (detalhes/notificações) — usa `customer.email`, `professional.email`; **não mudar**.
- `TransactionCard` usa apenas `transaction.{type,category,amount,description,paidAt}`. O campo `appointment` incluso no `list` nunca é lido pelo frontend.

- [ ] **Step 1: Adicionar select mínimo em AppointmentRepository.findAll**

Em `src/domains/scheduling/appointment.repository.ts`, substituir o bloco `include` dentro de `findAll`:

```ts
// Antes
      include: {
        customer: true,
        professional: true,
        service: true,
      },

// Depois
      include: {
        customer: { select: { id: true, name: true, phone: true, notes: true } },
        professional: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, duration: true } },
      },
```

Manter o `include` de `findById` e `findOverlappingForProfessional` inalterado.

- [ ] **Step 2: Remover include desnecessário em TransactionRepository.list**

Em `src/domains/financial/transaction.repository.ts`, substituir o `findMany` dentro de `list`:

```ts
// Antes
      prisma.transaction.findMany({
        where,
        include: { appointment: true },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),

// Depois
      prisma.transaction.findMany({
        where,
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: zero erros. O tipo de retorno de `findAll` fica mais preciso (campos explícitos em vez de relações completas). O `Transaction` do `use-transactions.ts` não tem campo `appointment`, então não há incompatibilidade.

- [ ] **Step 4: Rodar testes**

```bash
npx vitest run
```
Esperado: todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/domains/scheduling/appointment.repository.ts src/domains/financial/transaction.repository.ts
git commit -m "perf(db): select mínimo em appointment.findAll e remover include desnecessário em transaction.list"
```

---

## Task 11: Verificação final e abertura de PR

**Files:** Nenhum arquivo novo

- [ ] **Step 1: Verificar TypeScript completo**

```bash
npx tsc --noEmit
```
Esperado: zero erros.

- [ ] **Step 2: Rodar suite de testes completa**

```bash
npx vitest run
```
Esperado: todos os testes passando (incluindo `customer.repository.filters.test.ts`, `iam.repository.test.ts`, `role.repository.test.ts`).

- [ ] **Step 3: Verificar branch e commits**

```bash
git log --oneline main..HEAD
```
Esperado: ver os commits de tasks 1–10, todos na branch `feat/perf-lazy-loading-cache`.

- [ ] **Step 4: Abrir Pull Request**

```bash
gh pr create \
  --title "perf: lazy loading, Server Components e cache (#121)" \
  --body "$(cat <<'EOF'
## Resumo

- **Bug fix:** contagem de clientes no CustomerList agora exibe total real (`data.total`) em vez de itens da página
- **Server Components:** 4 páginas de relatórios + produtos convertidas com `<Suspense>` e `ReportSkeleton`; página de serviços remove `'use client'` desnecessário
- **staleTime:** dados estáticos (roles, membros, serviços) → 5 min; dashboard → 30s; invalidação já existente nas mutations
- **Repositories:** `AppointmentRepository.findAll` usa select mínimo; `TransactionRepository.list` remove include de appointment não utilizado

## Plano de testes

- [ ] Navegar para /clientes com mais de 10 clientes: verificar que o contador mostra o total real
- [ ] Navegar para /relatorios/financeiro: verificar que o skeleton aparece antes do conteúdo
- [ ] Trocar entre abas de relatório: verificar que não há refetch desnecessário por 60s
- [ ] Acessar /equipe, mudar cargo de membro: verificar que a lista atualiza imediatamente (invalidação)
- [ ] Acessar /agenda: verificar que os agendamentos carregam normalmente com as relações customer/professional/service

Closes #121

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist

- [x] Bug contagem CustomerList → Task 1
- [x] ReportSkeleton criado antes de ser usado → Task 2 (antes das Tasks 3-8)
- [x] 4 páginas de relatório extraídas → Tasks 3-6
- [x] servicos: remove 'use client' → Task 7
- [x] produtos: extração → Task 8
- [x] staleTime: 4 hooks corrigidos → Task 9
- [x] AppointmentRepository.findAll select mínimo → Task 10
- [x] TransactionRepository.list remove include → Task 10
- [x] Todos os `npx tsc --noEmit` explícitos por task
- [x] `npx vitest run` na task final e na Task 9 (staleTime muda type inference? Não — é só um número)
- [x] PR final com checklist de testes manuais → Task 11
