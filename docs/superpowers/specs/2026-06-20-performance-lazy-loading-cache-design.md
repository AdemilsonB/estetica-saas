# Performance — Lazy Loading e Cache

**Issue:** #121
**Data:** 2026-06-20
**Autor:** Claude Code (Ademilson Bertolin)
**Status:** Aprovado para implementação

---

## Objetivo

Reduzir o tempo de carregamento das páginas mais pesadas do dashboard aplicando Server Components com Suspense, padronizando `staleTime` do TanStack Query por domínio, corrigindo o bug de contagem de registros na paginação e auditando queries Prisma para eliminar campos desnecessários.

## Critérios de aceite

- Páginas de relatórios carregam HTML inicial sem aguardar JS do cliente
- Contagem de registros no `CustomerList` exibe o total real (ex: "247 clientes encontrados"), não o total da página (ex: "10 clientes encontrados")
- Hooks de dados estáticos (roles, membros, serviços) usam `staleTime: 5 min` com invalidação após mutations
- Dashboard usa `staleTime: 30s` (consistente com o polling declarado na UI)
- `npx tsc --noEmit` e `npx vitest run` passam sem erros

---

## Contexto — Estado atual

### O que já estava correto (não muda)
- `AppointmentRepository.findAll` já usa `include: { customer, professional, service }` — sem N+1
- `TransactionRepository.list` já usa `include: { appointment }` — sem N+1
- `IamRepository.findAllUsers` usa `select` aninhado em query única — sem N+1
- `CustomerList` e `TransactionList` já têm paginação funcional no backend (`prisma.customer.count`, `prisma.transaction.count`)
- `dashboard/page.tsx` já é Server Component
- A maioria dos hooks de tempo real já tem `staleTime: 30s`

### O que precisa de trabalho
1. **Bug de contagem:** `customer-list.tsx:119` exibe `data.data.length` (itens da página) em vez de `data.total` (total real)
2. **Client Components desnecessários:** 4 páginas de relatórios + `servicos` + `produtos` têm `'use client'` no `page.tsx` sem necessidade — o estado poderia viver num componente filho
3. **Suspense ausente:** páginas Server Component não têm `<Suspense>` — o cliente espera o JS inteiro antes de mostrar conteúdo
4. **staleTime inconsistente:** `use-roles` (30s), `use-team` members (60s) e services (30s) deveriam ser 5 min; `use-dashboard-metrics` (20s) deveria ser 30s

---

## Arquitetura

### Padrão de extração para Server Components

```
app/(app)/relatorios/financeiro/
  ├── page.tsx                     ← Server Component: metadata + <Suspense>
  └── financeiro-client.tsx        ← 'use client': todo o estado e lógica atual
```

O `page.tsx` vira:
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

O `financeiro-client.tsx` recebe o conteúdo atual do `page.tsx` intacto (sem refatorar lógica).

### Hierarquia de staleTime

```
Tempo real (agenda do dia, dashboard):      staleTime: 30_000          (30s)
Transações e relatórios:                    staleTime: 60_000          (60s)
Dados operacionais (clientes, estoque):     staleTime: 30_000          (30s)
Billing e planos:                           staleTime: 2 * 60 * 1000   (2 min)
Dados estáticos (roles, membros, serviços): staleTime: 5 * 60 * 1000   (5 min)
```

---

## Frente 1 — Bug: contagem de registros

### Arquivo
- `src/components/domain/crm/customer-list.tsx` linha 119

### Problema
```tsx
// Atual — exibe só os da página (ex: 10)
{data.data.length} cliente{data.data.length !== 1 ? 's' : ''} encontrado{...}

// Correto — exibe o total real (ex: 247)
{data.total} cliente{data.total !== 1 ? 's' : ''} encontrado{data.total !== 1 ? 's' : ''}
```

O backend já retorna `data.total` via `prisma.customer.count({ where })`. Só o display estava errado.

---

## Frente 2 — Server Components + Suspense

### Páginas a extrair

| Página (app) | Arquivo atual | Novo arquivo client |
|---|---|---|
| `/relatorios/financeiro` | page.tsx com 'use client' | `financeiro-client.tsx` |
| `/relatorios/agendamentos` | page.tsx com 'use client' | `agendamentos-client.tsx` |
| `/relatorios/clientes` | page.tsx com 'use client' | `clientes-client.tsx` |
| `/relatorios/profissionais` | page.tsx com 'use client' | `profissionais-client.tsx` |
| `/servicos` | page.tsx com 'use client' (Tabs) | `servicos-client.tsx` |
| `/produtos` | page.tsx com 'use client' | `produtos-client.tsx` |

### Skeleton de relatório (componente compartilhado)

