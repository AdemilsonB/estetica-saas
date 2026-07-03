# Relatórios Fase 1 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `/relatorios` em visão de performance: 4 páginas com papéis únicos (Visão Geral/tendência, Financeiro/composição, Agendamentos/operação, Clientes/pessoas), gráficos Recharts, variação % vs período anterior, sazonalidade, inativos, filtros ano/categoria e paginação — removendo a página Profissionais (duplicada).

**Architecture:** Agregações novas no PostgreSQL (`$queryRaw` com `date_trunc`/`timezone()` no fuso do tenant, `groupBy` do Prisma), em um novo `analytics.service.ts`; relatórios existentes ganham deltas e filtro de categoria mantendo seu padrão. Gating `reports_advanced` por bloco (evolução, sazonalidade, inativos) com upsell inline.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Zod, TanStack Query, Shadcn UI + Recharts, Vitest (prisma-mock).

**Spec:** `docs/superpowers/specs/2026-07-03-relatorios-fase1-design.md`

## Global Constraints

- Todo output em Português do Brasil (código, comentários, commits).
- `tenantId` SEMPRE do token (`getSessionContext`), nunca do body/URL; toda query filtra `tenantId`.
- Receita = `Transaction.netAmount` com fallback `amount`, somente `INCOME`.
- Erros tipados de `src/shared/errors/` (nunca `throw new Error('string')` em domínio).
- TypeScript strict: sem `any`, sem `as unknown as`.
- Schemas Zod em `src/domains/reports/types.ts` (nunca duplicados no frontend).
- Mobile-first: base → `md:` → `lg:`; verde (`emerald`)/vermelho (`rose`) exclusivos para variação.
- Branch de trabalho: `feat/relatorios-fase1` (já existe, com a spec commitada). Verificar `git branch --show-current` antes de TODO commit.
- Rodar testes: `npx vitest run <arquivo>` (suíte completa só na verificação final).

---

### Task 1: Preset de período — `startOfYear` + presets "7 dias" e "Este ano"

**Files:**
- Modify: `src/lib/dates.ts` (adicionar `startOfYear` após `startOfMonth`, linha ~13)
- Modify: `src/components/domain/reports/period-filter.tsx`
- Test: `src/lib/dates.test.ts` (criar se não existir; se existir, adicionar bloco)

**Interfaces:**
- Produces: `startOfYear(d: Date): Date` em `@/lib/dates`; presets do `PeriodFilter` passam a ser `hoje | 7dias | mes | mes-passado | ano | personalizado` (o tipo `PeriodValue` não muda).

- [ ] **Step 1: Teste falhando para `startOfYear`**

Em `src/lib/dates.test.ts` (criar com este conteúdo se o arquivo não existir; senão, adicionar só o `describe`):

```ts
import { describe, it, expect } from 'vitest'
import { startOfYear } from './dates'

describe('startOfYear', () => {
  it('retorna 1º de janeiro do ano da data, zerando horário', () => {
    const d = new Date(2026, 6, 15, 14, 30, 45, 123)
    const r = startOfYear(d)
    expect(r.getFullYear()).toBe(2026)
    expect(r.getMonth()).toBe(0)
    expect(r.getDate()).toBe(1)
    expect(r.getHours()).toBe(0)
    expect(r.getMinutes()).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL — `startOfYear` não é exportado.

- [ ] **Step 3: Implementar em `src/lib/dates.ts`** (após `startOfMonth`)

```ts
export function startOfYear(d: Date): Date {
  const r = new Date(d)
  r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS

- [ ] **Step 5: Atualizar presets do `PeriodFilter`**

Em `src/components/domain/reports/period-filter.tsx`:

1. Trocar o import de datas por:
```ts
import {
  startOfDay, endOfDay, addDays,
  startOfMonth, startOfPrevMonth, endOfPrevMonth, startOfYear,
} from '@/lib/dates'
```
2. Trocar o tipo e o mapa de presets ("Esta semana" sai, entram "7 dias" e "Este ano"):
```ts
type Preset = 'hoje' | '7dias' | 'mes' | 'mes-passado' | 'ano' | 'personalizado'

function presetToPeriod(preset: Exclude<Preset, 'personalizado'>): PeriodValue {
  const now = new Date()
  const map: Record<Exclude<Preset, 'personalizado'>, PeriodValue> = {
    hoje: { from: toISO(startOfDay(now)), to: toISO(endOfDay(now)) },
    '7dias': { from: toISO(startOfDay(addDays(now, -6))), to: toISO(endOfDay(now)) },
    mes: { from: toISO(startOfMonth(now)), to: toISO(endOfDay(now)) },
    'mes-passado': { from: toISO(startOfPrevMonth(now)), to: toISO(endOfPrevMonth(now)) },
    ano: { from: toISO(startOfYear(now)), to: toISO(endOfDay(now)) },
  }
  return map[preset]
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: '7dias', label: '7 dias' },
  { key: 'mes', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'ano', label: 'Este ano' },
  { key: 'personalizado', label: 'Personalizado' },
]
```
(`startOfWeek`/`endOfWeek` deixam de ser importados aqui — não remover de `dates.ts`, outros módulos usam.)

- [ ] **Step 6: Verificar e commitar**

Run: `npx tsc --noEmit` → zero erros.
```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/components/domain/reports/period-filter.tsx
git commit -m "feat(reports): presets de período '7 dias' e 'Este ano' no filtro de relatórios"
```

---

### Task 2: Utilitários de analytics — delta, janela anterior, granularidade e buckets

**Files:**
- Create: `src/domains/reports/analytics-utils.ts`
- Test: `src/domains/reports/analytics-utils.test.ts`

**Interfaces:**
- Produces (usados pelas Tasks 3–8):
  - `type KpiDelta = number | null`
  - `percentDelta(current: number, previous: number): KpiDelta` — % arredondado; `null` se `previous === 0`
  - `pointsDelta(currentPct: number, previousPct: number): number` — diferença em pontos percentuais, arredondada
  - `previousWindow(from: Date, to: Date): { from: Date; to: Date }` — janela de mesma duração imediatamente anterior
  - `type Granularity = 'day' | 'week' | 'month'`
  - `granularityFor(from: Date, to: Date): Granularity` — ≤31d → day; ≤120d → week; senão month
  - `enumerateBuckets(from: Date, to: Date, granularity: Granularity, tz: string): string[]` — labels `YYYY-MM-DD` alinhados ao `date_trunc` do Postgres (semana começa na segunda)

- [ ] **Step 1: Escrever os testes**

`src/domains/reports/analytics-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  percentDelta, pointsDelta, previousWindow, granularityFor, enumerateBuckets,
} from './analytics-utils'

describe('percentDelta', () => {
  it('calcula variação percentual arredondada', () => {
    expect(percentDelta(114, 100)).toBe(14)
    expect(percentDelta(90, 100)).toBe(-10)
  })
  it('retorna null quando período anterior é zero (sem base de comparação)', () => {
    expect(percentDelta(50, 0)).toBeNull()
  })
})

describe('pointsDelta', () => {
  it('retorna diferença em pontos percentuais', () => {
    expect(pointsDelta(80, 72)).toBe(8)
    expect(pointsDelta(60, 65)).toBe(-5)
  })
})

describe('previousWindow', () => {
  it('retorna janela de mesma duração imediatamente anterior', () => {
    const from = new Date('2026-06-01T00:00:00.000Z')
    const to = new Date('2026-06-30T23:59:59.999Z')
    const prev = previousWindow(from, to)
    expect(prev.to.getTime()).toBe(from.getTime() - 1)
    expect(prev.to.getTime() - prev.from.getTime()).toBe(to.getTime() - from.getTime())
  })
})

describe('granularityFor', () => {
  const d = (s: string) => new Date(s)
  it('dia para janelas de até 31 dias', () => {
    expect(granularityFor(d('2026-06-01'), d('2026-06-30'))).toBe('day')
  })
  it('semana para janelas de até 120 dias', () => {
    expect(granularityFor(d('2026-03-01'), d('2026-05-30'))).toBe('week')
  })
  it('mês acima de 120 dias', () => {
    expect(granularityFor(d('2026-01-01'), d('2026-12-31'))).toBe('month')
  })
})

describe('enumerateBuckets', () => {
  const tz = 'America/Sao_Paulo'
  it('dia: um bucket por dia do intervalo', () => {
    const buckets = enumerateBuckets(
      new Date('2026-06-01T03:00:00.000Z'), // 00:00 em SP
      new Date('2026-06-04T02:59:59.999Z'), // fim de 03/06 em SP
      'day', tz,
    )
    expect(buckets).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })
  it('semana: buckets alinhados à segunda-feira (como date_trunc do Postgres)', () => {
    const buckets = enumerateBuckets(
      new Date('2026-06-03T03:00:00.000Z'), // quarta 03/06 em SP
      new Date('2026-06-16T03:00:00.000Z'),
      'week', tz,
    )
    expect(buckets[0]).toBe('2026-06-01') // segunda da semana de 03/06
    expect(buckets).toContain('2026-06-08')
    expect(buckets).toContain('2026-06-15')
  })
  it('mês: primeiro dia de cada mês', () => {
    const buckets = enumerateBuckets(
      new Date('2026-01-15T03:00:00.000Z'),
      new Date('2026-04-10T03:00:00.000Z'),
      'month', tz,
    )
    expect(buckets).toEqual(['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domains/reports/analytics-utils.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/domains/reports/analytics-utils.ts`**

```ts
export type KpiDelta = number | null

export function percentDelta(current: number, previous: number): KpiDelta {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export function pointsDelta(currentPct: number, previousPct: number): number {
  return Math.round(currentPct - previousPct)
}

export function previousWindow(from: Date, to: Date): { from: Date; to: Date } {
  const duration = to.getTime() - from.getTime()
  return {
    from: new Date(from.getTime() - duration - 1),
    to: new Date(from.getTime() - 1),
  }
}

export type Granularity = 'day' | 'week' | 'month'

const DAY_MS = 86_400_000

export function granularityFor(from: Date, to: Date): Granularity {
  const days = (to.getTime() - from.getTime()) / DAY_MS
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

// Enumera os buckets (YYYY-MM-DD) do intervalo no fuso do tenant, no mesmo
// alinhamento do date_trunc do PostgreSQL (semana inicia na segunda-feira).
// A iteração usa Date em UTC ao meio-dia para não sofrer com DST.
export function enumerateBuckets(
  from: Date,
  to: Date,
  granularity: Granularity,
  tz: string,
): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  let cursor = new Date(`${fmt.format(from)}T12:00:00Z`)
  const end = new Date(`${fmt.format(to)}T12:00:00Z`)

  if (granularity === 'week') {
    const diasDesdeSegunda = (cursor.getUTCDay() + 6) % 7
    cursor = new Date(cursor.getTime() - diasDesdeSegunda * DAY_MS)
  }
  if (granularity === 'month') cursor.setUTCDate(1)

  const buckets: string[] = []
  while (cursor <= end) {
    buckets.push(cursor.toISOString().slice(0, 10))
    if (granularity === 'day') cursor = new Date(cursor.getTime() + DAY_MS)
    else if (granularity === 'week') cursor = new Date(cursor.getTime() + 7 * DAY_MS)
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return buckets
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domains/reports/analytics-utils.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 5: Commitar**

```bash
git add src/domains/reports/analytics-utils.ts src/domains/reports/analytics-utils.test.ts
git commit -m "feat(reports): utilitários de variação, janela anterior e buckets de série temporal"
```

---

### Task 3: Backend Financeiro — ticket médio por grupo, variação de KPIs e filtro de categoria

**Files:**
- Modify: `src/domains/reports/types.ts` (bloco Financeiro, linhas 6–32)
- Modify: `src/domains/reports/reports.service.ts` (`getFinancialReport`, linhas 41–113)
- Test: `src/domains/reports/reports.service.test.ts` (adicionar casos)

**Interfaces:**
- Consumes: `percentDelta`, `previousWindow`, `KpiDelta` de `./analytics-utils` (Task 2).
- Produces (o frontend da Task 13 depende disto):
  - `financialReportSchema` ganha `categoryId: z.string().cuid().optional()`
  - `FinancialReportRow = { groupId: string | null; label: string; quantidade: number; receita: number; ticketMedio: number }`
  - `FinancialReport['kpis']` ganha `variacao: { receita: KpiDelta; despesa: KpiDelta; saldo: KpiDelta; ticketMedio: KpiDelta }`

- [ ] **Step 1: Testes falhando**

Adicionar ao final de `src/domains/reports/reports.service.test.ts`:

```ts
describe('ReportsService.getFinancialReport — ticket médio, variação e categoria', () => {
  beforeEach(() => {
    prismaMock.transaction.findMany.mockReset()
    prismaMock.tenant.findFirstOrThrow.mockResolvedValue({
      timezone: 'America/Sao_Paulo',
    } as never)
  })

  it('calcula ticketMedio por grupo e expõe groupId', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([income(100, 90), income(50, 30, 'apt-2')] as never) // período atual
      .mockResolvedValueOnce([] as never) // período anterior

    const report = await service.getFinancialReport('tenant-1', {})

    const corte = report.rows.find((r) => r.label === 'Corte')
    expect(corte?.groupId).toBe('s1')
    expect(corte?.quantidade).toBe(2)
    expect(corte?.ticketMedio).toBe(60) // (90 + 30) / 2
  })

  it('calcula variação % dos KPIs vs janela anterior', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([income(120, 114)] as never) // atual: receita 114
      .mockResolvedValueOnce([income(100, 100)] as never) // anterior: receita 100

    const report = await service.getFinancialReport('tenant-1', {})

    expect(report.kpis.variacao.receita).toBe(14)
  })

  it('variação é null quando não há base no período anterior', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([income(100, 90)] as never)
      .mockResolvedValueOnce([] as never)

    const report = await service.getFinancialReport('tenant-1', {})

    expect(report.kpis.variacao.receita).toBeNull()
  })

  it('repassa categoryId como filtro via appointment.service', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([] as never)

    await service.getFinancialReport('tenant-1', { categoryId: 'clx0categoria0000000000000' })

    const call = prismaMock.transaction.findMany.mock.calls[0][0] as {
      where: { appointment?: { service?: { categoryId?: string } } }
    }
    expect(call.where.appointment?.service?.categoryId).toBe('clx0categoria0000000000000')
  })
})
```

Nota: o helper `income()` já existente no arquivo devolve `appointment.service = { id: 's1', name: 'Corte' }` — o `groupId` esperado é `'s1'`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domains/reports/reports.service.test.ts`
Expected: FAIL — `variacao`, `ticketMedio` e `groupId` inexistentes; filtro de categoria ausente.

