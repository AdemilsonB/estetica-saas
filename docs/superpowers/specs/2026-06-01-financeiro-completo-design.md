# Financeiro Completo (Grupo E) — Design Spec

**Data:** 2026-06-01  
**Status:** Aprovado para implementação  
**Branch:** `feat/financeiro-completo`  
**Referência UX:** MinhaAgenda + Fresha + Square Appointments

---

## Objetivo

Transformar o módulo financeiro de "registro de receita automática" em **gestão financeira operacional completa**:
- Checkout com cálculo de desconto, gorjeta, taxa de cartão e comissão em tempo real
- Controle de despesas variáveis e fixas/recorrentes
- Lucro real (receita − despesas) no dashboard
- Cobranças pendentes (clientes com débito)
- Comissões por profissional × serviço
- Tipos de desconto configuráveis pelo dono nas Settings

---

## Decisões de Design

| Questão | Decisão |
|---------|---------|
| Quando criar Transaction | Somente ao marcar PAID (não mais ao completar) |
| Cobrança pendente | `paymentStatus` no Appointment + relatório de caixa |
| Comissões | % configurável por profissional + serviço (`ServiceCommission`) |
| Descontos | Tipos parametrizáveis pelo dono (Settings → Descontos); combobox com busca no checkout; valores pré-carregados mas editáveis |
| Taxa de cartão | JSON no Tenant por método (`cardFeeConfig`) |
| Gorjeta | Campo editável no checkout; vai 100% ao profissional (não integra na comissão de serviço) |
| Lucro real | Calculado: `SUM(INCOME) − SUM(EXPENSE)` por período |

---

## Schema — Alterações e Adições

### Enums novos

```prisma
enum AppointmentPaymentStatus {
  PENDING    // concluído, aguardando pagamento
  PAID       // pago — Transaction(INCOME) criada
  COURTESY   // cortesia — Transaction(EXPENSE "cortesia") criada
  DEBT       // inadimplente — aparece em cobranças pendentes
}

enum PaymentMethod {
  CASH
  PIX
  DEBIT_CARD
  CREDIT_CARD
  TRANSFER
}

enum DiscountApplyType {
  PERCENTAGE
  FIXED_VALUE
}

enum RecurrenceType {
  MONTHLY
  WEEKLY
}
```

### Appointment — campos adicionais

```prisma
paymentStatus   AppointmentPaymentStatus  @default(PENDING)
paymentMethod   PaymentMethod?
discountTypeId  String?
discountValue   Decimal?                  @db.Decimal(10,2)
```

### Transaction — campos adicionais

```prisma
paymentMethod    PaymentMethod?
grossAmount      Decimal?   @db.Decimal(10,2)  // valor bruto (serviço)
discountAmount   Decimal?   @db.Decimal(10,2)  // desconto aplicado
tipAmount        Decimal?   @db.Decimal(10,2)  // gorjeta
cardFeeAmount    Decimal?   @db.Decimal(10,2)  // taxa de cartão deduzida
netAmount        Decimal?   @db.Decimal(10,2)  // valor líquido final
commissionAmount Decimal?   @db.Decimal(10,2)  // comissão calculada
professionalId   String?                       // profissional que recebe comissão
```

### Tenant — campos adicionais

```prisma
cardFeeConfig Json?
// formato: { "DEBIT_CARD": 1.5, "CREDIT_CARD": 2.5 }
```

### Novo: `DiscountType`

```prisma
model DiscountType {
  id           String            @id @default(cuid())
  tenantId     String
  name         String            // "Recomendação", "Cupom VIP", "Evento Junho"
  type         DiscountApplyType // PERCENTAGE | FIXED_VALUE
  defaultValue Decimal?          @db.Decimal(10,2)
  active       Boolean           @default(true)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  tenant       Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}
```

### Novo: `ServiceCommission`

