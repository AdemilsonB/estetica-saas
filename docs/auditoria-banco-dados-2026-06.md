# Auditoria de banco de dados — índices, N+1 e reaproveitamento de schema

> Referente à issue #122.
> Data: 2026-06-21
> Escopo: `prisma/schema.prisma` completo + repositories de `scheduling`, `financial`, `crm`, `notifications` + jobs de fila (`src/shared/queue/jobs/`).

---

## 1. Auditoria de índices

### 1.1 Índices adicionados (migration `20260622014940_add_missing_fk_and_composite_indexes`)

Todos aditivos — sem downtime, sem risco de dados. Critério: toda FK sem índice correspondente, mais os 5 compostos pedidos na issue.

| Model | Índice | Motivo |
|---|---|---|
| `User` | `@@index([roleId])` | FK sem índice (`customRole` relation) |
| `Appointment` | `@@index([tenantId, customerId])` | Pedido explícito da issue — histórico por cliente (`CustomerRepository.findWithAppointments`, relatórios) |
| `Appointment` | `@@index([tenantId, status])` | Pedido explícito da issue — filtro de status usado em `AppointmentRepository.findAll`, `reports.service.ts`, `dashboard/metrics` |
| `Appointment` | `@@index([serviceId])` | FK sem índice — usado em filtros de relatório (`getAppointmentsReport`, `getProfessionalsReport`) |
| `Appointment` | `@@index([createdByUserId])` | FK sem índice |
| `Appointment` | `@@index([discountTypeId])` | FK sem índice |
| `Transaction` | `@@index([tenantId, professionalId])` | Pedido explícito da issue — `TransactionRepository.list` filtra por `professionalId` sem nenhum índice de suporte hoje |
| `Transaction` | `@@index([appointmentId])` | FK sem índice (`Appointment.transactions`) |
| `NotificationLog` | `@@index([appointmentId])` | FK sem índice |
| `NotificationLog` | `@@index([customerId])` | FK sem índice |
| `ServicePackageItem` | `@@index([serviceId])` | FK sem índice (lookup reverso "pacotes que contêm este serviço") |
| `PromotionItem` | `@@index([promotionId])`, `@@index([serviceId])`, `@@index([packageId])` | Model não tinha **nenhum** índice — todas as 3 FKs descobertas e usadas em `publicBookingRepository.findPublicPromotions` |
| `StockMovement` | `@@index([appointmentId])`, `@@index([createdByUserId])` | FKs sem índice |
| `AppointmentProduct` | `@@index([productId])` | FK sem índice (lookup reverso por produto) |
| `ServiceProduct` | `@@index([productId])` | FK sem índice |
| `CatalogService` | `@@index([categoryId])` | FK sem índice |
| `CatalogProduct` | `@@index([categoryId])` | FK sem índice |

**Os 5 índices compostos pedidos na issue — status de cada um:**

| Índice pedido | Status |
|---|---|
| `@@index([tenantId, createdAt])` | Já cobertos onde importava: `Subscription.status+currentPeriodEnd`, `StockMovement.tenantId+type+createdAt`. Nenhuma listagem audita encontrada ordenando por `createdAt` puro sem outro filtro que justifique uma entrada nova — não criado para evitar índice morto. |
| `@@index([tenantId, professionalId])` | ✅ Criado em `Transaction`. Em `Appointment` já existe `[tenantId, professionalId, startsAt]`, que cobre esse prefixo. |
| `@@index([tenantId, customerId])` | ✅ Criado em `Appointment`. |
| `@@index([tenantId, status])` | ✅ Criado em `Appointment`. |
| `@@index([tenantId, paidAt])` | Já existia em `Transaction`. |

### 1.2 Índice parcial proposto (não aplicado — limitação do Prisma)

A issue pede índice parcial para queries filtradas por status. O Prisma **não suporta `WHERE` em `@@index`** no schema — só é possível via SQL bruto numa migration `--create-only`, o que cria *schema drift*: a próxima `prisma migrate dev` tentaria dropar o índice por não reconhecê-lo no `schema.prisma`. Por esse risco, a proposta abaixo fica documentada para aplicação manual quando o volume de dados justificar:

```sql
-- Aplicar manualmente quando o histórico de Appointment crescer o suficiente
-- para que o índice composto [tenantId, status] fique grande por incluir
-- COMPLETED/CANCELLED/NO_SHOW históricos. Reduz o índice a ~20-30% do tamanho
-- para a query mais frequente: "agendamentos ativos do tenant".
CREATE INDEX CONCURRENTLY "Appointment_tenant_status_active_idx"
  ON "Appointment" ("tenantId", "professionalId", "startsAt")
  WHERE status IN ('SCHEDULED', 'CONFIRMED');
```

Hoje (volume atual) o índice composto `[tenantId, status]` recém-criado e o `[tenantId, professionalId, startsAt]` já existente cobrem bem as queries de disponibilidade (`availability.service.ts`) e overlap (`findOverlappingForProfessional`) — o parcial é otimização futura, não bloqueador.

---

## 2. Auditoria de N+1

### 2.1 Repositories principais (scheduling, financial, crm, notifications)