- [ ] **Step 3: Atualizar `types.ts` (bloco Financeiro)**

```ts
import type { KpiDelta } from './analytics-utils'

export const financialReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  professionalId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  groupBy: z.enum(['profissional', 'servico']).default('servico'),
})

export type FinancialReportRow = {
  groupId: string | null
  label: string
  quantidade: number
  receita: number
  ticketMedio: number
}

export type FinancialReport = {
  kpis: {
    receita: number
    despesa: number
    estornos: number
    saldo: number
    ticketMedio: number
    variacao: {
      receita: KpiDelta
      despesa: KpiDelta
      saldo: KpiDelta
      ticketMedio: KpiDelta
    }
  }
  rows: FinancialReportRow[]
}
```

(O `import type { KpiDelta }` entra no topo do arquivo, junto dos imports existentes.)

- [ ] **Step 4: Refatorar `getFinancialReport` no service**

Substituir o método por (mantendo `resolvePeriod` como está):

```ts
async getFinancialReport(
  tenantId: string,
  input: FinancialReportInput,
): Promise<FinancialReport> {
  const { from, to } = await this.resolvePeriod(tenantId, input)

  const appointmentFilter = {
    ...(input.professionalId && { professionalId: input.professionalId }),
    ...(input.serviceId && { serviceId: input.serviceId }),
    ...(input.categoryId && { service: { categoryId: input.categoryId } }),
  }

  const baseWhere = {
    tenantId,
    ...(input.type && { type: input.type }),
    ...(Object.keys(appointmentFilter).length > 0 && { appointment: appointmentFilter }),
  }

  const [transactions, prevTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: { ...baseWhere, paidAt: { gte: from, lte: to } },
      include: {
        appointment: {
          include: {
            professional: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        },
      },
    }),
    (() => {
      const prev = previousWindow(from, to)
      return prisma.transaction.findMany({
        where: { ...baseWhere, paidAt: { gte: prev.from, lte: prev.to } },
        select: { type: true, amount: true, netAmount: true, category: true, appointmentId: true },
      })
    })(),
  ])

  const atual = this.summarizeFinancials(transactions)
  const anterior = this.summarizeFinancials(prevTransactions)

  type Group = { groupId: string | null; label: string; quantidade: number; receita: number }
  const byGroup = new Map<string, Group>()
  for (const tx of transactions.filter((t) => t.type === TransactionType.INCOME)) {
    const groupId =
      input.groupBy === 'profissional'
        ? (tx.appointment?.professional?.id ?? null)
        : (tx.appointment?.service?.id ?? null)
    const label =
      input.groupBy === 'profissional'
        ? (tx.appointment?.professional?.name ?? 'Sem profissional')
        : (tx.appointment?.service?.name ?? 'Sem serviço')
    const key = groupId ?? label
    const prev = byGroup.get(key) ?? { groupId, label, quantidade: 0, receita: 0 }
    byGroup.set(key, {
      groupId,
      label,
      quantidade: prev.quantidade + 1,
      receita: prev.receita + Number(tx.netAmount ?? tx.amount),
    })
  }
  const rows = [...byGroup.values()]
    .map((g) => ({ ...g, ticketMedio: g.quantidade > 0 ? g.receita / g.quantidade : 0 }))
    .sort((a, b) => b.receita - a.receita)

  return {
    kpis: {
      receita: atual.receita,
      despesa: atual.despesa,
      estornos: atual.estornos,
      saldo: atual.receita - atual.despesa,
      ticketMedio: atual.ticketMedio,
      variacao: {
        receita: percentDelta(atual.receita, anterior.receita),
        despesa: percentDelta(atual.despesa, anterior.despesa),
        saldo: percentDelta(atual.receita - atual.despesa, anterior.receita - anterior.despesa),
        ticketMedio: percentDelta(atual.ticketMedio, anterior.ticketMedio),
      },
    },
    rows,
  }
}

// Resume receita/despesa/estornos/ticket de um conjunto de transações
// (mesma regra para o período atual e o anterior).
private summarizeFinancials(
  transactions: Array<{
    type: TransactionType
    amount: unknown
    netAmount: unknown
    category: string | null
    appointmentId: string | null
  }>,
): { receita: number; despesa: number; estornos: number; ticketMedio: number } {
  const isReversalTx = (t: (typeof transactions)[0]) => isReversal(t.category, Number(t.amount))

  const receita = transactions
    .filter((t) => t.type === TransactionType.INCOME)
    .reduce((s, t) => s + Number(t.netAmount ?? t.amount), 0)

  const estornos = transactions
    .filter((t) => t.type === TransactionType.EXPENSE && isReversalTx(t))
    .reduce((s, t) => s + Math.abs(Number(t.netAmount ?? t.amount)), 0)

  const grossExpenses = transactions
    .filter((t) => t.type === TransactionType.EXPENSE && !isReversalTx(t))
    .reduce((s, t) => s + Number(t.netAmount ?? t.amount), 0)

  const despesa = Math.max(0, grossExpenses - estornos)

  const appointmentIdsComReceita = new Set(
    transactions
      .filter((t) => t.type === TransactionType.INCOME && t.appointmentId)
      .map((t) => t.appointmentId),
  )
  const ticketMedio =
    appointmentIdsComReceita.size > 0 ? receita / appointmentIdsComReceita.size : 0

  return { receita, despesa, estornos, ticketMedio }
}
```

Imports novos no topo do service:
```ts
import { percentDelta, previousWindow } from './analytics-utils'
```

Atenção: os testes existentes de `getFinancialReport` usam `mockResolvedValue` (vale para as duas chamadas) — continuam válidos. O teste de timezone (`reports.service.timezone.test.ts`) também segue válido: `previousWindow` não consulta o banco.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/domains/reports/reports.service.test.ts src/domains/reports/reports.service.timezone.test.ts`
Expected: PASS em todos (novos e antigos).

- [ ] **Step 6: Atualizar rota e hook (categoria)**

Em `src/app/api/reports/financial/route.ts`, adicionar ao `parse`:
```ts
categoryId: sp.get('categoryId') ?? undefined,
```

Em `src/hooks/reports/use-financial-report.ts`, adicionar `categoryId?: string` ao `FinancialReportParams` e:
```ts
if (params.categoryId) url.searchParams.set('categoryId', params.categoryId)
```

- [ ] **Step 7: Verificar e commitar**

Run: `npx tsc --noEmit` → o erro esperado agora é no `financeiro-client.tsx`? Não — `KpiCard` não muda ainda e o client não lê `variacao`/`ticketMedio`; deve compilar limpo. Se houver erro, corrigir antes de commitar.

```bash
git add src/domains/reports/ src/app/api/reports/financial/route.ts src/hooks/reports/use-financial-report.ts
git commit -m "feat(reports): financeiro com ticket médio por grupo, variação vs período anterior e filtro por categoria"
```

---

### Task 4: Backend Agendamentos — variação de KPIs e filtro de categoria

**Files:**
- Modify: `src/domains/reports/types.ts` (bloco Agendamentos, linhas 36–64)
- Modify: `src/domains/reports/reports.service.ts` (`getAppointmentsReport`)
- Test: `src/domains/reports/reports.service.test.ts`

**Interfaces:**
- Consumes: `percentDelta`, `pointsDelta`, `previousWindow` (Task 2).
- Produces: `appointmentsReportSchema` ganha `categoryId`; `AppointmentsReport['kpis']` ganha `variacao: { total: KpiDelta; concluidos: KpiDelta; taxaConclusaoPp: number }`.

- [ ] **Step 1: Testes falhando**

Adicionar a `reports.service.test.ts`:

```ts
import { AppointmentStatus } from '@prisma/client'

function apt(status: AppointmentStatus, professional = { id: 'p1', name: 'Ana' }) {
  return {
    id: `apt-${Math.random()}`,
    status,
    professional,
    service: { id: 's1', name: 'Corte' },
  }
}

describe('ReportsService.getAppointmentsReport — variação e categoria', () => {
  beforeEach(() => {
    prismaMock.appointment.findMany.mockReset()
    prismaMock.appointment.groupBy.mockReset()
    prismaMock.tenant.findFirstOrThrow.mockResolvedValue({
      timezone: 'America/Sao_Paulo',
    } as never)
  })

  it('calcula variação de total, concluídos e taxa (p.p.) vs janela anterior', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      apt(AppointmentStatus.COMPLETED),
      apt(AppointmentStatus.COMPLETED),
      apt(AppointmentStatus.CANCELLED),
    ] as never) // atual: 3 total, 2 concluídos, taxa 67%
    prismaMock.appointment.groupBy.mockResolvedValue([
      { status: AppointmentStatus.COMPLETED, _count: { _all: 1 } },
      { status: AppointmentStatus.CANCELLED, _count: { _all: 1 } },
    ] as never) // anterior: 2 total, 1 concluído, taxa 50%

    const report = await service.getAppointmentsReport('tenant-1', {})

    expect(report.kpis.variacao.total).toBe(50) // 3 vs 2
    expect(report.kpis.variacao.concluidos).toBe(100) // 2 vs 1
    expect(report.kpis.variacao.taxaConclusaoPp).toBe(17) // 67 - 50
  })

  it('repassa categoryId como filtro via service.categoryId', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([] as never)
    prismaMock.appointment.groupBy.mockResolvedValue([] as never)

    await service.getAppointmentsReport('tenant-1', { categoryId: 'clx0categoria0000000000000', groupBy: 'profissional' })

    const call = prismaMock.appointment.findMany.mock.calls[0][0] as {
      where: { service?: { categoryId?: string } }
    }
    expect(call.where.service?.categoryId).toBe('clx0categoria0000000000000')
  })
})
```

(Se `groupBy` estiver ausente como default no teste, o `getAppointmentsReport` recebe `{}` — o schema tem default `'profissional'`, mas o service é chamado direto; passar `input.groupBy` indefinido cai no ramo `'profissional'` do ternário existente, ok.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domains/reports/reports.service.test.ts`
Expected: FAIL — `variacao` inexistente.

- [ ] **Step 3: Atualizar `types.ts` (bloco Agendamentos)**

```ts
export const appointmentsReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.array(z.nativeEnum(AppointmentStatus)).optional(),
  professionalId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  groupBy: z.enum(['profissional', 'servico']).default('profissional'),
})

export type AppointmentsReport = {
  kpis: {
    total: number
    concluidos: number
    cancelados: number
    naoCompareceu: number
    taxaConclusao: number
    variacao: {
      total: KpiDelta
      concluidos: KpiDelta
      taxaConclusaoPp: number
    }
  }
  rows: AppointmentsReportRow[]
}
```

- [ ] **Step 4: Atualizar `getAppointmentsReport`**

No `where` do `findMany`, adicionar:
```ts
...(input.categoryId && { service: { categoryId: input.categoryId } }),
```

Após montar os KPIs atuais, buscar a janela anterior por agregação (não carrega linhas):
```ts
const prev = previousWindow(from, to)
const prevGroups = await prisma.appointment.groupBy({
  by: ['status'],
  where: {
    tenantId,
    startsAt: { gte: prev.from, lte: prev.to },
    ...(input.status?.length && { status: { in: input.status } }),
    ...(input.professionalId && { professionalId: input.professionalId }),
    ...(input.serviceId && { serviceId: input.serviceId }),
    ...(input.categoryId && { service: { categoryId: input.categoryId } }),
  },
  _count: { _all: true },
})
const prevTotal = prevGroups.reduce((s, g) => s + g._count._all, 0)
const prevConcluidos =
  prevGroups.find((g) => g.status === AppointmentStatus.COMPLETED)?._count._all ?? 0
const prevTaxa = prevTotal > 0 ? Math.round((prevConcluidos / prevTotal) * 100) : 0
```

E no retorno:
```ts
kpis: {
  total, concluidos, cancelados, naoCompareceu, taxaConclusao,
  variacao: {
    total: percentDelta(total, prevTotal),
    concluidos: percentDelta(concluidos, prevConcluidos),
    taxaConclusaoPp: pointsDelta(taxaConclusao, prevTaxa),
  },
},
```