```prisma
model ServiceCommission {
  id             String   @id @default(cuid())
  tenantId       String
  serviceId      String
  professionalId String
  rate           Decimal  @db.Decimal(5,2)  // 0.00–100.00
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([tenantId, serviceId, professionalId])
  @@index([tenantId])
}
```

### Novo: `RecurringExpense`

```prisma
model RecurringExpense {
  id             String        @id @default(cuid())
  tenantId       String
  category       String        // "Aluguel", "Energia", "Produto"
  description    String
  amount         Decimal       @db.Decimal(10,2)
  recurrenceType RecurrenceType
  nextDueDate    DateTime
  active         Boolean       @default(true)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  tenant         Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, nextDueDate])
}
```

---

## Fórmula de Cálculo do Checkout

```
grossAmount    = Service.price
discountAmount = (type = PERCENTAGE) → grossAmount × rate/100
               | (type = FIXED_VALUE) → valor informado
subtotal       = grossAmount − discountAmount
tipAmount      = gorjeta informada pelo operador (default 0)
cardFeeRate    = Tenant.cardFeeConfig[paymentMethod] ?? 0
cardFeeAmount  = subtotal × cardFeeRate/100  (só se cartão)
netAmount      = subtotal + tipAmount − cardFeeAmount
commissionRate = ServiceCommission(tenantId, serviceId, professionalId)?.rate ?? 0
commissionAmount = netAmount × commissionRate/100
                   + tipAmount  ← gorjeta 100% ao profissional (adicional)
```

O `amount` gravado na `Transaction` = `netAmount` (valor líquido real recebido).

---

## Eventos de Domínio

```typescript
// src/shared/events/domain-events.ts — adicionar:

{ type: "scheduling.appointment.paid"; payload: {
    tenantId: string;
    appointment: Appointment & { service: Service; professional: User; customer: Customer };
    paymentMethod: PaymentMethod;
    grossAmount: number;
    discountAmount: number;
    tipAmount: number;
    cardFeeAmount: number;
    netAmount: number;
    commissionAmount: number;
}}

{ type: "scheduling.appointment.courtesy"; payload: {
    tenantId: string;
    appointment: Appointment & { service: Service };
}}
```

---

## Alterações em Arquivos Existentes

### `financial/subscriptions.ts`
- **Remover** listener de `scheduling.appointment.completed` (não cria mais Transaction automática)
- **Adicionar** listener de `scheduling.appointment.paid`:
  ```
  → cria Transaction(INCOME) com todos os campos calculados
  → usa appointment.professional.id como professionalId na Transaction
  ```
- **Adicionar** listener de `scheduling.appointment.courtesy`:
  ```
  → cria Transaction(EXPENSE, category: "cortesia", amount: Service.price)
  ```

### `scheduling/scheduling.service.ts`
- Novo método `markPayment(tenantId, appointmentId, checkoutData)`:
  ```typescript
  type CheckoutData = {
    paymentMethod: PaymentMethod;
    grossAmount: number;
    discountTypeId?: string;
    discountValue?: number;
    tipAmount: number;
  }
  ```
  - Valida que o appointment pertence ao tenantId
  - Calcula netAmount, cardFeeAmount, commissionAmount
  - Atualiza `Appointment.paymentStatus = PAID`
  - Publica evento `scheduling.appointment.paid`

- Novo método `markCourtesy(tenantId, appointmentId)`:
  - Atualiza `Appointment.paymentStatus = COURTESY`
  - Publica evento `scheduling.appointment.courtesy`

- Novo método `markDebt(tenantId, appointmentId)`:
  - Atualiza `Appointment.paymentStatus = DEBT`

---

## API Routes — Novas

