# Spec: Relatórios Avançados

**Data:** 2026-05-26
**Status:** Aprovado
**Branch alvo:** `feat/relatorios-avancados`

---

## Visão geral

Nova seção **Relatórios** no menu lateral do produto, com 4 tipos de relatório, filtros por período e filtros específicos por tipo, visualização em KPIs + tabela de detalhamento, e exportação CSV client-side.

---

## Decisões de design

| Dimensão | Decisão |
|---|---|
| Localização | Nova entrada "Relatórios" na sidebar — rota `/relatorios` |
| Tipos | Financeiro · Agendamentos · Clientes · Por Profissional |
| Navegação interna | Menu lateral dentro de `/relatorios` (layout compartilhado) |
| Filtro de período | Pills de atalho + date picker para intervalo personalizado |
| Visualização | KPIs no topo + tabela de detalhamento |
| Exportação | CSV client-side via Blob (sem endpoint de export) |
| Arquitetura backend | Abordagem A: 4 endpoints dedicados em `/api/reports/*` |

---

## Filtros de período (compartilhado entre todos os relatórios)

Pills de atalho sempre visíveis:
- **Hoje** — `startOfDay(today)` até `endOfDay(today)`
- **Esta semana** — segunda-feira até domingo da semana corrente
- **Este mês** — dia 1 até hoje do mês corrente (default ao abrir)
- **Mês passado** — mês calendário anterior completo
- **Personalizado** — revela dois date pickers De/Até inline

`from` e `to` são propagados via `searchParams` para todas as páginas filhas.

---

## Filtros adicionais por relatório

### 💰 Financeiro
- **Tipo:** Receita / Despesa / Todos (default)
- **Profissional:** select com lista do tenant
- **Serviço:** select com lista do tenant
- **Agrupamento da tabela:** Por profissional | Por serviço (toggle, default: por serviço)

### 📅 Agendamentos
- **Status:** multi-select com rótulos amigáveis:
  - `SCHEDULED` → Agendado
  - `COMPLETED` → Concluído
  - `CANCELLED` → Cancelado
  - `NO_SHOW` → Não compareceu
- **Profissional:** select com lista do tenant
- **Serviço:** select com lista do tenant

### 👥 Clientes
- **Profissional:** select — filtra clientes que tiveram agendamentos com esse profissional no período
- **Serviço:** select — filtra clientes que realizaram esse serviço no período

### ✂️ Por Profissional
- **Profissional:** multi-select com lista do tenant
- **Serviço:** select com lista do tenant
- **Status do agendamento:** multi-select (mesmos rótulos amigáveis)

---

## Contratos de API

Todos os endpoints:
- Requerem sessão autenticada (`getSessionContext`)
- Extraem `tenantId` do token — nunca do body
- Validam `from` e `to` com Zod (`.datetime().optional()`) — default: início e fim do mês corrente
- Retornam `{ kpis, rows }`

### `GET /api/reports/financial`

Query params: `from`, `to`, `type` (`INCOME | EXPENSE`), `professionalId`, `serviceId`, `groupBy` (`profissional | servico`)

```typescript
{
  kpis: {
    receita: number       // soma de INCOME no período
    despesa: number       // soma de EXPENSE no período
    saldo: number         // receita - despesa
    ticketMedio: number   // receita / total de agendamentos concluídos
  },
  rows: {
    label: string         // nome do profissional ou serviço
    quantidade: number    // contagem de transações
    receita: number       // soma de amount
  }[]
}
```

**Permissão:** `financial:view`

### `GET /api/reports/appointments`

Query params: `from`, `to`, `status[]`, `professionalId`, `serviceId`, `groupBy` (`profissional | servico`, default: `profissional`)

```typescript
{
  kpis: {
    total: number
    concluidos: number
    cancelados: number
    naoCompareceu: number
    taxaConclusao: number  // concluidos / total * 100
  },
  rows: {
    label: string          // nome do profissional ou serviço conforme groupBy
    total: number
    concluidos: number
    cancelados: number
    naoCompareceu: number
  }[]
}
```

**Permissão:** `scheduling:view`

### `GET /api/reports/customers`