Import: `pointsDelta` junto aos demais de `./analytics-utils`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/domains/reports/reports.service.test.ts`
Expected: PASS.

- [ ] **Step 6: Rota + hook (categoria)**

`src/app/api/reports/appointments/route.ts`: adicionar `categoryId: sp.get('categoryId') ?? undefined,` ao parse.
`src/hooks/reports/use-appointments-report.ts`: adicionar `categoryId?: string` ao tipo de params e `if (params.categoryId) url.searchParams.set('categoryId', params.categoryId)`.

- [ ] **Step 7: Verificar e commitar**

Run: `npx tsc --noEmit` → zero erros.
```bash
git add src/domains/reports/ src/app/api/reports/appointments/route.ts src/hooks/reports/use-appointments-report.ts
git commit -m "feat(reports): agendamentos com variação vs período anterior e filtro por categoria"
```

---

### Task 5: Backend Clientes — ranking paginado no banco, ordenação e variação

**Files:**
- Modify: `src/domains/reports/types.ts` (bloco Clientes, linhas 68–91)
- Modify: `src/domains/reports/reports.service.ts` (`getCustomersReport`)
- Modify: `src/app/api/reports/customers/route.ts`
- Modify: `src/hooks/reports/use-customers-report.ts`
- Test: `src/domains/reports/reports.service.test.ts`

**Interfaces:**
- Produces (o frontend da Task 15 depende disto):
  - `customersReportSchema` ganha `page: z.coerce.number().int().min(1).default(1)` e `sortBy: z.enum(['receita', 'atendimentos', 'ticketMedio']).default('receita')`
  - `CustomersReportRow = { clienteId: string; clienteNome: string; atendimentos: number; receita: number; ticketMedio: number; ultimoAtendimento: string }`
  - `CustomersReport = { kpis: { totalAtivos; novosNoPeriodo; retorno; variacao: { totalAtivos: KpiDelta; novosNoPeriodo: KpiDelta; retorno: KpiDelta } }; rows; total: number; page: number; pageSize: number }`
  - Constante `CUSTOMERS_PAGE_SIZE = 20` exportada de `types.ts`

- [ ] **Step 1: Testes falhando**

Adicionar a `reports.service.test.ts`:

```ts
describe('ReportsService.getCustomersReport — ranking paginado no banco', () => {
  const rawRow = {
    id: 'c1',
    clienteNome: 'Maria',
    atendimentos: 3,
    receita: 300,
    ticketMedio: 100,
    ultimoAtendimento: new Date('2026-06-20T14:00:00.000Z'),
  }

  beforeEach(() => {
    prismaMock.$queryRaw.mockReset()
    prismaMock.appointment.groupBy.mockReset()
    prismaMock.customer.count.mockReset()
    prismaMock.tenant.findFirstOrThrow.mockResolvedValue({
      timezone: 'America/Sao_Paulo',
    } as never)
  })

  it('retorna rows do banco com paginação e serializa datas', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([rawRow] as never) // ranking
      .mockResolvedValueOnce([{ total: 42 }] as never) // count distinct
    prismaMock.appointment.groupBy
      .mockResolvedValueOnce([{ customerId: 'c1', _count: { _all: 3 } }] as never) // atual
      .mockResolvedValueOnce([] as never) // anterior
    prismaMock.customer.count
      .mockResolvedValueOnce(5 as never) // novos atual
      .mockResolvedValueOnce(2 as never) // novos anterior

    const report = await service.getCustomersReport('tenant-1', { page: 2 })

    expect(report.rows[0]).toEqual({
      clienteId: 'c1',
      clienteNome: 'Maria',
      atendimentos: 3,
      receita: 300,
      ticketMedio: 100,
      ultimoAtendimento: '2026-06-20T14:00:00.000Z',
    })
    expect(report.total).toBe(42)
    expect(report.page).toBe(2)
    expect(report.pageSize).toBe(20)
  })

  it('calcula KPIs e variações a partir das agregações', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ total: 0 }] as never)
    prismaMock.appointment.groupBy
      .mockResolvedValueOnce([
        { customerId: 'c1', _count: { _all: 3 } },
        { customerId: 'c2', _count: { _all: 1 } },
      ] as never) // atual: 2 ativos, 1 com retorno
      .mockResolvedValueOnce([{ customerId: 'c9', _count: { _all: 2 } }] as never) // anterior: 1 ativo, 1 retorno
    prismaMock.customer.count
      .mockResolvedValueOnce(4 as never)
      .mockResolvedValueOnce(2 as never)

    const report = await service.getCustomersReport('tenant-1', {})

    expect(report.kpis.totalAtivos).toBe(2)
    expect(report.kpis.retorno).toBe(1)
    expect(report.kpis.novosNoPeriodo).toBe(4)
    expect(report.kpis.variacao.totalAtivos).toBe(100) // 2 vs 1
    expect(report.kpis.variacao.novosNoPeriodo).toBe(100) // 4 vs 2
    expect(report.kpis.variacao.retorno).toBe(0) // 1 vs 1
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domains/reports/reports.service.test.ts`
Expected: FAIL — assinatura/retorno antigos.

- [ ] **Step 3: Atualizar `types.ts` (bloco Clientes)**

```ts
export const CUSTOMERS_PAGE_SIZE = 20

export const customersReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  professionalId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(['receita', 'atendimentos', 'ticketMedio']).default('receita'),
})

export type CustomersReportInput = z.infer<typeof customersReportSchema>

export type CustomersReportRow = {
  clienteId: string
  clienteNome: string
  atendimentos: number
  receita: number
  ticketMedio: number
  ultimoAtendimento: string
}

export type CustomersReport = {
  kpis: {
    totalAtivos: number
    novosNoPeriodo: number
    retorno: number
    variacao: {
      totalAtivos: KpiDelta
      novosNoPeriodo: KpiDelta
      retorno: KpiDelta
    }
  }
  rows: CustomersReportRow[]
  total: number
  page: number
  pageSize: number
}
```

- [ ] **Step 4: Reescrever `getCustomersReport`**

Substituir o método inteiro por:

```ts
async getCustomersReport(
  tenantId: string,
  input: CustomersReportInput,
): Promise<CustomersReport> {
  const { from, to } = await this.resolvePeriod(tenantId, input)
  const page = input.page ?? 1
  const sortBy = input.sortBy ?? 'receita'
  const offset = (page - 1) * CUSTOMERS_PAGE_SIZE
  const prev = previousWindow(from, to)

  // Filtros compartilhados entre ranking (SQL) e KPIs (Prisma).
  const sqlFilters = Prisma.sql`
    a."tenantId" = ${tenantId}
    AND a."startsAt" BETWEEN ${from} AND ${to}
    AND a.status <> 'CANCELLED'::"AppointmentStatus"
    ${input.professionalId ? Prisma.sql`AND a."professionalId" = ${input.professionalId}` : Prisma.empty}
    ${input.serviceId ? Prisma.sql`AND a."serviceId" = ${input.serviceId}` : Prisma.empty}
  `
  const orderBy =
    sortBy === 'atendimentos'
      ? Prisma.sql`atendimentos DESC`
      : sortBy === 'ticketMedio'
        ? Prisma.sql`"ticketMedio" DESC`
        : Prisma.sql`receita DESC`

  const whereBase = (janela: { from: Date; to: Date }) => ({
    tenantId,
    startsAt: { gte: janela.from, lte: janela.to },
    status: { not: AppointmentStatus.CANCELLED },
    ...(input.professionalId && { professionalId: input.professionalId }),
    ...(input.serviceId && { serviceId: input.serviceId }),
  })

  type RawRow = {
    id: string
    clienteNome: string
    atendimentos: number
    receita: number
    ticketMedio: number
    ultimoAtendimento: Date
  }

  const [rawRows, totalRows, curGroups, prevGroups, novos, novosPrev] = await Promise.all([
    prisma.$queryRaw<RawRow[]>`
      SELECT
        c.id,
        c.name AS "clienteNome",
        COUNT(DISTINCT a.id)::int AS atendimentos,
        COALESCE(SUM(CASE WHEN t.type = 'INCOME'::"TransactionType"
          THEN COALESCE(t."netAmount", t.amount) ELSE 0 END), 0)::float AS receita,
        (COALESCE(SUM(CASE WHEN t.type = 'INCOME'::"TransactionType"
          THEN COALESCE(t."netAmount", t.amount) ELSE 0 END), 0)
          / COUNT(DISTINCT a.id))::float AS "ticketMedio",
        MAX(a."startsAt") AS "ultimoAtendimento"
      FROM "Appointment" a
      JOIN "Customer" c ON c.id = a."customerId"
      LEFT JOIN "Transaction" t ON t."appointmentId" = a.id
      WHERE ${sqlFilters}
      GROUP BY c.id, c.name
      ORDER BY ${orderBy}
      LIMIT ${CUSTOMERS_PAGE_SIZE} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(DISTINCT a."customerId")::int AS total
      FROM "Appointment" a
      WHERE ${sqlFilters}
    `,
    prisma.appointment.groupBy({
      by: ['customerId'],
      where: whereBase({ from, to }),
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ['customerId'],
      where: whereBase(prev),
      _count: { _all: true },
    }),
    prisma.customer.count({ where: { tenantId, createdAt: { gte: from, lte: to } } }),
    prisma.customer.count({ where: { tenantId, createdAt: { gte: prev.from, lte: prev.to } } }),
  ])

  const totalAtivos = curGroups.length
  const retorno = curGroups.filter((g) => g._count._all >= 2).length
  const prevAtivos = prevGroups.length
  const prevRetorno = prevGroups.filter((g) => g._count._all >= 2).length

  return {
    kpis: {
      totalAtivos,
      novosNoPeriodo: novos,
      retorno,
      variacao: {
        totalAtivos: percentDelta(totalAtivos, prevAtivos),
        novosNoPeriodo: percentDelta(novos, novosPrev),
        retorno: percentDelta(retorno, prevRetorno),
      },
    },
    rows: rawRows.map((r) => ({
      clienteId: r.id,
      clienteNome: r.clienteNome,
      atendimentos: r.atendimentos,
      receita: r.receita,
      ticketMedio: r.ticketMedio,
      ultimoAtendimento: r.ultimoAtendimento.toISOString(),
    })),
    total: totalRows[0]?.total ?? 0,
    page,
    pageSize: CUSTOMERS_PAGE_SIZE,
  }
}
```

Imports novos no service:
```ts
import { Prisma } from '@prisma/client'
import { CUSTOMERS_PAGE_SIZE } from './types'
```

Cuidado com o `LEFT JOIN "Transaction"`: cada transação aparece uma única vez no join, então o `SUM` é exato; `COUNT(DISTINCT a.id)` corrige a multiplicação de linhas por appointment com várias transações.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/domains/reports/reports.service.test.ts`
Expected: PASS. Nota: testes antigos de `getCustomersReport` (baseados em `findMany` + `include customer/transactions`) devem ser REMOVIDOS neste passo — a implementação em memória deixou de existir; os novos testes acima os substituem.

- [ ] **Step 6: Rota + hook**

`src/app/api/reports/customers/route.ts` — adicionar ao parse:
```ts
page: sp.get('page') ?? undefined,
sortBy: sp.get('sortBy') ?? undefined,
```

`src/hooks/reports/use-customers-report.ts` — params ganham `page?: number` e `sortBy?: 'receita' | 'atendimentos' | 'ticketMedio'`; serializar ambos (`String(params.page)`). Adicionar `placeholderData: keepPreviousData` (import de `@tanstack/react-query`) para a paginação não piscar.

- [ ] **Step 7: Ajuste transitório do client**

`clientes-client.tsx` compila? Ele lê `data.kpis.*` (ok) e `data.rows` com `r.ultimoAtendimento` (ok). O CSV usa `r.receita.toFixed(2)` (ok). Nenhuma quebra esperada; se `tsc` apontar algo, ajustar minimamente (a reescrita completa do client é a Task 15).

Run: `npx tsc --noEmit` → zero erros.

- [ ] **Step 8: Commitar**

```bash
git add src/domains/reports/ src/app/api/reports/customers/route.ts src/hooks/reports/use-customers-report.ts
git commit -m "feat(reports): ranking de clientes paginado e ordenável agregado no banco, com variação de KPIs"
```

---

### Task 6: Visão Geral — `analytics.service.getOverviewReport` + rota

**Files:**
- Create: `src/domains/reports/analytics.service.ts`
- Modify: `src/domains/reports/types.ts` (novo bloco no final)
- Create: `src/app/api/reports/overview/route.ts`
- Test: `src/domains/reports/analytics.service.test.ts`

**Interfaces:**
- Consumes: `percentDelta`, `pointsDelta`, `previousWindow`, `granularityFor`, `enumerateBuckets`, `Granularity` (Task 2); `featureGuard.canAccess` + `FEATURES.REPORTS_ADVANCED`.
- Produces (Task 12 depende disto):
  - `overviewReportSchema = z.object({ from, to, categoryId })` (mesmos formatos dos schemas existentes)
  - `OverviewSeriesPoint = { bucket: string; faturamento: number; agendamentos: number }`
  - `OverviewReport = { kpis: { faturamento: number; agendamentos: number; ticketMedio: number; novosPct: number; variacao: { faturamento: KpiDelta; agendamentos: KpiDelta; ticketMedio: KpiDelta; novosPctPp: number } }; granularity: Granularity; series: OverviewSeriesPoint[] | null }` — `series: null` = bloqueado por plano
  - `analyticsService` singleton exportado de `analytics.service.ts`
  - Rota `GET /api/reports/overview` (permissão `PERMISSIONS.financial.view`)

- [ ] **Step 1: Tipos em `types.ts`** (novo bloco ao final)

```ts
// ── Visão Geral ───────────────────────────────────────────────────────────────

import type { Granularity } from './analytics-utils'

export const overviewReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  categoryId: z.string().cuid().optional(),
})

export type OverviewReportInput = z.infer<typeof overviewReportSchema>

export type OverviewSeriesPoint = {
  bucket: string
  faturamento: number
  agendamentos: number
}

export type OverviewReport = {
  kpis: {
    faturamento: number
    agendamentos: number
    ticketMedio: number
    novosPct: number
    variacao: {
      faturamento: KpiDelta
      agendamentos: KpiDelta
      ticketMedio: KpiDelta
      novosPctPp: number
    }
  }
  granularity: Granularity
  series: OverviewSeriesPoint[] | null
}
```

(Mover os `import type` para o topo do arquivo junto dos demais.)