| Método | Rota | Descrição | Permissão |
|--------|------|-----------|-----------|
| POST | `/api/scheduling/appointments/[id]/checkout` | Processa pagamento | `scheduling:manage` |
| POST | `/api/scheduling/appointments/[id]/courtesy` | Marca como cortesia | `scheduling:manage` |
| POST | `/api/scheduling/appointments/[id]/debt` | Marca como inadimplente | `scheduling:manage` |
| GET | `/api/financial/expenses` | Lista despesas variáveis | `financial:view` |
| POST | `/api/financial/expenses` | Cria despesa manual | `financial:manage` |
| DELETE | `/api/financial/expenses/[id]` | Remove despesa | `financial:manage` |
| GET | `/api/financial/recurring-expenses` | Lista despesas fixas | `financial:view` |
| POST | `/api/financial/recurring-expenses` | Cria despesa recorrente | `financial:manage` |
| PATCH | `/api/financial/recurring-expenses/[id]` | Edita/desativa | `financial:manage` |
| GET | `/api/financial/summary` | Receita, despesa, lucro por período | `financial:view` |
| GET | `/api/financial/pending-payments` | Cobranças pendentes | `financial:view` |
| GET | `/api/financial/commissions` | Relatório de comissões | `financial:view` |
| GET | `/api/settings/discount-types` | Lista tipos de desconto | `settings:view` |
| POST | `/api/settings/discount-types` | Cria tipo de desconto | `settings:manage` |
| PATCH | `/api/settings/discount-types/[id]` | Edita tipo | `settings:manage` |
| DELETE | `/api/settings/discount-types/[id]` | Arquiva tipo | `settings:manage` |
| GET | `/api/settings/commissions` | Lista comissões por serviço | `settings:view` |
| POST | `/api/settings/commissions` | Define comissão | `settings:manage` |
| DELETE | `/api/settings/commissions/[id]` | Remove comissão | `settings:manage` |
| PATCH | `/api/settings/card-fees` | Salva taxas de cartão | `settings:manage` |

---

## Frontend — Componentes e Páginas

### 1. `CheckoutModal` — modal ao clicar "Concluir" no card

```
┌──────────────────────────────────────────────────┐
│  Checkout — João Silva · Corte                   │
│                                                  │
│  Valor original:        R$ 50,00                 │
│                                                  │
│  Desconto                                        │
│  [Buscar tipo de desconto...  ▼]  ← Combobox     │
│    ↳ ao selecionar: pré-carrega % ou R$          │
│  Tipo: [● %] [○ R$]    Valor: [10  ]%            │
│  Desconto calculado:   -R$ 5,00                  │
│                                                  │
│  Gorjeta:              +R$ [0,00]                │
│  ──────────────────────────────                  │
│  Subtotal:              R$ 45,00                 │
│                                                  │
│  Forma de pagamento:   [PIX ▼]                   │
│  Taxa cartão: —                                  │
│  Valor líquido:         R$ 45,00  (destaque)     │
│                                                  │
│  Comissão (João — 40%): R$ 18,00                 │
│                                                  │
│      [Cortesia]  [Cancelar]  [✅ Confirmar]      │
└──────────────────────────────────────────────────┘
```

- Todos os valores recalculam em tempo real (onChange)
- Combobox de desconto: busca por nome, filtra ativos do tenant
- Ao selecionar tipo: pré-carrega `defaultValue` mas campo editável
- Botão "Cortesia" abre confirmação e chama `/courtesy`

### 2. Badge de `paymentStatus` no `AppointmentCard`

| Status | Badge |
|--------|-------|
| PENDING | `💰 Pendente` (amarelo) |
| PAID | `✅ Pago` (verde) |
| COURTESY | `🎁 Cortesia` (roxo) |
| DEBT | `⚠️ Inadimplente` (vermelho) |

### 3. Relatório de Cobranças Pendentes (`/financeiro/cobrancas`)

Lista de agendamentos com `paymentStatus IN (PENDING, DEBT)`, agrupados por cliente. Mostra: nome do cliente, serviço, data, valor, dias em atraso. Ação: "Registrar pagamento" → abre CheckoutModal.

### 4. Gestão de Despesas (`/financeiro/despesas`)