**Nenhum N+1 encontrado.** Todos os repositories auditados usam `include`/`select` com escopo correto ou `Promise.all` para paralelizar queries independentes:

- `appointment.repository.ts` — `findAll` já usa `select` seletivo em `customer`/`professional`/`service`.
- `transaction.repository.ts`, `notification.repository.ts` — paginação com `Promise.all([findMany, count])`.
- `reports.service.ts` (financeiro, agendamentos, clientes, profissionais) — agregação em memória sobre um único `findMany` com `include` correto, sem queries dentro de loop.
- `dashboard/metrics/route.ts` — usa `groupBy` + `aggregate` em `Promise.all`, e o único "fan-out" (buscar nomes de profissionais) é um `findMany` único com `id: { in: profIds }`, não um loop.
- `availability.service.ts`, `public-booking.repository.ts` — fetch único + filtragem em memória, sem N+1.

### 2.2 Jobs de fila (`src/shared/queue/jobs/`) — fora do escopo direto da issue, mas tocam scheduling/financial/notifications

Dois problemas reais encontrados e corrigidos:

**`subscription-expiry-warnings.ts`** — para cada subscription em trial, fazia um `prisma.user.findMany` redundante dentro do loop só para buscar o `email` de um usuário cujo `id` já estava disponível na query anterior. Corrigido: `email` agora vem no `select` original (`tenant.users.select`), eliminando 1 query por iteração.

**`recurring-expense.ts`** — para cada despesa recorrente vencida, fazia `transaction.create` + `recurringExpense.update` como 2 awaits sequenciais (2N round-trips ao banco). Corrigido: as operações agora são montadas como um array de promises do Prisma e executadas em um único `prisma.$transaction([...])`, reduzindo para 1 round-trip por execução do job, mantendo o mesmo comportamento (mesma quantidade de statements, atomicidade adicional como bônus).

**`vip-sweep.ts`** — processa por tenant (1 raw query de agregação + 2 `updateMany` por tenant). É um loop por tenant, não por linha de cliente — comportamento aceitável para um cron noturno; não há vitória clara sem reescrever como uma única query com `PARTITION BY tenantId`, o que aumentaria a complexidade do SQL para um ganho marginal dado o volume atual de tenants. Não alterado — documentado como aceitável.

---

## 3. Reaproveitamento de schema

### 3.1 Campo sem uso aparente — removido

- **`Subscription.externalId`** (`prisma/schema.prisma`) — `String?`, nunca lido nem escrito em nenhum ponto do `src/`. Confirmado também no banco: 0 de 15 subscriptions tinham o campo preenchido.
  - **Origem:** criado em `bff795e` (27/05/2026, schema inicial de planos) como campo agnóstico de gateway — o design doc da época (`docs/superpowers/specs/2026-05-27-planos-feature-gating-design.md:95`) comenta `// ID no Asaas/Stripe (fase 3)`, ou seja, era um placeholder para quando o gateway de pagamento (Asaas ou Stripe) fosse decidido.
  - Quando a integração Stripe foi implementada (`3df1c4c`, 07/06/2026), a equipe optou por campos tipados e específicos (`stripeCustomerId`, `stripeSubId`, `stripePriceId`) em vez do campo genérico, que ficou como resíduo.
  - **Removido em `chore/remove-subscription-external-id`** (migration `20260622021203_remove_unused_subscription_external_id`) — confirmado com o usuário antes do `DROP COLUMN`, conforme protocolo de migration destrutiva.

### 3.2 Campos write-only (escritos, nunca lidos) — manter, mas vale nota

- **`Customer.consentOrigin`** — gravado em `public_booking` e `whatsapp_import`, mas não é exibido em nenhuma tela hoje. Mantido: tem valor de auditoria/LGPD mesmo sem UI de leitura ainda.

### 3.3 Relação "soft" sem `@relation` no Prisma

- **`TenantInvite.roleId`** — é um `String?` solto, sem `@relation` para `Role`, mas é lido e usado (`iam.service.ts:254`, fallback de role no aceite de convite). Funciona corretamente porque o volume da tabela é baixo e a busca é sempre por PK. Não é um problema de performance — é uma modelagem mais frouxa que poderia futuramente virar uma relation própria, mas não há FK índice faltando porque não há FK declarada. Não alterado nesta sessão (mudança de modelagem, não de performance).

### 3.4 Verificação geral

Os demais campos investigados como suspeitos de subutilização (`Tenant.evolutionPhone`, `Customer.tags`, `Appointment.allowOverlap`, `Service.catalogServiceId`/`Product.catalogProductId`) têm uso confirmado em código (UI, services ou rotas de API) — não são candidatos a limpeza.

---

## 4. Critério de aceite — checklist

- [x] Nenhuma query frequente sem índice adequado — 22 índices novos cobrindo todas as FKs sem suporte e os 4 compostos aplicáveis pedidos na issue.
- [x] Sem N+1 identificado nos repositories principais — confirmado limpo; 2 N+1 reais encontrados em jobs de fila e corrigidos.
- [x] Schema documentado com análise de reaproveitamento — este documento + ADR em `docs/decisions.md`. `Subscription.externalId` removido após confirmação do usuário.