- [ ] **Step 2: Testes falhando**

`src/domains/reports/analytics.service.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'

vi.mock('@/domains/billing/feature-guard', () => ({
  FEATURES: { REPORTS_ADVANCED: 'reports_advanced' },
  featureGuard: {
    canAccess: vi.fn(),
    assertAccess: vi.fn(),
  },
}))

import { featureGuard } from '@/domains/billing/feature-guard'
import { AnalyticsService } from './analytics.service'

const service = new AnalyticsService()

const janela = {
  from: '2026-06-01T03:00:00.000Z',
  to: '2026-06-30T02:59:59.999Z',
}

beforeEach(() => {
  vi.mocked(featureGuard.canAccess).mockReset()
  vi.mocked(featureGuard.assertAccess).mockReset()
  prismaMock.tenant.findFirstOrThrow.mockResolvedValue({
    timezone: 'America/Sao_Paulo',
  } as never)
})

describe('AnalyticsService.getOverviewReport', () => {
  function mockQueries(opts: { canAccess: boolean }) {
    vi.mocked(featureGuard.canAccess).mockResolvedValue(opts.canAccess)
    // Ordem dos $queryRaw no service:
    // 1) receita atual  2) receita anterior  3) novos vs recorrentes atual
    // 4) novos vs recorrentes anterior  [5) série receita  6) série agendamentos]
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ receita: 1140, pagos: 10 }] as never)
      .mockResolvedValueOnce([{ receita: 1000, pagos: 10 }] as never)
      .mockResolvedValueOnce([{ total: 20, novos: 5 }] as never)
      .mockResolvedValueOnce([{ total: 20, novos: 4 }] as never)
    if (opts.canAccess) {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ bucket: '2026-06-01', valor: 500 }] as never)
        .mockResolvedValueOnce([{ bucket: '2026-06-02', valor: 3 }] as never)
    }
    prismaMock.appointment.count
      .mockResolvedValueOnce(30 as never) // atual
      .mockResolvedValueOnce(25 as never) // anterior
  }

  it('monta KPIs com variação (% e p.p.)', async () => {
    mockQueries({ canAccess: false })

    const report = await service.getOverviewReport('tenant-1', janela)

    expect(report.kpis.faturamento).toBe(1140)
    expect(report.kpis.agendamentos).toBe(30)
    expect(report.kpis.ticketMedio).toBe(114) // 1140 / 10 pagos
    expect(report.kpis.novosPct).toBe(25) // 5 / 20
    expect(report.kpis.variacao.faturamento).toBe(14)
    expect(report.kpis.variacao.agendamentos).toBe(20)
    expect(report.kpis.variacao.novosPctPp).toBe(5) // 25 - 20
  })

  it('sem reports_advanced, series é null e não roda queries de série', async () => {
    mockQueries({ canAccess: false })

    const report = await service.getOverviewReport('tenant-1', janela)

    expect(report.series).toBeNull()
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(4)
  })

  it('com reports_advanced, preenche buckets vazios com zero', async () => {
    mockQueries({ canAccess: true })

    const report = await service.getOverviewReport('tenant-1', janela)

    expect(report.granularity).toBe('day')
    expect(report.series).not.toBeNull()
    const s = report.series!
    expect(s.find((p) => p.bucket === '2026-06-01')).toEqual({
      bucket: '2026-06-01', faturamento: 500, agendamentos: 0,
    })
    expect(s.find((p) => p.bucket === '2026-06-02')).toEqual({
      bucket: '2026-06-02', faturamento: 0, agendamentos: 3,
    })
    // todos os dias de junho até o 'to' presentes, mesmo sem dados
    expect(s.find((p) => p.bucket === '2026-06-15')?.faturamento).toBe(0)
  })
})
```

Run: `npx vitest run src/domains/reports/analytics.service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `analytics.service.ts`**

```ts
import { Prisma } from '@prisma/client'

import { prisma } from '@/shared/database/prisma'
import { dayBoundsInTz, monthBoundsInTz } from '@/lib/dates'
import { featureGuard, FEATURES } from '@/domains/billing/feature-guard'

import {
  enumerateBuckets, granularityFor, percentDelta, pointsDelta, previousWindow,
  type Granularity,
} from './analytics-utils'
import type { OverviewReport, OverviewReportInput } from './types'

type Janela = { from: Date; to: Date }

export class AnalyticsService {
  // Mesma regra do ReportsService.resolvePeriod, mas o timezone é sempre
  // necessário aqui (date_trunc/extract rodam no fuso do tenant).
  private async resolvePeriodTz(
    tenantId: string,
    input: { from?: string; to?: string },
  ): Promise<{ from: Date; to: Date; tz: string }> {
    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    })
    const tz = tenant.timezone ?? 'America/Sao_Paulo'
    return {
      from: input.from ? new Date(input.from) : monthBoundsInTz(tz).start,
      to: input.to ? new Date(input.to) : dayBoundsInTz(tz).end,
      tz,
    }
  }

  private categoryJoin(categoryId?: string): Prisma.Sql {
    return categoryId
      ? Prisma.sql`
          JOIN "Appointment" ap ON ap.id = t."appointmentId"
          JOIN "Service" s ON s.id = ap."serviceId" AND s."categoryId" = ${categoryId}`
      : Prisma.empty
  }

  private async revenueKpis(
    tenantId: string,
    janela: Janela,
    categoryId?: string,
  ): Promise<{ receita: number; pagos: number }> {
    const rows = await prisma.$queryRaw<{ receita: number; pagos: number }[]>`
      SELECT
        COALESCE(SUM(COALESCE(t."netAmount", t.amount)), 0)::float AS receita,
        COUNT(DISTINCT t."appointmentId")::int AS pagos
      FROM "Transaction" t
      ${this.categoryJoin(categoryId)}
      WHERE t."tenantId" = ${tenantId}
        AND t.type = 'INCOME'::"TransactionType"
        AND t."paidAt" BETWEEN ${janela.from} AND ${janela.to}
    `
    return rows[0] ?? { receita: 0, pagos: 0 }
  }

  private async newVsReturning(
    tenantId: string,
    janela: Janela,
    categoryId?: string,
  ): Promise<{ total: number; novos: number }> {
    const categoryFilter = categoryId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "Service" s
          WHERE s.id = a."serviceId" AND s."categoryId" = ${categoryId})`
      : Prisma.empty
    const rows = await prisma.$queryRaw<{ total: number; novos: number }[]>`
      SELECT
        COUNT(DISTINCT a."customerId")::int AS total,
        COUNT(DISTINCT a."customerId")
          FILTER (WHERE c."createdAt" >= ${janela.from})::int AS novos
      FROM "Appointment" a
      JOIN "Customer" c ON c.id = a."customerId"
      WHERE a."tenantId" = ${tenantId}
        AND a."startsAt" BETWEEN ${janela.from} AND ${janela.to}
        AND a.status <> 'CANCELLED'::"AppointmentStatus"
        ${categoryFilter}
    `
    return rows[0] ?? { total: 0, novos: 0 }
  }

  private countAppointments(
    tenantId: string,
    janela: Janela,
    categoryId?: string,
  ): Promise<number> {
    return prisma.appointment.count({
      where: {
        tenantId,
        startsAt: { gte: janela.from, lte: janela.to },
        status: { not: 'CANCELLED' },
        ...(categoryId && { service: { categoryId } }),
      },
    })
  }

  private async series(
    tenantId: string,
    janela: Janela,
    tz: string,
    granularity: Granularity,
    categoryId?: string,
  ): Promise<{ bucket: string; faturamento: number; agendamentos: number }[]> {
    const categoryFilter = categoryId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "Service" s
          WHERE s.id = a."serviceId" AND s."categoryId" = ${categoryId})`
      : Prisma.empty

    const [receitaRows, agendamentoRows] = await Promise.all([
      prisma.$queryRaw<{ bucket: string; valor: number }[]>`
        SELECT
          to_char(date_trunc(${granularity},
            timezone(${tz}, timezone('UTC', t."paidAt"))), 'YYYY-MM-DD') AS bucket,
          COALESCE(SUM(COALESCE(t."netAmount", t.amount)), 0)::float AS valor
        FROM "Transaction" t
        ${this.categoryJoin(categoryId)}
        WHERE t."tenantId" = ${tenantId}
          AND t.type = 'INCOME'::"TransactionType"
          AND t."paidAt" BETWEEN ${janela.from} AND ${janela.to}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ bucket: string; valor: number }[]>`
        SELECT
          to_char(date_trunc(${granularity},
            timezone(${tz}, timezone('UTC', a."startsAt"))), 'YYYY-MM-DD') AS bucket,
          COUNT(*)::int AS valor
        FROM "Appointment" a
        WHERE a."tenantId" = ${tenantId}
          AND a."startsAt" BETWEEN ${janela.from} AND ${janela.to}
          AND a.status <> 'CANCELLED'::"AppointmentStatus"
          ${categoryFilter}
        GROUP BY 1
        ORDER BY 1
      `,
    ])

    const receitaPorBucket = new Map(receitaRows.map((r) => [r.bucket, r.valor]))
    const agendaPorBucket = new Map(agendamentoRows.map((r) => [r.bucket, r.valor]))

    return enumerateBuckets(janela.from, janela.to, granularity, tz).map((bucket) => ({
      bucket,
      faturamento: receitaPorBucket.get(bucket) ?? 0,
      agendamentos: agendaPorBucket.get(bucket) ?? 0,
    }))
  }

  async getOverviewReport(
    tenantId: string,
    input: OverviewReportInput,
  ): Promise<OverviewReport> {
    const { from, to, tz } = await this.resolvePeriodTz(tenantId, input)
    const atual: Janela = { from, to }
    const anterior = previousWindow(from, to)
    const granularity = granularityFor(from, to)

    const [receitaAtual, receitaAnterior, clientesAtual, clientesAnterior, agAtual, agAnterior, temSerie] =
      await Promise.all([
        this.revenueKpis(tenantId, atual, input.categoryId),
        this.revenueKpis(tenantId, anterior, input.categoryId),
        this.newVsReturning(tenantId, atual, input.categoryId),
        this.newVsReturning(tenantId, anterior, input.categoryId),
        this.countAppointments(tenantId, atual, input.categoryId),
        this.countAppointments(tenantId, anterior, input.categoryId),
        featureGuard.canAccess(tenantId, FEATURES.REPORTS_ADVANCED),
      ])

    const ticketAtual = receitaAtual.pagos > 0 ? receitaAtual.receita / receitaAtual.pagos : 0
    const ticketAnterior =
      receitaAnterior.pagos > 0 ? receitaAnterior.receita / receitaAnterior.pagos : 0
    const novosPct =
      clientesAtual.total > 0 ? Math.round((clientesAtual.novos / clientesAtual.total) * 100) : 0
    const novosPctAnterior =
      clientesAnterior.total > 0
        ? Math.round((clientesAnterior.novos / clientesAnterior.total) * 100)
        : 0

    const series = temSerie
      ? await this.series(tenantId, atual, tz, granularity, input.categoryId)
      : null

    return {
      kpis: {
        faturamento: receitaAtual.receita,
        agendamentos: agAtual,
        ticketMedio: ticketAtual,
        novosPct,
        variacao: {
          faturamento: percentDelta(receitaAtual.receita, receitaAnterior.receita),
          agendamentos: percentDelta(agAtual, agAnterior),
          ticketMedio: percentDelta(ticketAtual, ticketAnterior),
          novosPctPp: pointsDelta(novosPct, novosPctAnterior),
        },
      },
      granularity,
      series,
    }
  }
}

export const analyticsService = new AnalyticsService()
```

Nota sobre a ordem dos mocks no teste: `Promise.all` dispara os 4 `$queryRaw` de KPIs na ordem em que aparecem no array (revenue atual, revenue anterior, novos atual, novos anterior); a série roda DEPOIS (await separado), então as posições 5 e 6 dos mocks são as séries. `status: { not: 'CANCELLED' }` no `countAppointments` usa o literal do enum aceito pelo Prisma (import de `AppointmentStatus` não é necessário; se o `tsc` reclamar, importar e usar `AppointmentStatus.CANCELLED`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domains/reports/analytics.service.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Criar a rota `src/app/api/reports/overview/route.ts`**

```ts
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { analyticsService } from '@/domains/reports/analytics.service'
import { overviewReportSchema } from '@/domains/reports/types'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.financial.view)

    const sp = new URL(request.url).searchParams
    const input = overviewReportSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      categoryId: sp.get('categoryId') ?? undefined,
    })

    const result = await analyticsService.getOverviewReport(session.tenantId, input)
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 6: Verificar e commitar**

Run: `npx tsc --noEmit` → zero erros. `npx vitest run src/domains/reports/` → PASS.

```bash
git add src/domains/reports/ src/app/api/reports/overview/
git commit -m "feat(reports): visão geral com KPIs comparados e série temporal agregada no banco"
```

---

### Task 7: Sazonalidade — `getSeasonalityReport` + rota (gated)

**Files:**
- Modify: `src/domains/reports/analytics.service.ts`
- Modify: `src/domains/reports/types.ts`
- Create: `src/app/api/reports/seasonality/route.ts`
- Test: `src/domains/reports/analytics.service.test.ts`

**Interfaces:**
- Produces (Task 14 depende disto):
  - `seasonalityReportSchema = z.object({ from, to, professionalId, categoryId })`
  - `SeasonalityCell = { dow: number; hora: number; total: number }` — `dow` no padrão Postgres `EXTRACT(DOW)`: 0 = domingo
  - `SeasonalityReport = { cells: SeasonalityCell[]; maxTotal: number }`
  - `analyticsService.getSeasonalityReport(tenantId, input)` — lança `PlanFeatureError` sem `reports_advanced`
  - Rota `GET /api/reports/seasonality` (permissão `PERMISSIONS.appointments.view`)

- [ ] **Step 1: Tipos em `types.ts`** (bloco ao final)

```ts
// ── Sazonalidade ──────────────────────────────────────────────────────────────

export const seasonalityReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  professionalId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
})

export type SeasonalityReportInput = z.infer<typeof seasonalityReportSchema>

export type SeasonalityCell = { dow: number; hora: number; total: number }

export type SeasonalityReport = {
  cells: SeasonalityCell[]
  maxTotal: number
}
```

- [ ] **Step 2: Testes falhando** (adicionar em `analytics.service.test.ts`)

```ts
describe('AnalyticsService.getSeasonalityReport', () => {
  it('exige reports_advanced antes de consultar', async () => {
    vi.mocked(featureGuard.assertAccess).mockRejectedValue(new Error('PLAN_FEATURE_REQUIRED'))

    await expect(service.getSeasonalityReport('tenant-1', {})).rejects.toThrow()
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('retorna células e o total máximo para escala do heatmap', async () => {
    vi.mocked(featureGuard.assertAccess).mockResolvedValue(undefined)
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { dow: 1, hora: 9, total: 4 },
      { dow: 6, hora: 14, total: 9 },
    ] as never)

    const report = await service.getSeasonalityReport('tenant-1', janela)

    expect(report.cells).toHaveLength(2)
    expect(report.maxTotal).toBe(9)
  })
})
```

Run: `npx vitest run src/domains/reports/analytics.service.test.ts`
Expected: FAIL — método não existe.

- [ ] **Step 3: Implementar no `analytics.service.ts`**

```ts
async getSeasonalityReport(
  tenantId: string,
  input: SeasonalityReportInput,
): Promise<SeasonalityReport> {
  await featureGuard.assertAccess(tenantId, FEATURES.REPORTS_ADVANCED)

  const { from, to, tz } = await this.resolvePeriodTz(tenantId, input)
  const categoryFilter = input.categoryId
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "Service" s
        WHERE s.id = a."serviceId" AND s."categoryId" = ${input.categoryId})`
    : Prisma.empty

  const cells = await prisma.$queryRaw<SeasonalityCell[]>`
    SELECT
      EXTRACT(DOW FROM timezone(${tz}, timezone('UTC', a."startsAt")))::int AS dow,
      EXTRACT(HOUR FROM timezone(${tz}, timezone('UTC', a."startsAt")))::int AS hora,
      COUNT(*)::int AS total
    FROM "Appointment" a
    WHERE a."tenantId" = ${tenantId}
      AND a."startsAt" BETWEEN ${from} AND ${to}
      AND a.status <> 'CANCELLED'::"AppointmentStatus"
      ${input.professionalId ? Prisma.sql`AND a."professionalId" = ${input.professionalId}` : Prisma.empty}
      ${categoryFilter}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `
  const maxTotal = cells.reduce((m, c) => Math.max(m, c.total), 0)
  return { cells, maxTotal }
}
```

Imports adicionais: `SeasonalityCell`, `SeasonalityReport`, `SeasonalityReportInput` de `./types`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domains/reports/analytics.service.test.ts`
Expected: PASS.

Atenção ao primeiro teste: `assertAccess` deve rodar ANTES de `resolvePeriodTz` (o mock de `tenant.findFirstOrThrow` está resolvido, mas `$queryRaw` não pode ter sido chamado).

- [ ] **Step 5: Rota `src/app/api/reports/seasonality/route.ts`**

Mesmo esqueleto da rota de overview, trocando: `ensurePermission(session, PERMISSIONS.appointments.view)`, schema `seasonalityReportSchema` (parse de `from`, `to`, `professionalId`, `categoryId`) e chamada `analyticsService.getSeasonalityReport(...)`.

- [ ] **Step 6: Verificar e commitar**

Run: `npx tsc --noEmit` e `npx vitest run src/domains/reports/` → PASS.
```bash
git add src/domains/reports/ src/app/api/reports/seasonality/
git commit -m "feat(reports): relatório de sazonalidade dia x hora (gated reports_advanced)"
```

---

### Task 8: Clientes inativos — `getInactiveCustomersReport` + rota (gated)

**Files:**
- Modify: `src/domains/reports/analytics.service.ts`
- Modify: `src/domains/reports/types.ts`
- Create: `src/app/api/reports/customers/inactive/route.ts`
- Test: `src/domains/reports/analytics.service.test.ts`

**Interfaces:**
- Produces (Task 15 depende disto):
  - `inactiveCustomersSchema = z.object({ days: z.coerce.number().int().min(15).max(365).default(90), page: z.coerce.number().int().min(1).default(1) })`
  - `InactiveCustomerRow = { clienteId: string; nome: string; telefone: string | null; ultimoAtendimento: string; diasInativo: number; valorHistorico: number }`
  - `InactiveCustomersReport = { rows: InactiveCustomerRow[]; total: number; page: number; pageSize: number }` (pageSize 20, mesma `CUSTOMERS_PAGE_SIZE`)
  - Rota `GET /api/reports/customers/inactive` (permissão `PERMISSIONS.customers.view`), gated `reports_advanced`

- [ ] **Step 1: Tipos em `types.ts`**

```ts
// ── Clientes inativos ─────────────────────────────────────────────────────────

export const inactiveCustomersSchema = z.object({
  days: z.coerce.number().int().min(15).max(365).default(90),
  page: z.coerce.number().int().min(1).default(1),
})

export type InactiveCustomersInput = z.infer<typeof inactiveCustomersSchema>

export type InactiveCustomerRow = {
  clienteId: string
  nome: string
  telefone: string | null
  ultimoAtendimento: string
  diasInativo: number
  valorHistorico: number
}

export type InactiveCustomersReport = {
  rows: InactiveCustomerRow[]
  total: number
  page: number
  pageSize: number
}
```

- [ ] **Step 2: Testes falhando** (adicionar em `analytics.service.test.ts`)

```ts
describe('AnalyticsService.getInactiveCustomersReport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-03T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('exige reports_advanced', async () => {
    vi.mocked(featureGuard.assertAccess).mockRejectedValue(new Error('PLAN_FEATURE_REQUIRED'))

    await expect(service.getInactiveCustomersReport('tenant-1', { days: 90, page: 1 })).rejects.toThrow()
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('retorna inativos com dias calculados e paginação', async () => {
    vi.mocked(featureGuard.assertAccess).mockResolvedValue(undefined)
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{
        clienteId: 'c1',
        nome: 'João',
        telefone: '11999998888',
        ultimoAtendimento: new Date('2026-03-05T15:00:00.000Z'), // 120 dias atrás
        valorHistorico: 850,
      }] as never)
      .mockResolvedValueOnce([{ total: 7 }] as never)

    const report = await service.getInactiveCustomersReport('tenant-1', { days: 90, page: 1 })

    expect(report.rows[0].diasInativo).toBe(120)
    expect(report.rows[0].valorHistorico).toBe(850)
    expect(report.rows[0].ultimoAtendimento).toBe('2026-03-05T15:00:00.000Z')
    expect(report.total).toBe(7)
    expect(report.pageSize).toBe(20)
  })
})
```

(Adicionar `afterEach` ao import do vitest no topo do arquivo, se ainda não estiver.)

Run: `npx vitest run src/domains/reports/analytics.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar no `analytics.service.ts`**