Duas abas:
- **Variáveis** — lista de transactions EXPENSE lançadas manualmente, botão "+ Lançar despesa", formulário: categoria/descrição/valor/data
- **Fixas** — lista de `RecurringExpense` ativos, botão "+ Despesa fixa", formulário: categoria/descrição/valor/recorrência/próximo vencimento

### 5. Dashboard — aba "Resultado"

Extensão do dashboard existente:

```
┌──────────────────────────────────────────────────┐
│  Resultado do período  [Maio 2026 ▼]            │
│                                                  │
│  Receita bruta:      R$ 4.200,00                 │
│  Descontos:          - R$ 350,00                 │
│  Gorjetas:           + R$ 120,00                 │
│  Taxas de cartão:    - R$ 85,00                  │
│  Receita líquida:    R$ 3.885,00  ← destaque     │
│                                                  │
│  Despesas variáveis: - R$ 800,00                 │
│  Despesas fixas:     - R$ 2.100,00               │
│  ──────────────────────────────                  │
│  Lucro real:         R$ 985,00   ← destaque      │
│                                                  │
│  Comissões pagas:    R$ 1.200,00                 │
└──────────────────────────────────────────────────┘
```

### 6. Settings → Aba "Descontos"

Lista de `DiscountType` com: nome, tipo (% ou R$), valor padrão, status. CRUD completo. Formulário: nome, tipo (toggle % / R$), valor padrão (opcional), ativar/desativar.

### 7. Settings → Aba "Comissões"

Grid: profissionais × serviços com campo de % editável inline. Ao salvar, faz upsert em `ServiceCommission`. Exibe "—" quando não configurado (sem comissão).

### 8. Settings → Aba "Pagamentos"

Taxas de cartão por bandeira:
```
Débito:   [1,5]%
Crédito:  [2,5]%
[Salvar]
```

---

## Job pg-boss — Despesas Recorrentes

```typescript
// src/shared/queue/jobs/recurring-expense.ts

RECURRING_EXPENSE_JOB = "recurring-expense-processor"

// Cron: diariamente às 6h UTC
// Handler:
//   1. busca RecurringExpense onde nextDueDate <= hoje AND active = true
//   2. para cada uma: cria Transaction(EXPENSE, tenantId, category, description, amount)
//   3. atualiza nextDueDate:
//      MONTHLY → add 1 mês
//      WEEKLY  → add 7 dias
```

Registrar em `runtime.ts` junto com `registerBirthdayReminder`.

---

## Estrutura de Arquivos

```
src/
├── domains/
│   ├── financial/
│   │   ├── expense.repository.ts        ← NOVO
│   │   ├── recurring-expense.repository.ts ← NOVO
│   │   ├── commission.repository.ts     ← NOVO
│   │   ├── financial.service.ts         ← MODIFICAR: add summary, pending, commissions
│   │   ├── subscriptions.ts             ← MODIFICAR: remover completed, add paid/courtesy
│   │   └── types.ts                     ← MODIFICAR: novos schemas Zod
│   └── scheduling/
│       └── scheduling.service.ts        ← MODIFICAR: markPayment, markCourtesy, markDebt
│
├── app/api/
│   ├── scheduling/appointments/[id]/
│   │   ├── checkout/route.ts            ← NOVO
│   │   ├── courtesy/route.ts            ← NOVO
│   │   └── debt/route.ts                ← NOVO
│   ├── financial/
│   │   ├── expenses/route.ts            ← NOVO
│   │   ├── expenses/[id]/route.ts       ← NOVO
│   │   ├── recurring-expenses/route.ts  ← NOVO
│   │   ├── recurring-expenses/[id]/route.ts ← NOVO
│   │   ├── summary/route.ts             ← NOVO
│   │   ├── pending-payments/route.ts    ← NOVO
│   │   └── commissions/route.ts         ← NOVO
│   └── settings/
│       ├── discount-types/route.ts      ← NOVO
│       ├── discount-types/[id]/route.ts ← NOVO
│       ├── commissions/route.ts         ← NOVO
│       ├── commissions/[id]/route.ts    ← NOVO
│       └── card-fees/route.ts           ← NOVO
│
├── components/domain/
│   ├── financial/
│   │   ├── checkout-modal.tsx           ← NOVO
│   │   ├── expense-form.tsx             ← NOVO
│   │   ├── expense-list.tsx             ← NOVO
│   │   ├── recurring-expense-form.tsx   ← NOVO
│   │   ├── recurring-expense-list.tsx   ← NOVO
│   │   ├── pending-payments-list.tsx    ← NOVO
│   │   ├── commissions-report.tsx       ← NOVO
│   │   └── financial-summary.tsx        ← NOVO
│   └── settings/
│       ├── discount-types-manager.tsx   ← NOVO
│       ├── commissions-grid.tsx         ← NOVO
│       └── card-fees-form.tsx           ← NOVO
│
└── app/(app)/
    └── financeiro/
        ├── page.tsx                     ← NOVO (dashboard + resultado)
        └── cobrancas/page.tsx           ← NOVO (cobranças pendentes)
```

