# Design: Correções do Módulo Financeiro

**Data:** 2026-06-06  
**Escopo:** Correção de estornos, badges de despesa, filtros de transações, summary API e relatório financeiro  
**Abordagem escolhida:** B — Separar estornos por categoria + filtros completos (sem migration de schema)

---

## Problema

Três inconsistências identificadas no módulo financeiro:

1. **Estorno com duplo negativo** — `stock.appointment_restore` cria Transaction com `type=EXPENSE, amount=-30`. O card renderiza prefixo `-R$` (hardcoded para EXPENSE) sobre o valor `-30,00`, resultando em `-R$-30,00`. A matemática do summary está correta, só o display está quebrado.

2. **Despesas sem contexto visual** — Os cards de transação não diferenciam "Compra de Estoque" de "Cortesia" de "Despesa Fixa". Falta badge de categoria/tipo.

3. **Ausência de filtros nas telas de transações** — A lista de transações do dashboard `/financeiro` e o histórico `/financeiro/transacoes` não permitem filtrar por período, tipo, categoria ou profissional.

---

## Decisões de design

### Estorno exibido como crédito verde (+R$30)
O estorno de insumo representa recuperação de custo — não é receita nem despesa nova. Exibido com ícone âmbar (`RotateCcw`), prefixo `+` e cor âmbar, distinguindo-se visualmente de receita (verde) e despesa (vermelho).

### Sem migration de schema
A distinção entre "crédito de custo" e "despesa real" é feita pela `category` da Transaction. Não há novo `TransactionType`. Compatibilidade retroativa com registros antigos (amount negativo + EXPENSE) garantida por detecção no display.

### Categorias canônicas como constantes
Um arquivo `src/domains/financial/categories.ts` centraliza os valores de category usados por subscriptions, display, filtros e cálculos.

---

## Arquitetura

### 1. Arquivo de categorias canônicas

**Arquivo:** `src/domains/financial/categories.ts` *(novo)*

```typescript
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

---

### 2. Correção em subscriptions.ts

**Arquivo:** `src/domains/financial/subscriptions.ts`

Evento `stock.appointment_restore` alterado:

```typescript
// ANTES
type: TransactionType.EXPENSE,
category: 'Insumo de Atendimento',
amount: new Prisma.Decimal(-payload.totalCost),  // negativo

// DEPOIS
type: TransactionType.EXPENSE,
category: FINANCIAL_CATEGORIES.SUPPLY_REVERSAL,  // 'Estorno de Insumo'
amount: new Prisma.Decimal(payload.totalCost),   // positivo
```

Todos os demais eventos (`stock.appointment_use`, `stock.purchased`, etc.) migram para usar as constantes de `FINANCIAL_CATEGORIES` em vez de strings literais.

---

### 3. Correção do transaction-card

**Arquivo:** `src/components/domain/financial/transaction-card.tsx`

Lógica de renderização:

```typescript
const isIncome = transaction.type === 'INCOME'
const amount = Number(transaction.amount)
const isReversalEntry = isReversal(transaction.category, amount)
const isCredit = isIncome || isReversalEntry
const displayAmount = Math.abs(amount)

// Ícone: ArrowUpCircle (receita) | RotateCcw (estorno) | ArrowDownCircle (despesa)
// Cor: emerald (receita) | amber (estorno) | red (despesa)
// Prefixo: "+" (receita/estorno) | "−" (despesa)
```

Badge de categoria exibido abaixo da descrição:

| Category | Badge label | Cor |
|---|---|---|
| Serviço | Serviço | slate |
| Venda de Produto | Venda | slate |
| Compra de Estoque | Compra | gray |
| Insumo de Atendimento | Insumo | purple |
| Despesa Variável | Variável | orange |
| Despesa Fixa | Fixo | blue |
| Cortesia | Cortesia | amber |
| Estorno de Insumo | Estorno | amber |

---

### 4. Filtros de transações

**Arquivos afetados:**
- `src/components/domain/financial/transaction-list.tsx` — recebe filtros como props
- `src/app/(app)/financeiro/page.tsx` — estado local de filtros para transações do dia
- `src/app/(app)/financeiro/transacoes/page.tsx` — filtros enviados como query params

**Filtros disponíveis:**

| Filtro | Tipo | Comportamento |
|---|---|---|
| Período | Select (hoje / semana / mês / personalizado) | Query param `from`/`to` na API |
| Tipo | Select (Todos / Receita / Despesa / Estorno) | Query param `type` na API |
| Categoria | Select (categorias canônicas) | Query param `category` na API |
| Profissional | Select (dropdown) | Query param `professionalId` na API |

**No dashboard (`/financeiro`):** filtros de tipo e categoria são locais (client-side), pois a lista do dia é pequena.  
**No histórico (`/financeiro/transacoes`):** todos os filtros são enviados via query params, pois a lista é paginada.

**API:** `GET /api/financial/transactions` recebe novo param `category` opcional. Schema Zod atualizado em `src/domains/financial/types.ts`.

---

### 5. Correção do Summary API

**Arquivo:** `src/app/api/financial/summary/route.ts`

Nova estrutura de resposta com breakdown de custos:

```typescript
{
  // Receitas
  grossRevenue: number
  discounts: number
  tips: number
  cardFees: number
  netRevenue: number

  // Custos detalhados
  supplyExpenses: number       // soma de "Insumo de Atendimento"
  supplyReversals: number      // soma de "Estorno de Insumo" (valor absoluto)
  netSupplyCost: number        // supplyExpenses - supplyReversals
  stockPurchases: number       // soma de "Compra de Estoque"
  operationalExpenses: number  // Despesas Variáveis + Fixas
  courtesies: number           // Cortesias

  totalExpenses: number        // netSupplyCost + stockPurchases + operationalExpenses + courtesies
  profit: number               // netRevenue - totalExpenses
  commissions: number
}
```

Lógica de separação:

```typescript
const isReversalTx = (t) => isReversal(t.category, Number(t.amount))