```ts
async getInactiveCustomersReport(
  tenantId: string,
  input: InactiveCustomersInput,
): Promise<InactiveCustomersReport> {
  await featureGuard.assertAccess(tenantId, FEATURES.REPORTS_ADVANCED)

  const days = input.days ?? 90
  const page = input.page ?? 1
  const offset = (page - 1) * CUSTOMERS_PAGE_SIZE
  const agora = new Date()
  const corte = new Date(agora.getTime() - days * 86_400_000)

  type RawRow = {
    clienteId: string
    nome: string
    telefone: string | null
    ultimoAtendimento: Date
    valorHistorico: number
  }

  const [rows, totalRows] = await Promise.all([
    prisma.$queryRaw<RawRow[]>`
      SELECT
        c.id AS "clienteId",
        c.name AS nome,
        c.phone AS telefone,
        MAX(a."startsAt") AS "ultimoAtendimento",
        COALESCE(SUM(CASE WHEN t.type = 'INCOME'::"TransactionType"
          THEN COALESCE(t."netAmount", t.amount) ELSE 0 END), 0)::float AS "valorHistorico"
      FROM "Customer" c
      JOIN "Appointment" a ON a."customerId" = c.id
        AND a.status <> 'CANCELLED'::"AppointmentStatus"
      LEFT JOIN "Transaction" t ON t."appointmentId" = a.id
      WHERE c."tenantId" = ${tenantId}
        AND a."tenantId" = ${tenantId}
      GROUP BY c.id, c.name, c.phone
      HAVING MAX(a."startsAt") < ${corte}
      ORDER BY "valorHistorico" DESC
      LIMIT ${CUSTOMERS_PAGE_SIZE} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM (
        SELECT c.id
        FROM "Customer" c
        JOIN "Appointment" a ON a."customerId" = c.id
          AND a.status <> 'CANCELLED'::"AppointmentStatus"
        WHERE c."tenantId" = ${tenantId}
          AND a."tenantId" = ${tenantId}
        GROUP BY c.id
        HAVING MAX(a."startsAt") < ${corte}
      ) sub
    `,
  ])

  return {
    rows: rows.map((r) => ({
      clienteId: r.clienteId,
      nome: r.nome,
      telefone: r.telefone,
      ultimoAtendimento: r.ultimoAtendimento.toISOString(),
      diasInativo: Math.floor(
        (agora.getTime() - r.ultimoAtendimento.getTime()) / 86_400_000,
      ),
      valorHistorico: r.valorHistorico,
    })),
    total: totalRows[0]?.total ?? 0,
    page,
    pageSize: CUSTOMERS_PAGE_SIZE,
  }
}
```

Import adicional: `CUSTOMERS_PAGE_SIZE` e os tipos de inativos de `./types`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domains/reports/analytics.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Rota `src/app/api/reports/customers/inactive/route.ts`**

Mesmo esqueleto das rotas anteriores: `ensurePermission(session, PERMISSIONS.customers.view)`; parse de `days` e `page` (`sp.get('days') ?? undefined`, `sp.get('page') ?? undefined`) com `inactiveCustomersSchema`; chama `analyticsService.getInactiveCustomersReport`.

- [ ] **Step 6: Verificar e commitar**

Run: `npx tsc --noEmit` e `npx vitest run src/domains/reports/` → PASS.
```bash
git add src/domains/reports/ src/app/api/reports/customers/inactive/
git commit -m "feat(reports): relatório de clientes inativos por valor histórico (gated reports_advanced)"
```

---

### Task 9: Remoção da página Profissionais (conteúdo duplicado)

**Files:**
- Delete: `src/app/(app)/relatorios/profissionais/page.tsx` e `profissionais-client.tsx`
- Delete: `src/app/api/reports/professionals/route.ts`
- Delete: `src/hooks/reports/use-professionals-report.ts`
- Modify: `src/domains/reports/reports.service.ts` (remover `getProfessionalsReport`, linhas 226–277)
- Modify: `src/domains/reports/types.ts` (remover bloco Profissionais, linhas 93–118)
- Modify: `src/components/domain/reports/reports-sidebar.tsx` (remover item Profissionais)
- Modify: `src/domains/reports/reports.service.test.ts` (remover testes de `getProfessionalsReport`, se existirem)

**Interfaces:**
- Consumes: nada.
- Produces: ausência — nenhum módulo pode mais referenciar `professionalsReportSchema`, `ProfessionalsReport*`, `useProfessionalsReport` ou `/relatorios/profissionais`.

- [ ] **Step 1: Mapear todas as referências antes de deletar**

Run: `grep -rn "professionals\|Profissionais\|professionalsReport" src --include="*.ts*" | grep -iv "professionalId\|professionalIds\|professionalServices\|profissional\b"`

Revisar a saída: além dos arquivos listados acima, qualquer outra referência encontrada deve ser tratada (ex.: navegação, testes). O item `Profissionais` do `reports-sidebar.tsx` e o import do ícone `Scissors` saem juntos.

- [ ] **Step 2: Deletar arquivos e blocos**

```bash
git rm src/app/api/reports/professionals/route.ts src/hooks/reports/use-professionals-report.ts
git rm -r "src/app/(app)/relatorios/profissionais"
```

Em `reports.service.ts`: remover o método `getProfessionalsReport` e, com ele, os imports que ficarem órfãos (`featureGuard`, `FEATURES` — conferir se mais nada os usa no arquivo).
Em `types.ts`: remover o bloco `── Profissionais ──` inteiro.
Em `reports-sidebar.tsx`: remover a linha do item e o `Scissors` do import do lucide.
Em `reports.service.test.ts`: remover `describe`s de professionals (se houver).

- [ ] **Step 3: Verificar que nada quebrou**

Run: `npx tsc --noEmit` → zero erros (se apontar referência restante, removê-la).
Run: `npx vitest run src/domains/reports/` → PASS.
Run: `grep -rn "use-professionals-report\|relatorios/profissionais" src` → sem resultados.

- [ ] **Step 4: Commitar**

```bash
git add -A
git commit -m "refactor(reports): remove relatório de Profissionais — conteúdo unificado no Financeiro e Agendamentos"
```

---

### Task 10: GATE — Mockup HTML estático + aprovação do usuário

**Files:**
- Create: `C:\Users\Usuario\AppData\Local\Temp\claude\c--dev-estetica-saas\<session>\scratchpad\mockup-relatorios-fase1.html` (fora do repositório — não commitar)