---

## Regras de Negócio

1. **Multi-tenancy:** todos os models novos têm `tenantId` + `@@index([tenantId])`
2. **Breaking change — receita automática:** agendamentos antigos (status COMPLETED) recebem `paymentStatus = PENDING` via migration. Dono pode marcar retroativamente.
3. **Comissão sobre netAmount:** comissão calculada sobre valor líquido (após desconto e taxa de cartão), mais gorjeta inteira
4. **Desconto editável:** valor padrão do DiscountType é sugestão; operador pode editar no checkout
5. **RecurringExpense:** job diário apenas processa registros com `nextDueDate <= hoje AND active = true`. Desativar o registro para o tenant; não deleta histórico de Transactions já criadas
6. **Cortesia:** cria Transaction(EXPENSE) com valor = `Service.price` — saída no caixa para controle de custos
7. **DEBT:** apenas muda status visual. Não gera Transaction. Aparece em relatório de cobranças
8. **Feature gating:** funcionalidades financeiras avançadas (comissões, recorrentes) requerem plano STARTER ou superior

---

## Prompt de implementação para outro chat

```
Projeto: estetica-saas em c:\dev\estetica-saas
Branch: feat/financeiro-completo
Stack: Next.js 15 + TypeScript strict + Prisma + Supabase + pg-boss + Shadcn UI + TanStack Query

Spec completa: docs/superpowers/specs/2026-06-01-financeiro-completo-design.md

O que implementar:
1. Schema migration (enums + campos em Appointment e Transaction + 3 novos models)
2. financial/subscriptions.ts — remover listener appointment.completed, adicionar paid/courtesy
3. scheduling.service.ts — markPayment, markCourtesy, markDebt
4. Repositories: expense, recurring-expense, commission
5. API routes: checkout, cortesia, débito, despesas, recorrentes, summary, cobranças, comissões, discount-types, card-fees
6. Job pg-boss recurring-expense-processor (cron 6h UTC)
7. Frontend: CheckoutModal com combobox de desconto (Shadcn Command), badges de paymentStatus
8. Frontend: gestão de despesas (variáveis + fixas)
9. Frontend: dashboard resultado (receita − despesas = lucro)
10. Frontend: cobranças pendentes
11. Settings: Descontos, Comissões, Taxas de Cartão
12. PR para main

Padrões obrigatórios:
- tenantId sempre do JWT
- Todo model tem @@index([tenantId])
- Erros tipados de src/shared/errors/
- initializeDomainRuntime() + getSessionContext() + handleApiError() nas API Routes
- Commits em PT-BR (Conventional Commits)
- TDD onde aplicável (services e repositories)

Use superpowers:writing-plans → superpowers:subagent-driven-development
```