Criar `src/components/domain/reports/report-skeleton.tsx` — um skeleton genérico com barra de filtros + tabela fictícia, usado como fallback em todas as páginas de relatório.

### Páginas que ficam como Client Component (correto)

- `/agenda/page.tsx` — tem `useState(selectedDate)` que controla qual dia carregar; converter seria contra-producente
- `/equipe/page.tsx` — muita interatividade (modais, convites, exclusão)
- `/financeiro/transacoes/page.tsx` — filtros complexos com múltiplos `useState`

Para essas páginas, a melhoria de UX vem do `staleTime` mais longo (frente 3), que reduz os refetches desnecessários.

---

## Frente 3 — staleTime por domínio

### Hooks a corrigir

| Hook | staleTime atual | staleTime correto | Motivo |
|---|---|---|---|
| `use-roles` | 30s | 5 min | Dado estático — roles mudam raramente |
| `use-team` (members) | 60s | 5 min | Dado estático — equipe muda raramente |
| `use-team` (member services) | 30s | 5 min | Dado estático |
| `use-team` (invites) | 60s | 5 min | Dado estático |
| `use-dashboard-metrics` | 20s | 30s | Consistente com polling declarado na UI |
| `use-member-services` | 30s | 5 min | Dado estático |

### Hooks já corretos (não mudam)

| Hook | staleTime atual | Categoria |
|---|---|---|
| `use-billing-status` | 5 min | Billing ✅ |
| `use-plans` (billing) | 10 min | Billing ✅ |
| `use-service-categories` | 5 min | Estático ✅ |
| `use-packages` | 5 min | Estático ✅ |
| `use-promotions` | 5 min | Estático ✅ |
| `use-appointments` | 30s | Tempo real ✅ |
| `use-transactions` | 30s | Operacional ✅ |
| `use-customers` | 30s | Operacional ✅ |
| `use-nav-sections` | 5 min | Estático ✅ |

### Invalidação após mutations

Para os hooks migrados para 5 min, verificar que todas as mutations correspondentes já chamam `queryClient.invalidateQueries`. Se não chamam, adicionar.

Hooks a auditar:
- Mutations em `use-roles` → deve invalidar `['roles']`
- Mutations em `use-team` → deve invalidar `['team', 'members']` e `['team', 'invites']`
- Mutations em `use-member-services` → deve invalidar `['member-services', memberId]`

---

## Frente 4 — Auditoria N+1 e select excessivo

### Situação atual (todos já corretos)
- `AppointmentRepository` — `include: { customer, professional, service }` ✅
- `TransactionRepository` — `include: { appointment }` ✅
- `IamRepository.findAllUsers` — `select` aninhado com campos explícitos ✅
- `ReportsService` — usa `include` com `select` mínimo ✅

### Auditoria de select excessivo

Dois repositories usam `include` sem `select`, trazendo mais campos do que o necessário:

- `AppointmentRepository.findAll`: inclui `customer` inteiro. A `AgendaDayView` usa `customer.name`, `customer.phone`, `customer.notes`. Adicionar `select: { id, name, phone, notes }` no include de `customer` para não trazer `birthDate`, `cpf`, `address`, etc.
- `TransactionRepository.list`: inclui `appointment` inteiro. O `TransactionList` usa `appointment.startsAt` e `appointment.serviceId` (para exibição). Adicionar `select` mínimo no include de `appointment`.

### NotificationLog

Verificar `src/domains/notifications/notification.repository.ts` — se não tem paginação, adicionar com pageSize padrão de 20, seguindo o mesmo padrão de `{ data, total, page, pageSize }`.

---

## Erros e edge cases

- **Suspense em ambiente de teste:** os componentes client extraídos são puros Client Components, não precisam de Suspense em testes unitários
- **staleTime em mutations:** se uma mutation falha, o cache não é invalidado — comportamento esperado, sem mudança
- **Skeleton de relatório:** deve ter a mesma estrutura visual dos relatórios reais (barra de filtros + KPIs + tabela) para evitar layout shift

---

## Testes

- `npx tsc --noEmit` após cada extração de página para garantir que os tipos passam para o componente client
- `npx vitest run` para confirmar que nenhum teste de hook ou service quebra com as mudanças de staleTime
- Verificar manualmente no browser: `/clientes` com 20+ clientes deve mostrar "247 clientes encontrados" na primeira página

---

## Fora de escopo

- Virtualização de listas longas (ex: `react-virtual`) — paginação já resolve o caso de uso atual
- `next/dynamic` para code splitting adicional — App Router já faz route-level splitting
- Cache em memória com Redis — backend não tem gargalo identificado que justifique
- Automation domain — Fase 2 do roadmap, não relacionado