const supplyReversals = expenses
  .filter(isReversalTx)
  .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

const supplyExpenses = expenses
  .filter(t => t.category === FINANCIAL_CATEGORIES.SUPPLY_USE && !isReversalTx(t))
  .reduce((s, t) => s + Number(t.amount), 0)

const netSupplyCost = supplyExpenses - supplyReversals
```

**Painel "Resultado do mês" no `/financeiro`** exibe o breakdown:

```
Receita bruta           R$ 1.049,90
Descontos              -R$    31,99
Receita líquida         R$ 1.017,92
───────────────────────────────────
Insumos de serviço      -R$    80,00
  Estornos de insumo    +R$    30,00   ← âmbar
  Custo líquido         -R$    50,00
Compras de estoque      -R$   850,00
Despesas operacionais   -R$    70,00
Total despesas          -R$   970,00
───────────────────────────────────
Lucro real               R$    47,92
```

---

### 6. Relatório financeiro

**Arquivo:** `src/app/(app)/relatorios/financeiro/page.tsx` e `src/domains/reports/reports.service.ts`

Alterações:
- Linha de "Despesas" passa a usar o breakdown do summary (com linha de estornos visível)
- Tabela de agrupamento (por serviço/profissional) inclui coluna de custo de insumo e estorno quando aplicável
- O campo `amount` usado no relatório permanece `netAmount ?? amount` para INCOME (já correto)
- Para EXPENSE, o relatório filtra `category !== FINANCIAL_CATEGORIES.SUPPLY_REVERSAL` no total de despesas brutas e exibe estornos separadamente

---

## Compatibilidade retroativa

Registros existentes com `category = 'Insumo de Atendimento'` e `amount < 0` (estornos antigos) são detectados pela função `isReversal(category, amount)`:

```typescript
export function isReversal(category: string, amount: number): boolean {
  return category === FINANCIAL_CATEGORIES.SUPPLY_REVERSAL || amount < 0
}
```

Nenhuma migration de dados é necessária. Os cálculos do summary já produzem resultado correto para esses registros (amount negativo reduz o total de despesas).

---

## Fora de escopo

- Migration de dados para converter registros antigos de estorno para o novo padrão
- `finalizeAppointmentProducts` não cria transação de insumo na primeira vez — esse gap é um issue separado
- Novo `TransactionType.REVERSAL` no Prisma (Abordagem C — futuro, se necessário)
- Notificações ou alertas de custos elevados de insumo

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/domains/financial/categories.ts` | Criar |
| `src/domains/financial/subscriptions.ts` | Modificar |
| `src/domains/financial/types.ts` | Modificar (add `category` ao schema de filtro) |
| `src/components/domain/financial/transaction-card.tsx` | Modificar |
| `src/components/domain/financial/transaction-list.tsx` | Modificar |
| `src/app/(app)/financeiro/page.tsx` | Modificar |
| `src/app/(app)/financeiro/transacoes/page.tsx` | Modificar |
| `src/app/api/financial/summary/route.ts` | Modificar |
| `src/app/api/financial/transactions/route.ts` | Modificar (add param `category`) |
| `src/domains/reports/reports.service.ts` | Modificar |
| `src/app/(app)/relatorios/financeiro/page.tsx` | Modificar |