Query params: `from`, `to`, `professionalId`, `serviceId`

```typescript
{
  kpis: {
    totalAtivos: number         // clientes com ao menos 1 agendamento no período
    novosNoPeriodo: number      // clientes cujo primeiro agendamento foi no período
    retorno: number             // clientes com 2+ agendamentos no período
  },
  rows: {
    clienteNome: string
    atendimentos: number
    receita: number
    ultimoAtendimento: string   // ISO date
  }[]
}
```

**Permissão:** `crm:view`

### `GET /api/reports/professionals`

Query params: `from`, `to`, `professionalIds[]`, `serviceId`, `status[]`

```typescript
{
  kpis: {
    totalAtendimentos: number
    receitaTotal: number
  },
  rows: {
    profissionalNome: string
    atendimentos: number
    receita: number
    ticketMedio: number
  }[]
}
```

**Permissão:** `scheduling:view`

---

## Arquitetura backend

```
src/domains/reports/
├── reports.service.ts   # orquestra queries Prisma (groupBy / aggregate)
└── types.ts             # schemas Zod de input e tipos de output

src/app/api/reports/
├── financial/route.ts
├── appointments/route.ts
├── customers/route.ts
└── professionals/route.ts
```

`ReportsService` usa `prisma` diretamente (sem repository intermediário) — as queries são analíticas (`groupBy`, `aggregate`, `_count`) e não se encaixam no padrão CRUD dos repositories existentes.

Erros usam `handleApiError` do `src/shared/errors/` — nenhum `throw new Error('string')`.

---

## Arquitetura frontend

```
src/app/(app)/relatorios/
├── layout.tsx               # ReportsSidebar + PeriodFilter + lê searchParams
├── page.tsx                 # redirect → /relatorios/financeiro
├── financeiro/page.tsx
├── agendamentos/page.tsx
├── clientes/page.tsx
└── profissionais/page.tsx

src/components/domain/reports/
├── reports-sidebar.tsx      # 4 itens de navegação lateral
├── period-filter.tsx        # pills + date picker personalizado
├── report-filters.tsx       # filtros específicos por tipo (composable)
├── report-kpis.tsx          # grid de cards KPI (reutilizável)
├── report-table.tsx         # tabela genérica com colunas configuráveis
└── export-csv-button.tsx    # Blob + URL.createObjectURL + download

src/lib/csv.ts               # exportCsv(rows, filename) — utilitário puro
```

Cada `page.tsx` de relatório:
1. Lê `searchParams` (`from`, `to`, filtros específicos)
2. Passa para hook TanStack Query com `queryKey` incluindo todos os filtros
3. Renderiza `<ReportKpis>` + `<ReportFilters>` + `<ReportTable>` + `<ExportCsvButton>`
4. Estados de loading e error obrigatórios em todos os componentes

Nenhuma lógica de negócio nos componentes — apenas renderização e chamada de API.

---

## Exportação CSV

`src/lib/csv.ts` expõe função pura:

```typescript
export function exportCsv(rows: Record<string, unknown>[], filename: string): void
```

- Gera cabeçalho a partir das chaves do primeiro objeto
- Escapa vírgulas e aspas nos valores
- Cria `Blob` com `text/csv;charset=utf-8`
- Dispara download via `URL.createObjectURL` + `<a>.click()`
- `<ExportCsvButton>` recebe `rows` e `filename` — desabilitado enquanto `isLoading`

---

## Navegação / sidebar

Adicionar entrada "Relatórios" no array `NAV_ITEMS` de `src/components/app/app-shell.tsx`, com ícone `BarChart2` do Lucide, logo abaixo de "Financeiro". Permissão no item: `null` — a verificação granular é feita dentro de cada página conforme o tipo de relatório.

Permissão de acesso à seção: usuário precisa de ao menos uma das permissões `financial:view`, `scheduling:view` ou `crm:view`.

---

## O que está fora do escopo deste MVP

- Gráficos (barras, linhas) — ficam para iteração futura
- Exportação PDF
- Relatórios agendados por e-mail
- Comparação entre períodos (ex: este mês vs mês passado)
- Salvar filtros favoritos