Preferência registrada do usuário: **features visuais só depois de mockup estático aprovado**; mockups apresentados no chat/arquivo local, sem servidor.

- [ ] **Step 1: Montar o mockup**

Um único HTML estático (Tailwind via CDN permitido no mockup) com 4 seções, cada uma em duas larguras (frame mobile 375px e desktop):
1. **Visão Geral**: pills de período (Hoje/7 dias/Este mês/Mês passado/Este ano/Personalizado), select de categoria, 4 KPIs com setas de variação (▲ emerald / ▼ rose), toggle Faturamento|Agendamentos, gráfico de linha (SVG estático ilustrativo) e o estado bloqueado (LockedFeatureCard) da linha para plano base.
2. **Financeiro**: KPIs com variação, donut (SVG estático, 5 fatias + "Outros" em cinza, legenda nome + %) ao lado da tabela com coluna "Ticket médio".
3. **Agendamentos**: KPIs com variação + heatmap 7 colunas (Seg→Dom) × horas, com intensidade de cor e scroll horizontal no frame mobile; estado bloqueado do heatmap.
4. **Clientes**: abas Ranking | Inativos; Ranking com select de ordenação e paginação ("21–40 de 132", Anterior/Próxima); Inativos com select de dias (30/60/90/180), botão WhatsApp por linha e estado bloqueado da aba.

Cores: paleta `#0ea5e9 #8b5cf6 #f59e0b #14b8a6 #d946ef #6366f1`, "Outros" `#94a3b8`; verde/vermelho APENAS nas setas de variação.

- [ ] **Step 2: PAUSAR e aguardar aprovação**

Apresentar o caminho do arquivo ao usuário para abrir no navegador, com resumo do que observar. **NÃO prosseguir para as Tasks 11–15 sem aprovação explícita.** Iterar o mockup conforme feedback.

---

### Task 11: Infra de frontend — Recharts, paleta, KPI com delta, upsell inline e paginação

**Files:**
- Run: `npx shadcn@latest add chart` (cria `src/components/ui/chart.tsx` e instala `recharts`)
- Create: `src/components/domain/reports/charts/palette.ts`
- Modify: `src/components/domain/reports/report-kpis.tsx`
- Create: `src/hooks/reports/report-fetcher.ts`
- Create: `src/components/domain/reports/locked-feature-card.tsx`
- Create: `src/components/domain/reports/report-pagination.tsx`

**Interfaces:**
- Produces (Tasks 12–15 dependem disto):
  - `stableColor(id: string | null): string` e `OTHERS_COLOR` de `charts/palette.ts`
  - `KpiCard = { label: string; value: string | number; delta?: KpiDelta; deltaUnit?: '%' | 'pp'; invertDeltaColor?: boolean }`
  - `fetchReport<T>(url: URL): Promise<T>` e `class FeatureLockedError` de `report-fetcher.ts`
  - `<LockedFeatureCard title description />`
  - `<ReportPagination page pageSize total onPageChange isLoading? />`

- [ ] **Step 1: Instalar o chart do Shadcn**

Run: `npx shadcn@latest add chart`
Verify: `src/components/ui/chart.tsx` existe e `grep recharts package.json` retorna a dependência. Se o CLI perguntar sobre sobrescrever algo fora de `chart.tsx`, recusar.

- [ ] **Step 2: `charts/palette.ts`**

```ts
// Paleta dos gráficos de relatórios. Verde/vermelho ficam de fora de propósito:
// são reservados para indicadores de variação (▲/▼).
export const CHART_PALETTE = [
  '#0ea5e9', '#8b5cf6', '#f59e0b', '#14b8a6', '#d946ef', '#6366f1',
] as const

export const OTHERS_COLOR = '#94a3b8'

// Cor estável por entidade: o mesmo serviço/profissional recebe a mesma cor
// em todos os gráficos, em qualquer período.
export function stableColor(id: string | null): string {
  if (!id) return OTHERS_COLOR
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CHART_PALETTE[h % CHART_PALETTE.length]
}
```

- [ ] **Step 3: `report-kpis.tsx` com delta**

Substituir o conteúdo por:

```tsx
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { KpiDelta } from '@/domains/reports/analytics-utils'

export type KpiCard = {
  label: string
  value: string | number
  delta?: KpiDelta
  deltaUnit?: '%' | 'pp'
  // Para métricas em que subir é ruim (ex: despesa), inverte a cor.
  invertDeltaColor?: boolean
}

type Props = {
  cards: KpiCard[]
  isLoading: boolean
}

function DeltaBadge({ card }: { card: KpiCard }) {
  if (card.delta === undefined || card.delta === null) return null
  const up = card.delta >= 0
  const good = card.invertDeltaColor ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <p
      className={cn(
        'mt-1 flex items-center gap-0.5 text-xs font-medium',
        card.delta === 0 ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-rose-600',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {Math.abs(card.delta)}
      {card.deltaUnit === 'pp' ? ' p.p.' : '%'}
      <span className="ml-1 font-normal text-slate-400">vs. anterior</span>
    </p>
  )
}

export function ReportKpis({ cards, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm sm:p-5">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm sm:p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {card.label}
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950 sm:text-2xl">{card.value}</p>
          <DeltaBadge card={card} />
        </div>
      ))}
    </div>
  )
}
```

(Mudança mobile-first: `grid-cols-2` na base — antes era 1 coluna implícita.)

- [ ] **Step 4: `report-fetcher.ts`**

```ts
// Fetch compartilhado dos hooks de relatório: converte o 403 de feature de
// plano em erro tipado para a UI exibir upsell em vez de erro genérico.
export class FeatureLockedError extends Error {
  constructor() {
    super('PLAN_FEATURE_REQUIRED')
    this.name = 'FeatureLockedError'
  }
}

export async function fetchReport<T>(url: URL): Promise<T> {
  const res = await fetch(url)
  if (res.status === 403) {
    const body: { error?: { code?: string } } | null = await res.json().catch(() => null)
    if (body?.error?.code === 'PLAN_FEATURE_REQUIRED') throw new FeatureLockedError()
  }
  if (!res.ok) throw new Error('Falha ao carregar relatório')
  return res.json() as Promise<T>
}

// Para useQuery: não adianta re-tentar um bloqueio de plano.
export function retryUnlessLocked(failureCount: number, error: Error): boolean {
  return !(error instanceof FeatureLockedError) && failureCount < 3
}
```

- [ ] **Step 5: `locked-feature-card.tsx`**

```tsx
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  title: string
  description: string
}

export function LockedFeatureCard({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-amber-100">
        <Lock className="size-5 text-amber-600" />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="max-w-sm text-xs text-slate-500">{description}</p>
      <Button asChild size="sm" variant="outline" className="mt-1">
        <Link href="/configuracoes/planos">Ver planos</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 6: `report-pagination.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'

type Props = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function ReportPagination({ page, pageSize, total, onPageChange, isLoading }: Props) {
  if (total <= pageSize) return null
  const inicio = (page - 1) * pageSize + 1
  const fim = Math.min(page * pageSize, total)
  const ultimaPagina = Math.ceil(total / pageSize)

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        {inicio}–{fim} de {total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline" size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline" size="sm"
          disabled={page >= ultimaPagina || isLoading}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verificar e commitar**

Run: `npx tsc --noEmit` → zero erros (os clients existentes seguem compilando: os campos novos de `KpiCard` são opcionais).

```bash
git add package.json package-lock.json src/components/ui/chart.tsx src/components/domain/reports/ src/hooks/reports/report-fetcher.ts
git commit -m "feat(reports): infra de gráficos, KPI com variação, upsell inline e paginação"
```

---

### Task 12: Página Visão Geral (nova landing de /relatorios)

**Files:**
- Create: `src/hooks/reports/use-overview-report.ts`
- Create: `src/components/domain/reports/charts/revenue-line-chart.tsx`
- Create: `src/components/domain/reports/category-select.tsx`
- Create: `src/app/(app)/relatorios/visao-geral-client.tsx`
- Modify: `src/app/(app)/relatorios/page.tsx` (substituir o redirect)
- Modify: `src/components/domain/reports/reports-sidebar.tsx`

**Interfaces:**
- Consumes: `OverviewReport` (Task 6), `fetchReport`/`retryUnlessLocked`/`FeatureLockedError` e `LockedFeatureCard` (Task 11), `useServiceCategories` de `@/hooks/scheduling/use-service-categories`.
- Produces: `useOverviewReport(params: { from?: string; to?: string; categoryId?: string })`; `<RevenueLineChart series granularity metric />`; `<CategorySelect value onChange />` (reutilizado nas Tasks 13–14).

- [ ] **Step 1: Hook `use-overview-report.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import type { OverviewReport } from '@/domains/reports/types'
import { fetchReport, retryUnlessLocked } from './report-fetcher'

export type OverviewReportParams = {
  from?: string
  to?: string
  categoryId?: string
}

async function fetchOverview(params: OverviewReportParams): Promise<OverviewReport> {
  const url = new URL('/api/reports/overview', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.categoryId) url.searchParams.set('categoryId', params.categoryId)
  return fetchReport<OverviewReport>(url)
}

export function useOverviewReport(params: OverviewReportParams) {
  return useQuery({
    queryKey: ['reports', 'overview', params],
    queryFn: () => fetchOverview(params),
    staleTime: 60_000,
    retry: retryUnlessLocked,
  })
}
```

- [ ] **Step 2: `charts/revenue-line-chart.tsx`**

```tsx
'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart'
import type { OverviewSeriesPoint } from '@/domains/reports/types'
import type { Granularity } from '@/domains/reports/analytics-utils'

const CONFIG = {
  faturamento: { label: 'Faturamento', color: '#0ea5e9' },
  agendamentos: { label: 'Agendamentos', color: '#8b5cf6' },
} satisfies ChartConfig

type Props = {
  series: OverviewSeriesPoint[]
  granularity: Granularity
  metric: 'faturamento' | 'agendamentos'
}

function fmtBucket(bucket: string, granularity: Granularity): string {
  const [ano, mes, dia] = bucket.split('-')
  if (granularity === 'month') {
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`
  }
  return `${dia}/${mes}`
}

function fmtValor(v: number, metric: Props['metric']): string {
  return metric === 'faturamento'
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : String(v)
}

export function RevenueLineChart({ series, granularity, metric }: Props) {
  return (
    <ChartContainer config={CONFIG} className="h-56 w-full sm:h-72">
      <LineChart data={series} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(b: string) => fmtBucket(b, granularity)}
        />
        <YAxis
          width={metric === 'faturamento' ? 64 : 32}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            metric === 'faturamento' ? `R$ ${Math.round(v / 100) / 10}k`.replace('R$ 0k', 'R$ 0') : String(v)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(b) => fmtBucket(String(b), granularity)}
              formatter={(value) => fmtValor(Number(value), metric)}
            />
          }
        />
        <Line
          type="monotone"
          dataKey={metric}
          stroke={`var(--color-${metric})`}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
```

(Se a API do `chart.tsx` gerado divergir — versões do shadcn variam —, adaptar mantendo: tooltip com valor exato formatado, eixo X com rótulos pt-BR, altura `h-56` mobile / `h-72` desktop.)

- [ ] **Step 3: `category-select.tsx`** (compartilhado entre Visão Geral, Financeiro e Agendamentos)

```tsx
'use client'

import { useServiceCategories } from '@/hooks/scheduling/use-service-categories'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type Props = {
  value: string // 'all' ou categoryId
  onChange: (value: string) => void
}

export function CategorySelect({ value, onChange }: Props) {
  const { data: categorias } = useServiceCategories()
  if (!categorias || categorias.length === 0) return null

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-48">
        <SelectValue placeholder="Categoria: Todas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as categorias</SelectItem>
        {categorias.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

Nota: conferir a assinatura real de `useServiceCategories` em `src/hooks/scheduling/use-service-categories.ts` (retorna `ServiceCategory[]` com `{ id, name, order, active }`); filtrar `active` se o hook não filtrar.

- [ ] **Step 4: `visao-geral-client.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useOverviewReport } from '@/hooks/reports/use-overview-report'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { CategorySelect } from '@/components/domain/reports/category-select'
import { RevenueLineChart } from '@/components/domain/reports/charts/revenue-line-chart'
import { LockedFeatureCard } from '@/components/domain/reports/locked-feature-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { startOfMonth, endOfDay } from '@/lib/dates'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const defaultPeriod: PeriodValue = {
  from: startOfMonth(new Date()).toISOString(),
  to: endOfDay(new Date()).toISOString(),
}

export function VisaoGeralClient() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [categoryId, setCategoryId] = useState<string>('all')
  const [metric, setMetric] = useState<'faturamento' | 'agendamentos'>('faturamento')

  const { data, isLoading, isError } = useOverviewReport({
    from: period.from,
    to: period.to,
    categoryId: categoryId === 'all' ? undefined : categoryId,
  })

  if (!can('relatorios', 'view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar relatórios.</p>
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
        { label: 'Faturamento', value: fmtBRL(data.kpis.faturamento), delta: data.kpis.variacao.faturamento },
        { label: 'Agendamentos', value: data.kpis.agendamentos, delta: data.kpis.variacao.agendamentos },
        { label: 'Ticket médio', value: fmtBRL(data.kpis.ticketMedio), delta: data.kpis.variacao.ticketMedio },
        { label: 'Clientes novos', value: `${data.kpis.novosPct}%`, delta: data.kpis.variacao.novosPctPp, deltaUnit: 'pp' },
      ]
    : []

  const temDados = (data?.series ?? []).some((p) => p.faturamento > 0 || p.agendamentos > 0)

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
        <PeriodFilter onChange={setPeriod} />
        <CategorySelect value={categoryId} onChange={setCategoryId} />
      </div>

      <ReportKpis cards={kpis} isLoading={isLoading} />

      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Evolução no tempo</h2>
          <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
              <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <Skeleton className="h-56 w-full rounded-xl sm:h-72" />
        ) : data?.series == null ? (
          <LockedFeatureCard
            title="Evolução no tempo é um relatório avançado"
            description="Acompanhe a tendência de faturamento e agendamentos do seu negócio com um plano superior."
          />
        ) : !temDados ? (
          <p className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Nenhum agendamento neste período.
          </p>
        ) : (
          <RevenueLineChart series={data.series} granularity={data.granularity} metric={metric} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Substituir `page.tsx` e atualizar sidebar**

`src/app/(app)/relatorios/page.tsx`:
```tsx
import { VisaoGeralClient } from './visao-geral-client'

export default function RelatoriosPage() {
  return <VisaoGeralClient />
}
```

`reports-sidebar.tsx` — novo array e lógica de ativo (match exato para a raiz):
```tsx
import { BarChart2, Calendar, LineChart, Users } from 'lucide-react'

const REPORT_ITEMS = [
  { label: 'Visão Geral', href: '/relatorios', icon: LineChart },
  { label: 'Financeiro', href: '/relatorios/financeiro', icon: BarChart2 },
  { label: 'Agendamentos', href: '/relatorios/agendamentos', icon: Calendar },
  { label: 'Clientes', href: '/relatorios/clientes', icon: Users },
] as const

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/relatorios') return pathname === '/relatorios'
  return pathname === href || pathname.startsWith(href + '/')
}
```
Usar `isItemActive` tanto no `activeHref` do Select mobile quanto no `isActive` do desktop.

- [ ] **Step 6: Verificação manual**

Run: `npx tsc --noEmit` → zero erros. `npm run dev` e abrir `/relatorios`:
- KPIs em 2 colunas no mobile (DevTools 360px), 4 no desktop.
- Toggle Faturamento|Agendamentos troca a linha.
- Com tenant sem `reports_advanced`: card de upsell no lugar do gráfico, KPIs visíveis.
- Trocar preset para "Este ano": granularidade mensal no eixo X.

- [ ] **Step 7: Commitar**

```bash
git add "src/app/(app)/relatorios/" src/components/domain/reports/ src/hooks/reports/use-overview-report.ts
git commit -m "feat(reports): página Visão Geral com KPIs comparados e evolução no tempo"
```

---

### Task 13: Financeiro — donut de participação, ticket médio e categoria

**Files:**
- Create: `src/components/domain/reports/charts/service-mix-donut.tsx`
- Modify: `src/app/(app)/relatorios/financeiro/financeiro-client.tsx`

**Interfaces:**
- Consumes: `FinancialReportRow` com `groupId`/`ticketMedio` e `kpis.variacao` (Task 3); `stableColor`/`OTHERS_COLOR` (Task 11); `CategorySelect` (Task 12).
- Produces: `<ServiceMixDonut rows={FinancialReportRow[]} />`.

- [ ] **Step 1: `charts/service-mix-donut.tsx`**

```tsx
'use client'

import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { stableColor, OTHERS_COLOR } from './palette'
import type { FinancialReportRow } from '@/domains/reports/types'

const MAX_FATIAS = 5

type Slice = { nome: string; receita: number; pct: number; cor: string }

function toSlices(rows: FinancialReportRow[]): Slice[] {
  const total = rows.reduce((s, r) => s + r.receita, 0)
  if (total === 0) return []
  const top = rows.slice(0, MAX_FATIAS)
  const resto = rows.slice(MAX_FATIAS)
  const slices: Slice[] = top.map((r) => ({
    nome: r.label,
    receita: r.receita,
    pct: Math.round((r.receita / total) * 100),
    cor: stableColor(r.groupId),
  }))
  const restoReceita = resto.reduce((s, r) => s + r.receita, 0)
  if (restoReceita > 0) {
    slices.push({
      nome: 'Outros',
      receita: restoReceita,
      pct: Math.round((restoReceita / total) * 100),
      cor: OTHERS_COLOR,
    })
  }
  return slices
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ServiceMixDonut({ rows }: { rows: FinancialReportRow[] }) {
  const slices = toSlices(rows)
  if (slices.length === 0) {
    return (
      <p className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Nenhuma receita neste período.
      </p>
    )
  }

  const config = Object.fromEntries(
    slices.map((s) => [s.nome, { label: s.nome, color: s.cor }]),
  ) satisfies ChartConfig

  return (
    <div className="flex flex-col items-center gap-4">
      <ChartContainer config={config} className="aspect-square h-44 sm:h-52">
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent formatter={(value) => fmtBRL(Number(value))} />}
          />
          <Pie data={slices} dataKey="receita" nameKey="nome" innerRadius="60%" strokeWidth={2}>
            {slices.map((s) => (
              <Cell key={s.nome} fill={s.cor} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="w-full space-y-1.5">
        {slices.map((s) => (
          <li key={s.nome} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.cor }} />
            <span className="min-w-0 flex-1 truncate">{s.nome}</span>
            <span className="font-medium tabular-nums text-slate-900">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `financeiro-client.tsx`**

Mudanças pontuais (mantendo a estrutura existente):

1. Estado novo: `const [categoryId, setCategoryId] = useState<string>('all')`; passar `categoryId: categoryId === 'all' ? undefined : categoryId` ao `useFinancialReport`; renderizar `<CategorySelect value={categoryId} onChange={setCategoryId} />` junto dos outros selects.
2. Coluna nova em `COLUMNS`:
```ts
{ key: 'ticketMedio', header: 'Ticket médio', align: 'right', format: (v) => fmtBRL(Number(v)) },
```
3. KPIs com delta (despesa com cor invertida):
```ts
const kpis: KpiCard[] = data
  ? [
      { label: 'Receita', value: fmtBRL(data.kpis.receita), delta: data.kpis.variacao.receita },
      { label: 'Despesa', value: fmtBRL(data.kpis.despesa), delta: data.kpis.variacao.despesa, invertDeltaColor: true },
      ...(data.kpis.estornos > 0
        ? [{ label: 'Estornos', value: fmtBRL(data.kpis.estornos) }]
        : []),
      { label: 'Saldo', value: fmtBRL(data.kpis.saldo), delta: data.kpis.variacao.saldo },
      { label: 'Ticket médio', value: fmtBRL(data.kpis.ticketMedio), delta: data.kpis.variacao.ticketMedio },
    ]
  : []
```
4. CSV ganha a coluna `'Ticket médio (R$)': r.ticketMedio.toFixed(2)`.
5. Layout donut + tabela (substitui o `<ReportTable>` solto do final):
```tsx
<div className="grid gap-6 lg:grid-cols-3">
  <div className="rounded-2xl border border-slate-100 bg-white p-5 lg:col-span-1">
    <h2 className="mb-4 text-sm font-semibold text-slate-900">
      Participação na receita
    </h2>
    {isLoading ? (
      <Skeleton className="mx-auto aspect-square h-44 rounded-full sm:h-52" />
    ) : (
      <ServiceMixDonut rows={data?.rows ?? []} />
    )}
  </div>
  <div className="lg:col-span-2">
    <ReportTable columns={COLUMNS} rows={data?.rows ?? []} isLoading={isLoading} />
  </div>
</div>
```
Imports novos: `ServiceMixDonut`, `CategorySelect`, `Skeleton`.

- [ ] **Step 3: Verificação manual**

Run: `npx tsc --noEmit` → zero erros. No dev server, `/relatorios/financeiro`:
- Donut acima da tabela no mobile (grid empilha), lado a lado no desktop.
- Donut com no máximo 5 fatias + "Outros" cinza; legenda nome + %.
- Mesma cor do serviço se aparecer também em outro gráfico (cor derivada do id).
- Filtro de categoria altera KPIs, donut e tabela.
- Setas de variação: despesa subindo fica vermelha (cor invertida).

- [ ] **Step 4: Commitar**

```bash
git add "src/app/(app)/relatorios/financeiro/" src/components/domain/reports/charts/service-mix-donut.tsx
git commit -m "feat(reports): financeiro com donut de participação, ticket médio por grupo e filtro de categoria"
```

---

### Task 14: Agendamentos — heatmap de sazonalidade (gated) e categoria

**Files:**
- Create: `src/hooks/reports/use-seasonality-report.ts`
- Create: `src/components/domain/reports/charts/seasonality-heatmap.tsx`
- Modify: `src/app/(app)/relatorios/agendamentos/agendamentos-client.tsx`

**Interfaces:**
- Consumes: `SeasonalityReport` (Task 7), `fetchReport`/`retryUnlessLocked`/`FeatureLockedError`/`LockedFeatureCard` (Task 11), `CategorySelect` (Task 12), `kpis.variacao` (Task 4).
- Produces: `useSeasonalityReport(params)`; `<SeasonalityHeatmap cells maxTotal />`.

- [ ] **Step 1: Hook `use-seasonality-report.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import type { SeasonalityReport } from '@/domains/reports/types'
import { fetchReport, retryUnlessLocked } from './report-fetcher'

export type SeasonalityParams = {
  from?: string
  to?: string
  professionalId?: string
  categoryId?: string
}

async function fetchSeasonality(params: SeasonalityParams): Promise<SeasonalityReport> {
  const url = new URL('/api/reports/seasonality', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.professionalId) url.searchParams.set('professionalId', params.professionalId)
  if (params.categoryId) url.searchParams.set('categoryId', params.categoryId)
  return fetchReport<SeasonalityReport>(url)
}

export function useSeasonalityReport(params: SeasonalityParams) {
  return useQuery({
    queryKey: ['reports', 'seasonality', params],
    queryFn: () => fetchSeasonality(params),
    staleTime: 60_000,
    retry: retryUnlessLocked,
  })
}
```

- [ ] **Step 2: `charts/seasonality-heatmap.tsx`**

```tsx
'use client'

import type { SeasonalityCell } from '@/domains/reports/types'

// Postgres EXTRACT(DOW): 0 = domingo. Exibimos Seg → Dom.
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0] as const
const NOME_DIA: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
}
const COR_BASE = '14, 165, 233' // sky-500 em RGB, intensidade via alpha

type Props = {
  cells: SeasonalityCell[]
  maxTotal: number
}

export function SeasonalityHeatmap({ cells, maxTotal }: Props) {
  if (cells.length === 0 || maxTotal === 0) {
    return (
      <p className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Nenhum agendamento neste período.
      </p>
    )
  }

  const horas = cells.map((c) => c.hora)
  const horaMin = Math.min(...horas)
  const horaMax = Math.max(...horas)
  const faixaHoras = Array.from({ length: horaMax - horaMin + 1 }, (_, i) => horaMin + i)
  const porChave = new Map(cells.map((c) => [`${c.dow}-${c.hora}`, c.total]))

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[3rem_repeat(7,minmax(3rem,1fr))] gap-1">
          <div />
          {ORDEM_DIAS.map((dow) => (
            <p key={dow} className="text-center text-xs font-medium text-slate-500">
              {NOME_DIA[dow]}
            </p>
          ))}
          {faixaHoras.map((hora) => (
            <div key={hora} className="contents">
              <p className="pr-2 text-right text-xs tabular-nums text-slate-400">{hora}h</p>
              {ORDEM_DIAS.map((dow) => {
                const total = porChave.get(`${dow}-${hora}`) ?? 0
                return (
                  <div
                    key={`${dow}-${hora}`}
                    title={`${NOME_DIA[dow]} ${hora}h — ${total} agendamento${total === 1 ? '' : 's'}`}
                    className="flex h-8 items-center justify-center rounded-md text-[11px] font-medium tabular-nums"
                    style={{
                      backgroundColor: `rgba(${COR_BASE}, ${total === 0 ? 0.04 : 0.15 + (total / maxTotal) * 0.75})`,
                      color: total / maxTotal > 0.55 ? '#fff' : '#334155',
                    }}
                  >
                    {total > 0 ? total : ''}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Integrar no `agendamentos-client.tsx`**

1. Estado `categoryId` + `<CategorySelect>` (igual à Task 13) e repasse ao `useAppointmentsReport`.
2. KPIs com delta:
```ts
{ label: 'Total', value: data.kpis.total, delta: data.kpis.variacao.total },
{ label: 'Concluídos', value: data.kpis.concluidos, delta: data.kpis.variacao.concluidos },
{ label: 'Cancelados', value: data.kpis.cancelados },
{ label: 'Taxa de conclusão', value: `${data.kpis.taxaConclusao}%`, delta: data.kpis.variacao.taxaConclusaoPp, deltaUnit: 'pp' },
```
3. Seção de sazonalidade antes da `<ReportTable>`:
```tsx
const seasonality = useSeasonalityReport({
  from: period.from,
  to: period.to,
  categoryId: categoryId === 'all' ? undefined : categoryId,
})
```
```tsx
<div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
  <h2 className="text-sm font-semibold text-slate-900">Sazonalidade — dia × horário</h2>
  {seasonality.isLoading ? (
    <Skeleton className="h-64 w-full rounded-xl" />
  ) : seasonality.error instanceof FeatureLockedError ? (
    <LockedFeatureCard
      title="Sazonalidade é um relatório avançado"
      description="Descubra horários de pico e ociosidade da sua agenda com um plano superior."
    />
  ) : seasonality.isError ? (
    <p className="text-sm text-rose-600">Erro ao carregar sazonalidade.</p>
  ) : (
    <SeasonalityHeatmap cells={seasonality.data?.cells ?? []} maxTotal={seasonality.data?.maxTotal ?? 0} />
  )}
</div>
```
Imports: `useSeasonalityReport`, `SeasonalityHeatmap`, `LockedFeatureCard`, `FeatureLockedError`, `CategorySelect`, `Skeleton`.

- [ ] **Step 4: Verificação manual**

Run: `npx tsc --noEmit` → zero erros. `/relatorios/agendamentos`:
- Heatmap Seg→Dom com intensidade proporcional; scroll horizontal no mobile (360px).
- Tenant sem `reports_advanced`: upsell no bloco, KPIs e tabela intactos.
- `title` da célula mostra o valor exato no hover/toque longo.

- [ ] **Step 5: Commitar**

```bash
git add "src/app/(app)/relatorios/agendamentos/" src/components/domain/reports/charts/seasonality-heatmap.tsx src/hooks/reports/use-seasonality-report.ts
git commit -m "feat(reports): heatmap de sazonalidade em agendamentos com variação de KPIs e categoria"
```

---

### Task 15: Clientes — abas Ranking | Inativos com paginação e WhatsApp

**Files:**
- Create: `src/hooks/reports/use-inactive-customers.ts`
- Rewrite: `src/app/(app)/relatorios/clientes/clientes-client.tsx`

**Interfaces:**
- Consumes: `CustomersReport` paginado (Task 5), `InactiveCustomersReport` (Task 8), `ReportPagination`/`LockedFeatureCard`/`FeatureLockedError` (Task 11), `Tabs` do Shadcn.

- [ ] **Step 1: Hook `use-inactive-customers.ts`**

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { InactiveCustomersReport } from '@/domains/reports/types'
import { fetchReport, retryUnlessLocked } from './report-fetcher'

export type InactiveCustomersParams = {
  days: number
  page: number
}

async function fetchInactive(params: InactiveCustomersParams): Promise<InactiveCustomersReport> {
  const url = new URL('/api/reports/customers/inactive', window.location.origin)
  url.searchParams.set('days', String(params.days))
  url.searchParams.set('page', String(params.page))
  return fetchReport<InactiveCustomersReport>(url)
}

export function useInactiveCustomers(params: InactiveCustomersParams) {
  return useQuery({
    queryKey: ['reports', 'customers-inactive', params],
    queryFn: () => fetchInactive(params),
    staleTime: 60_000,
    retry: retryUnlessLocked,
    placeholderData: keepPreviousData,
  })
}
```

- [ ] **Step 2: Reescrever `clientes-client.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { useCustomersReport } from '@/hooks/reports/use-customers-report'
import { useInactiveCustomers } from '@/hooks/reports/use-inactive-customers'
import { FeatureLockedError } from '@/hooks/reports/report-fetcher'
import { PeriodFilter, type PeriodValue } from '@/components/domain/reports/period-filter'
import { ReportKpis, type KpiCard } from '@/components/domain/reports/report-kpis'
import { ReportTable, type ReportColumn } from '@/components/domain/reports/report-table'
import { ReportPagination } from '@/components/domain/reports/report-pagination'
import { LockedFeatureCard } from '@/components/domain/reports/locked-feature-card'
import { ExportCsvButton } from '@/components/domain/reports/export-csv-button'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

// Link wa.me: só dígitos; prefixa DDI 55 quando o telefone veio sem código do país.
function whatsappHref(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '')
  return `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`
}

const RANKING_COLUMNS: ReportColumn[] = [
  { key: 'clienteNome', header: 'Cliente' },
  { key: 'atendimentos', header: 'Atendimentos', align: 'right' },
  { key: 'receita', header: 'Receita', align: 'right', format: (v) => fmtBRL(Number(v)) },
  { key: 'ticketMedio', header: 'Ticket médio', align: 'right', format: (v) => fmtBRL(Number(v)) },
  { key: 'ultimoAtendimento', header: 'Último atendimento', align: 'right', format: (v) => fmtDate(String(v)) },
]

const SORT_LABELS = {
  receita: 'Maior faturamento',
  atendimentos: 'Mais frequentes',
  ticketMedio: 'Maior ticket médio',
} as const

type SortBy = keyof typeof SORT_LABELS

const DIAS_INATIVIDADE = [30, 60, 90, 180] as const

export function ClientesClient() {
  const { can } = usePermissions()
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod)
  const [sortBy, setSortBy] = useState<SortBy>('receita')
  const [page, setPage] = useState(1)
  const [dias, setDias] = useState<number>(90)
  const [pageInativos, setPageInativos] = useState(1)

  const ranking = useCustomersReport({
    from: period.from,
    to: period.to,
    sortBy,
    page,
  })
  const inativos = useInactiveCustomers({ days: dias, page: pageInativos })

  if (!can('relatorios', 'view')) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Sem permissão para visualizar clientes.</p>
      </div>
    )
  }

  const kpis: KpiCard[] = ranking.data
    ? [
        { label: 'Clientes ativos', value: ranking.data.kpis.totalAtivos, delta: ranking.data.kpis.variacao.totalAtivos },
        { label: 'Novos no período', value: ranking.data.kpis.novosNoPeriodo, delta: ranking.data.kpis.variacao.novosNoPeriodo },
        { label: 'Retorno (2+ visitas)', value: ranking.data.kpis.retorno, delta: ranking.data.kpis.variacao.retorno },
      ]
    : []

  const rankingCsv = (ranking.data?.rows ?? []).map((r) => ({
    Cliente: r.clienteNome,
    Atendimentos: r.atendimentos,
    'Receita (R$)': r.receita.toFixed(2),
    'Ticket médio (R$)': r.ticketMedio.toFixed(2),
    'Último atendimento': fmtDate(r.ultimoAtendimento),
  }))

  const inativosCsv = (inativos.data?.rows ?? []).map((r) => ({
    Cliente: r.nome,
    Telefone: r.telefone ?? '',
    'Último atendimento': fmtDate(r.ultimoAtendimento),
    'Dias inativo': r.diasInativo,
    'Valor histórico (R$)': r.valorHistorico.toFixed(2),
  }))

  const inativosBloqueado = inativos.error instanceof FeatureLockedError

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ranking">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="inativos">Inativos</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4 space-y-6">
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
            <PeriodFilter onChange={(v) => { setPeriod(v); setPage(1) }} />
            <div className="flex flex-wrap items-center gap-3">
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortBy); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto">
                <ExportCsvButton rows={rankingCsv} filename="relatorio-clientes.csv" isLoading={ranking.isLoading} />
              </div>
            </div>
          </div>

          {ranking.isError ? (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
              Erro ao carregar relatório. Tente recarregar a página.
            </p>
          ) : (
            <>
              <ReportKpis cards={kpis} isLoading={ranking.isLoading} />
              <ReportTable
                columns={RANKING_COLUMNS}
                rows={ranking.data?.rows ?? []}
                isLoading={ranking.isLoading}
                emptyMessage="Nenhum atendimento neste período."
              />
              <ReportPagination
                page={ranking.data?.page ?? page}
                pageSize={ranking.data?.pageSize ?? 20}
                total={ranking.data?.total ?? 0}
                onPageChange={setPage}
                isLoading={ranking.isFetching}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="inativos" className="mt-4 space-y-6">
          {inativosBloqueado ? (
            <LockedFeatureCard
              title="Clientes inativos é um relatório avançado"
              description="Encontre quem parou de agendar — priorizado por quanto já gastou — e traga de volta pelo WhatsApp com um plano superior."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5">
                <Select
                  value={String(dias)}
                  onValueChange={(v) => { setDias(Number(v)); setPageInativos(1) }}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Sem agendar há" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_INATIVIDADE.map((d) => (
                      <SelectItem key={d} value={String(d)}>Sem agendar há {d}+ dias</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto">
                  <ExportCsvButton rows={inativosCsv} filename="clientes-inativos.csv" isLoading={inativos.isLoading} />
                </div>
              </div>

              {inativos.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                  ))}
                </div>
              ) : inativos.isError ? (
                <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
                  Erro ao carregar clientes inativos.
                </p>
              ) : (inativos.data?.rows.length ?? 0) === 0 ? (
                <p className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Nenhum cliente inativo há {dias}+ dias. 🎉
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Último atendimento</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Dias inativo</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Valor histórico</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Contato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {inativos.data?.rows.map((r) => (
                          <tr key={r.clienteId} className="bg-white transition hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-700">{r.nome}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtDate(r.ultimoAtendimento)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.diasInativo}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtBRL(r.valorHistorico)}</td>
                            <td className="px-4 py-3 text-right">
                              {r.telefone ? (
                                <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5 text-emerald-700 hover:text-emerald-800">
                                  <a href={whatsappHref(r.telefone)} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="size-4" />
                                    <span className="hidden sm:inline">WhatsApp</span>
                                  </a>
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400">sem telefone</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ReportPagination
                    page={inativos.data?.page ?? pageInativos}
                    pageSize={inativos.data?.pageSize ?? 20}
                    total={inativos.data?.total ?? 0}
                    onPageChange={setPageInativos}
                    isLoading={inativos.isFetching}
                  />
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

Observações:
- O verde do botão WhatsApp é cor de marca do canal (como na vitrine), não indicador de variação — permitido.
- CSV exporta a página carregada (paginação server-side); exportação completa fica para a Fase 2 com PDF/Excel.
- Se existir helper de link WhatsApp no projeto (buscar `wa.me` em `src/`), reutilizar em vez de `whatsappHref` local.

- [ ] **Step 3: Verificação manual**

Run: `npx tsc --noEmit` → zero erros. `/relatorios/clientes`:
- Abas full-width no mobile; Ranking ordena pelos 3 critérios (resetando página).
- Paginação "21–40 de N" funcional nas duas abas.
- Tenant sem `reports_advanced`: aba Inativos mostra só o upsell.
- Botão WhatsApp abre `wa.me` com o número correto.

- [ ] **Step 4: Commitar**

```bash
git add "src/app/(app)/relatorios/clientes/" src/hooks/reports/use-inactive-customers.ts
git commit -m "feat(reports): clientes com abas ranking/inativos, paginação, ordenação e ação de WhatsApp"
```

---

### Task 16: Verificação final, documentação e PR

**Files:**
- Modify: `CLAUDE.md` (linha de status do domínio Reports)
- Modify: `AGENTS.md`, `.claude/AGENTS.md`, `CODEX.md` (se citarem os 4 relatórios antigos)

- [ ] **Step 1: Gate de build e testes completos**

Run: `npx tsc --noEmit` → zero erros.
Run: `npx vitest run` → todos os testes passando (atenção: rodar na raiz do repo; worktrees obsoletos podem poluir a varredura — se acontecer, restringir a `npx vitest run src/`).
Run: `grep -rn "console.log" src/domains/reports src/app/api/reports src/components/domain/reports` → sem resultados.

- [ ] **Step 2: Checklist mobile (agent-mobile)**

Verificar em 360px (DevTools) as 4 páginas: sem scroll horizontal da página (só o interno do heatmap/tabelas), alvos de toque ≥ 44px nos botões de paginação/abas/pills, textos legíveis, KPIs em 2 colunas, gráficos com altura contida, tooltips acessíveis por toque.

- [ ] **Step 3: Revisão de segurança**

Conferir: `tenantId` do token em todas as rotas novas (`overview`, `seasonality`, `customers/inactive`); os 3 `$queryRaw` novos usam APENAS template literal com binds (nunca interpolação de string); `assertAccess` nas rotas gated; `ensurePermission` em todas.

- [ ] **Step 4: Atualizar documentação**

`CLAUDE.md` — linha "Reports" da tabela de status, substituir por:
```
| Reports | ✅ | ✅ | 4 páginas com papéis únicos (Visão Geral/tendência + evolução no tempo, Financeiro/composição + donut, Agendamentos/operação + heatmap sazonalidade, Clientes/pessoas + ranking paginado e inativos com WhatsApp); variação % vs período anterior nos KPIs; filtros ano/categoria; página Profissionais removida (unificada no Financeiro/Agendamentos); evolução/sazonalidade/inativos gated `reports_advanced`; agregações no PostgreSQL (`analytics.service.ts`) |
```
Atualizar também `AGENTS.md`/`CODEX.md` se referenciarem os relatórios (preferência registrada do usuário).

- [ ] **Step 5: Commitar e abrir PR**

```bash
git branch --show-current   # deve ser feat/relatorios-fase1
git add CLAUDE.md AGENTS.md CODEX.md .claude/AGENTS.md
git commit -m "docs: atualiza status do domínio Reports após Fase 1"
git push -u origin feat/relatorios-fase1
gh pr create --title "feat(reports): Fase 1 — visão de performance do negócio" --body "..."
```

Corpo do PR: resumo das 4 páginas, gating, remoção de Profissionais, prints mobile/desktop se possível, link para a spec `docs/superpowers/specs/2026-07-03-relatorios-fase1-design.md` e rodapé padrão do projeto. Aguardar aprovação do usuário para o merge (entrega só é considerada concluída com PR mergeada na `main`).

---

## Self-review do plano (executado na escrita)

- **Cobertura da spec:** período ampliado (T1), variação % (T2–T5/T6), categoria (T3/T4/T6/T7), ranking paginado/ordenável (T5), Visão Geral + evolução (T6/T12), sazonalidade (T7/T14), inativos + WhatsApp (T8/T15), remoção de Profissionais (T9), mockup antes do código (T10), Recharts/paleta/cores (T11/T13), donut + ticket médio (T13), heatmap (T14), abas + paginação (T15), testes/gates/docs/PR (T16). Sem lacunas identificadas.
- **Consistência de tipos:** `KpiDelta`/`variacao` definidos na T2/T3 e consumidos nas T12–T15 com os mesmos nomes; `CUSTOMERS_PAGE_SIZE` compartilhado entre T5 e T8; `groupId` produzido na T3 e consumido na T13.
- **Riscos sinalizados no próprio plano:** API do `chart.tsx` do shadcn pode variar (T12 Step 2), assinatura de `useServiceCategories` (T12 Step 3), helper de WhatsApp existente (T15).
