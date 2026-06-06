# Spec Master — Sistema Completo para Produção

**Data:** 2026-06-06
**Status:** Aprovado pelo usuário
**Decisões confirmadas:**
- Gateway: **Stripe** (sem mensalidade — 2,9% + $0,30/transação)
- URL pública: **path-based** — `/agendar/[slug]`
- Chatbot WhatsApp: **detecção de intenção por keywords** (sem IA no MVP)
- Estratégia de entrega: **tracks paralelos** (A+B simultâneos com C+D+E)
- Orçamentos (Caminho 2 do spec de booking): **Fase 2** — fora do escopo desta entrega

---

## 1. Inventário de Estado (2026-06-06)

### Implementado e estável

| Módulo | Observações relevantes |
|---|---|
| IAM: RBAC, cargos dinâmicos, permissões | `ensurePermission` com duas assinaturas |
| CRM: clientes, anamnese, filtros avançados | `Customer.birthDate` existe — base para aniversário |
| Scheduling: agenda semanal, slots, disponibilidade | `getAvailableSlots()` reutilizável na rota pública |
| Financial: checkout, despesas, comissões, taxas | — |
| Notifications: Evolution API, 6 templates | Provider primário confirmado; Twilio removido |
| Inventory: catálogo, estoque, reflexo financeiro | — |
| Reports: 4 relatórios + filtros + CSV | — |
| Admin: overview + planos + tenants (Camada 1) | Camadas 2 e 3 são escopo deste spec |
| Billing: trial 14d, changePlan, FeatureGuard, PlanLimitsService | `Subscription.externalId` existe — mapear para `stripeSubId` |
| Branding: `BrandingConfig` com 8 tokens de cor + logo | Fonte para SSR do booking público |
| `Tenant.slug` único | ✅ Já existe no schema |
| `Tenant.businessHours` JSON | ✅ Já existe |
| `Tenant.reminderLeadHours` | ✅ Já existe |
| `Tenant.evolutionInstanceId/Connected/Status/Phone` | ✅ Já existe |

### Especificado mas não implementado

| Módulo | Spec | Ajuste necessário antes de implementar |
|---|---|---|
| Página pública de agendamento (Caminho 1) | [2026-05-29](./2026-05-29-agendamento-publico-design.md) | Substituir Twilio → Evolution API; remover Caminho 2 do escopo |

### Sem spec nem implementação (este documento)

Stripe Billing, Página de preços, Onboarding com plano, WhatsApp Automation Suite completa, Admin Camada 2+3, Políticas de agendamento, Bloqueio de cliente, Push Notifications, Agendamentos recorrentes, Fiado, NPS, Google Calendar.

---

## 2. Track A — Produto Funcional para o Cliente Final (Prioridade 1)

### A1. Página Pública de Agendamento

**Spec base:** [2026-05-29](./2026-05-29-agendamento-publico-design.md) — **implementar o Caminho 1 completo.**
O Caminho 2 (orçamentos) é Fase 2 e deve ser ignorado nesta entrega.

#### Correções obrigatórias em relação ao spec original

**Twilio → Evolution API em todas as notificações do fluxo público:**

| Spec original | Implementação correta |
|---|---|
| `TWILIO_TPL_*` com template ID aprovado | Mensagem livre via `notificationService.logAndDispatch()` |
| Campos `{1}`, `{2}` (sintaxe Twilio) | Variáveis inline no texto da mensagem |
| `TWILIO_PHONE_NUMBER` como remetente | Instância Evolution do tenant |

Templates a criar para o fluxo público (mensagens livres):
```
appointment-public-created    → confirmação ao cliente após agendamento público
appointment-public-cancelled  → cancelamento iniciado pelo salão (cliente sem login)
```

**`Service.priceType` — nova migration necessária:**
```prisma
enum PriceType {
  FIXED           // Preço fixo — usa price existente
  RANGE           // Faixa: priceMin–priceMax
  ON_CONSULTATION // Sob consulta — botão "Entrar em contato" na vitrine
}

// Alterações em model Service:
priceType  PriceType @default(FIXED)
priceMin   Decimal?  @db.Decimal(10, 2)
priceMax   Decimal?  @db.Decimal(10, 2)
```

Serviços `ON_CONSULTATION` exibem "Sob consulta" e botão "Entrar em contato" que abre WhatsApp direto com o salão (não abre o fluxo de agendamento).

#### Infraestrutura de rota pública

Novo route group `(public)` sem middleware de autenticação:
```
src/app/
└── (public)/
    ├── layout.tsx              ← layout sem sidebar, header neutro
    └── agendar/
        └── [slug]/
            └── page.tsx        ← booking público (SSR para branding)
```

API Routes públicas (sem `withTenant` — auth via slug):
```
GET  /api/public/[slug]                → dados do salão: nome, logo, branding, serviços, profissionais, businessHours
GET  /api/public/[slug]/availability   → slots disponíveis (reutiliza getAvailableSlots + SchedulingPolicy)
POST /api/public/[slug]/appointments   → cria agendamento guest
```

Rate limiting nas rotas públicas (implementação com Prisma — sem dependência nova):
- 5 agendamentos/hora por IP
- 3 agendamentos/dia por telefone
- Tabela `PublicRateLimit { ip, phone, action, count, windowStart }` — limpa por cron diário

#### Fluxo completo (6 steps — Caminho 1)

**Step 1 — Vitrine do salão** (sempre visível, não colapsável)
- SSR: logo, nome, cores, horário de hoje com badge "Aberto agora" / "Abre às Xh"
- Timezone do tenant respeitado via `Intl.DateTimeFormat`

**Step 2 — Escolha do serviço**
- Grid de cards agrupados por `Service.category`
- Card: nome, duração, preço conforme `priceType`
- `ON_CONSULTATION`: botão "Entrar em contato" → link `https://wa.me/{tenant.phone}?text=Olá, gostaria de saber mais sobre {service.name}`

**Step 3 — Escolha do profissional**
- Card "Qualquer disponível" sempre primeiro (próximo horário livre entre todos)
- Cards por profissional: foto (avatar com inicial se sem foto), nome
- Pulado automaticamente se tenant tiver apenas 1 profissional ativo

**Step 4 — Data e horário**
- Calendário dos próximos `SchedulingPolicy.maxAdvanceDays` dias
- Dias sem vaga: desabilitados
- Slots ocultos (não desabilitados) para horários ocupados/bloqueados
- SWR com revalidação a cada 30s para evitar double-booking

**Step 5 — Identificação do cliente**
- Nome + telefone com máscara `(00) 00000-0000`
- Lookup assíncrono por telefone: se cliente existir → "Bem-vinda de volta, [Nome]!" + pré-preenche nome
- Observações opcionais (textarea)
- **Zero cadastro. Zero senha. Zero login.**

**Step 6 — Confirmação**
- Resumo completo (serviço, profissional, data, hora)
- POST `/api/public/[slug]/appointments` → `findOrCreateByPhone(tenantId, phone, name)` → cria Appointment
- WhatsApp de confirmação enviado via `notificationService.logAndDispatch()` com template `appointment-public-created`
- Tela de sucesso: links "Adicionar ao Google Calendar" e "Adicionar ao Apple Calendar" (links `.ics` gerados no servidor)

#### Segurança específica desta rota

- Slug não expõe `tenantId` em nenhum response
- `GET /api/public/[slug]` nunca retorna emails, CPFs ou dados de funcionários além de nome e foto
- Agendamento só é criado se `SchedulingPolicy.allowPublicBooking = true`
- Validação: `startsAt >= now() + minAdvanceMinutes` e `startsAt <= now() + maxAdvanceDays`

---

### A2. Políticas de Agendamento

**Novo model:**
```prisma
model SchedulingPolicy {
  id                 String   @id @default(cuid())
  tenantId           String   @unique
  paddingMinutes     Int      @default(0)
  minAdvanceMinutes  Int      @default(15)
  maxAdvanceDays     Int      @default(60)
  allowPublicBooking Boolean  @default(true)
  updatedAt          DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

**Integração no AvailabilityService:**
- `getAvailableSlots()` recebe `paddingMinutes` → aplica como buffer após cada slot ocupado
- Se `allowPublicBooking = false` → `POST /api/public/[slug]/appointments` retorna `403`

**API Routes:**
```
GET  /api/scheduling/policy   → busca ou cria política padrão do tenant
PUT  /api/scheduling/policy   → atualiza
```

**UI — nova aba "Agendamento Online" em `/configuracoes`:**
- Toggle "Aceitar agendamentos online" (allowPublicBooking)
- Select "Intervalo entre atendimentos": Sem intervalo / 5 / 10 / 15 / 20 / 30 / 45 / 60 min
- Select "Antecedência mínima": Sem trava / 5 / 10 / 15 / 20 / 30 / 45 / 60 / 120 min
- Select "Janela de agendamento": 15 / 30 / 45 / 60 / 90 dias
- Campo copiável "Link do agendamento público": `{APP_URL}/agendar/{tenant.slug}`

---

### A3. Bloqueio de Cliente

**Schema (adição ao model Customer):**
```prisma
isBlocked     Boolean  @default(false)
blockedReason String?
blockedAt     DateTime?
```

**Backend:**
- `CustomerRepository`: adicionar `block(tenantId, id, reason?)` e `unblock(tenantId, id)`
- `SchedulingService.createAppointment()`: `if (customer.isBlocked) throw new CustomerBlockedError(customer.name)`
- `POST /api/public/[slug]/appointments`: se `isBlocked` → retorna `403` com mensagem genérica ("Não foi possível completar o agendamento. Entre em contato com o salão.")

**UI:**
- Perfil do cliente: botão "Bloquear" com modal de confirmação + campo de motivo opcional
- Cliente bloqueado: badge visível na lista + banner de aviso no perfil
- Botão "Desbloquear" exibido quando `isBlocked = true`

---

## 3. Track B — Como os Tenants Contratam e Pagam (Prioridade 1)

### B1. Stripe Billing Integration

**Modelo:** Stripe Billing com Subscriptions. Um `Product` por plano pago (STARTER, PRO, ENTERPRISE), um `Price` mensal por produto. FREE não precisa de produto no Stripe — é o estado padrão sem subscription ativa.

**Schema — adições ao model Subscription (já existe):**
```prisma
// Renomear externalId → manter compatibilidade; adicionar campos Stripe:
stripeCustomerId  String? @unique
stripeSubId       String? @unique
stripePriceId     String?
cancelAtPeriodEnd Boolean @default(false)
```

**Nota de migração:** `Subscription.externalId` já existe — mapear para `stripeSubId` na migration ou manter ambos temporariamente.

**Fluxo de upgrade (tenant autenticado):**
```
1. /configuracoes/planos → botão "Fazer upgrade para PRO"
2. POST /api/billing/checkout  { planName: 'PRO' }
   → stripe.customers.create() ou retrieve por stripeCustomerId
   → stripe.checkout.sessions.create({ mode: 'subscription', line_items: [priceId] })
   → retorna { checkoutUrl }
3. Frontend redireciona para checkoutUrl (página Stripe-hosted)
4. Stripe redireciona para /configuracoes/planos?stripe=success
5. Webhook confirma pagamento → billingService.changePlan()
```

**Webhook:**
```
POST /api/billing/stripe/webhook
```
```typescript
// bodyParser DEVE ser desabilitado para validação de assinatura
export const config = { api: { bodyParser: false } }

// Eventos tratados:
'customer.subscription.created'  → changePlan(plano contratado, ACTIVE)
'customer.subscription.updated'  → sincroniza status/plano
'customer.subscription.deleted'  → changePlan(FREE, CANCELLED)
'invoice.payment_failed'         → status PAST_DUE + WhatsApp ao owner
'invoice.payment_succeeded'      → status ACTIVE (saída de PAST_DUE)
```

**Portal de Billing (Stripe Customer Portal):**
```
POST /api/billing/portal  →  stripe.billingPortal.sessions.create({ customer: stripeCustomerId })
                              retorna { portalUrl }
```
Botão "Gerenciar assinatura / Faturas" visível apenas quando `stripeSubId` preenchido.

**Env vars:**
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Dependência NPM:** `stripe@^14`

---

### B2. Página Pública de Planos e Preços

**URL:** `/planos` (no route group `(public)`, sem auth)

**Conteúdo:**
- Header: logo do sistema + links "Entrar" e "Começar grátis"
- Toggle mensal/anual (anual = 2 meses grátis: `price * 10 / 12`)
- 4 cards de plano em grid (dados via SSR do model `Plan` + `PlanFeatureConfig`)
  - Card PRO: badge "Mais popular" + borda destacada
  - FREE: CTA "Começar grátis"
  - STARTER / PRO / ENTERPRISE: CTA "Iniciar 14 dias grátis"
- FAQ básico (5 perguntas, hardcoded — não precisa de CMS)
- Footer simples

**Fluxo dos CTAs:**
- Todos direcionam para `/login?plan={planName}`
- `login/page.tsx`: lê `?plan` e persiste em cookie `plan_selected` (TTL sessão)
- Após autenticação completa → `/onboarding` lê cookie → pré-seleciona plano

---

### B3. Onboarding com Seleção de Plano

**Onboarding atual:** 1 step (dados do negócio) → dashboard.
**Onboarding novo:** 2 steps.

**Step 1 — Dados do negócio** (igual ao atual — sem regressão):
- Nome do negócio, nome do usuário, branding opcional

**Step 2 — Confirmação do plano (novo):**
- Se veio com `plan_selected` cookie: exibe plano pré-selecionado + lista de features + "Trial de 14 dias"
- Se não veio com plano: 4 cards simplificados para escolha inline
- Botão "Começar 14 dias grátis →" (ou "Começar gratuitamente" para FREE)
- Texto: "Sem cartão de crédito. Cancele quando quiser."

**Ao confirmar:**
1. `billingService.startTrial()` — já existe, cria Subscription TRIALING
2. `stripe.customers.create({ email, name, metadata: { tenantId } })` → persiste `stripeCustomerId` em Subscription
3. Redirect para `/dashboard`

Criar Stripe Customer no onboarding (sem cobrança) permite lookup imediato no upgrade posterior.

---

## 4. Track C — WhatsApp Automation Suite (Prioridade 2)

### C1. Lembrete Pré-Agendamento

**Schema:** sem alteração — `Tenant.reminderLeadHours` já existe.

**Novo arquivo:** `src/domains/scheduling/scheduling.jobs.ts`

**Lógica de agendamento do job:**
```typescript
// Subscribes em appointment.created e appointment.confirmed:
eventBus.subscribe('scheduling.appointment.created', async ({ tenantId, appointment }) => {
  const tenant = await tenantRepository.findById(tenantId)
  const runAt = new Date(appointment.startsAt.getTime() - tenant.reminderLeadHours * 3_600_000)
  if (runAt > new Date()) {
    await boss.sendAt('appointment:reminder', { tenantId, appointmentId: appointment.id }, runAt, {
      singletonKey: `reminder-${appointment.id}`, // evita duplicatas
    })
  }
})
```

**Job handler:**
```typescript
boss.work('appointment:reminder', async (job) => {
  const { tenantId, appointmentId } = job.data
  const appt = await schedulingRepository.findById(tenantId, appointmentId)
  if (!appt || !['SCHEDULED', 'CONFIRMED'].includes(appt.status)) return // cancelado
  await notificationService.logAndDispatch({ template: 'appointment-reminder', ... })
})
```

---

### C2. Configuração de Automações WhatsApp (UI)

**Schema — adições ao model Tenant:**
```prisma
// Resposta automática
autoReplyEnabled        Boolean @default(false)
autoReplyIntervalHours  Int     @default(6)
autoReplyMessage        String?
// Fora do expediente
offHoursEnabled         Boolean @default(false)
offHoursMessage         String?
// Status diário
dailyStatusEnabled      Boolean @default(false)
dailyStatusHour         Int     @default(9)
// Aniversário
birthdayEnabled         Boolean @default(false)
birthdayMessage         String?
birthdayGiftServiceId   String?
```

**UI — nova aba "Automações" em `/configuracoes`:**
Visível apenas quando Evolution API está conectada (`evolutionConnected = true`).

Seções:
1. **Lembrete de agendamento**: toggle + select de antecedência (30min / 1h / 2h / 3h / 6h / 12h / 24h / 48h) → salva em `Tenant.reminderLeadHours`
2. **Resposta automática**: toggle + textarea com variável `{{booking_link}}` + select intervalo anti-spam
3. **Mensagem fora do expediente**: toggle + textarea
4. **Parabéns de aniversário**: toggle + textarea + select "Serviço de brinde" (lista de serviços ativos, opcional)
5. **Status diário**: toggle + select de horário (7h / 8h / 9h / 10h)

---

### C3. Chatbot com Detecção de Intenção

**Webhook inbound Evolution API:**
```
POST /api/whatsapp/webhook/[tenantId]
```

**Segurança:** header `x-evolution-signature` com HMAC-SHA256 de `EVOLUTION_WEBHOOK_SECRET`.

**Novo arquivo:** `src/domains/notifications/chatbot/intent-classifier.ts`
```typescript
export type Intent = 'BOOK' | 'CANCEL' | 'PRICE' | 'HOURS' | 'FALLBACK'

const PATTERNS: Record<Exclude<Intent, 'FALLBACK'>, RegExp> = {
  BOOK:   /\b(agendar|marcar|horário|quero agendar|quero marcar|reservar)\b/i,
  CANCEL: /\b(cancelar|desmarcar|cancela|cancelo|não vou|nao vou)\b/i,
  PRICE:  /\b(preço|valor|quanto custa|tabela|valores|cobrança|cobram)\b/i,
  HOURS:  /\b(horário de funcionamento|que horas|abre|fecha|funcionamento)\b/i,
}

export function classifyIntent(text: string): Intent {
  const normalized = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  for (const [intent, regex] of Object.entries(PATTERNS)) {
    if (regex.test(normalized)) return intent as Intent
  }
  return 'FALLBACK'
}
```

**Respostas por intenção:**

| Intent | Resposta |
|---|---|
| `BOOK` | `autoReplyMessage` com `{{booking_link}}` substituído por `{APP_URL}/agendar/{slug}` |
| `CANCEL` | "Para cancelar seu agendamento acesse: {APP_URL}/agendar/{slug} ou ligue para o salão." |
| `PRICE` | Lista dinâmica: query `Service.findMany({ tenantId, isActive: true })` → formata "Serviço: R$ preço" |
| `HOURS` | Horário do dia atual via `Tenant.businessHours` JSON |
| `FALLBACK` | `autoReplyMessage` padrão |

**Lógica completa do webhook handler:**
```
1. Validar HMAC → 401 se inválido
2. Ignorar: mensagens de saída (fromMe=true), delivery receipts, grupos
3. Verificar businessHours do tenant → se fora + offHoursEnabled → responder offHoursMessage
4. Verificar WhatsAppAutoReplyLog: última resposta para este phone < autoReplyIntervalHours → abort (anti-spam)
5. Classificar intenção
6. Buscar dados necessários (tenant, serviços se PRICE, businessHours se HOURS)
7. Responder via Evolution API
8. Persistir WhatsAppAutoReplyLog
```

**Schema:**
```prisma
model WhatsAppAutoReplyLog {
  id        String   @id @default(cuid())
  tenantId  String
  phone     String
  intent    String
  repliedAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, phone, repliedAt])
}
```

**Env var:**
```env
EVOLUTION_WEBHOOK_SECRET=...
```

---

### C4. Parabéns de Aniversário

**Job pg-boss:** cron diário às 07:00 → `birthday:scan`

**Handler:**
```typescript
// Busca tenants com birthdayEnabled e Evolution conectado
// Para cada tenant: query customers WHERE birthDay = hoje (dia+mês)
// Envia birthdayMessage via Evolution
// Se birthdayGiftServiceId: cria GiftVoucher com código único
```

**Schema:**
```prisma
model GiftVoucher {
  id            String    @id @default(cuid())
  tenantId      String
  customerId    String
  serviceId     String
  code          String    @unique @default(cuid())
  validUntil    DateTime
  usedAt        DateTime?
  appointmentId String?
  createdAt     DateTime  @default(now())

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  customer    Customer    @relation(fields: [customerId], references: [id])
  service     Service     @relation(fields: [serviceId], references: [id])

  @@index([tenantId])
  @@index([code])
}
```

Voucher no checkout do agendamento: campo "Código de brinde" → desconto de 100% no serviço vinculado.

---

### C5. Status Diário WhatsApp

**Dependência técnica:** Evolution API suporta `sendStatus` (WhatsApp Status/Story). Verificar na instância antes de implementar — se não suportado, enviar como mensagem de texto broadcast como fallback.

**Job pg-boss:** cron diário por tenant no horário `dailyStatusHour` → `whatsapp:daily-status`

Não postar em dias marcados como fechado no `businessHours` do tenant.

---

### C6. Avisos de Vencimento de Trial/Assinatura

**Job pg-boss:** cron diário às 09:00 → `subscription:expiry-warnings`

**Handler:**
- Subscriptions `TRIALING` com `trialEndsAt` = hoje + 3 → WhatsApp "3 dias restantes no trial"
- Subscriptions `TRIALING` com `trialEndsAt` = hoje + 1 → WhatsApp "último dia do trial"
- Subscriptions `TRIALING` com `trialEndsAt` = hoje → WhatsApp "trial expirado — ative seu plano"
- Subscriptions `PAST_DUE` → WhatsApp diário "pagamento pendente, atualize seu cartão"

Destinatário: Owner do tenant (query `User.findFirst({ tenantId, role: OWNER })`).
`billingService.runExpireSweep()` já faz o downgrade — este job só avisa.

---

## 5. Track D — Admin Panel Completo (Prioridade 3)

### D1. Tenant Detail + Ações Manuais

**URL:** `/admin/tenants/[tenantId]` (não existe — criar)

**Dados exibidos:**
- Dados do negócio: nome, slug, telefone, endereço, criado em
- Plano + status + `trialEndsAt` + `currentPeriodEnd` + `cancelAtPeriodEnd`
- Métricas do mês: agendamentos criados, WhatsApp enviados, clientes cadastrados
- Histórico de mudanças de plano (`SubscriptionHistory`)
- Status Evolution: conectado/desconectado + número

**Ações do admin:**
- **Mudar plano:** SELECT de plano + SELECT de status + "Aplicar" → `billingService.changePlan()`
- **Resetar trial:** dialog de confirmação → nova Subscription TRIALING +14 dias
- **Bloquear tenant:** toggle → `Tenant.isBlocked` — middleware bloqueia login dos usuários
- **Enviar mensagem de sistema:** modal + textarea → WhatsApp para o owner

**Schema — adição ao Tenant:**
```prisma
isBlocked     Boolean @default(false)
blockedReason String?
```

Middleware: `if (tenant.isBlocked) throw new TenantBlockedError()` na inicialização da sessão.

---

### D2. Impersonação de Tenant

**Fluxo:**
1. Admin clica "Visualizar como dono" em `/admin/tenants/[tenantId]`
2. `POST /api/admin/tenants/[id]/impersonate` → JWT assinado com `ADMIN_IMPERSONATE_SECRET` (TTL 30 min), payload `{ tenantId, adminId, isImpersonating: true }`
3. Frontend armazena em `sessionStorage` (não `localStorage` — não persiste ao fechar aba)
4. Toda requisição inclui `X-Impersonate-Token` header
5. Middleware detecta header → valida JWT → injeta `tenantId` no `SessionContext` com `isImpersonating: true`
6. Banner persistente: "Visualizando como **[Nome do Negócio]** — [Encerrar impersonação]"
7. Encerrar: limpa sessionStorage + redireciona para `/admin/tenants/[tenantId]`

**Env var:**
```env
ADMIN_IMPERSONATE_SECRET=...
```

---

### D3. Métricas de Consumo por Tenant

**Job pg-boss:** cron no 1º dia do mês às 01:00 → `usage:snapshot`

**Schema:**
```prisma
model UsageSnapshot {
  id        String   @id @default(cuid())
  tenantId  String
  limitKey  String
  count     Int
  period    String   // "2026-06" (YYYY-MM)
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, limitKey, period])
  @@index([tenantId])
}
```

Métricas capturadas: `appointments_month`, `whatsapp_month`, `customers_total`, `users_total`

**UI:**
- Coluna "Uso" na tabela `/admin/tenants`: barra `agendamentos/mês ÷ limite_do_plano`
- Badge laranja para tenants >80% do limite (candidatos a upgrade)
- Detalhe do tenant: cards por limitKey com barra de progresso

---

### D4. Métricas Financeiras do SaaS (MRR/ARR)

**Disponível após:** Track B1 (Stripe) integrado.
**Fonte:** Stripe API diretamente — não duplicar no banco.

**Dashboard `/admin` (expandir página atual):**
- MRR: `stripe.subscriptions.list({ status: 'active' })` → soma `plan.amount / 100`
- ARR: `MRR * 12`
- Novos pagantes no mês
- Churn no mês
- Taxa trial→pago

Cache TTL 1 hora para não atingir rate limit da Stripe API.

---

## 6. Track E — Features Complementares (Prioridade 3)

### E1. Push Notifications PWA

**Stack:** `web-push@^3` + Service Worker em `public/sw.js`

**Schema:**
```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])
  user   User   @relation(fields: [userId], references: [id])

  @@index([tenantId])
  @@index([userId])
}
```

Eventos que disparam push: `appointment.created`, `appointment.cancelled`, `appointment.no_show`

**Env vars:**
```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:suporte@seuapp.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

**Dependências:** `web-push@^3`, `@types/web-push@^3`

---

### E2. Agendamentos Recorrentes / Horários Fixos

**Schema:**
```prisma
model RecurringSchedule {
  id             String   @id @default(cuid())
  tenantId       String
  customerId     String
  professionalId String
  serviceId      String
  dayOfWeek      Int      // 0=Dom, 1=Seg … 6=Sáb
  timeHour       Int
  timeMinute     Int
  isActive       Boolean  @default(true)
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  customer     Customer @relation(fields: [customerId], references: [id])
  professional User     @relation(fields: [professionalId], references: [id])
  service      Service  @relation(fields: [serviceId], references: [id])

  @@index([tenantId])
  @@index([tenantId, professionalId, dayOfWeek])
}
```

**Job pg-boss:** cron semanal às sextas 18:00 → `recurring:generate-week`
- Para cada RecurringSchedule ativo: calcula horário na semana seguinte
- Verifica se Appointment já existe para o slot (evita duplicata via `singletonKey`)
- Cria Appointment como CONFIRMED + envia WhatsApp ao cliente

---

### E3. Fiado (Crédito Interno)

Sem model novo — implementado sobre a infraestrutura financeira existente.

**Schema — adição ao enum PaymentMethod:**
```prisma
DEBT  // Fiado — pagamento posterior
```

**Fluxo:** no checkout, nova opção "Fiado" → `Transaction{ type: INCOME, paymentMethod: DEBT }`.
Painel: filtro "Fiado pendente" em `/financeiro` → ação "Recebido" → atualiza com data + método real.

---

### E4. NPS Pós-Atendimento

**Pré-requisito:** Track A1 (booking público) — necessário para URL pública de avaliação.

**Schema:**
```prisma
model AppointmentReview {
  id            String    @id @default(cuid())
  tenantId      String
  appointmentId String    @unique
  customerId    String
  rating        Int       // 1–5
  comment       String?
  token         String    @unique @default(cuid())
  respondedAt   DateTime?
  createdAt     DateTime  @default(now())

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  appointment Appointment @relation(fields: [appointmentId], references: [id])
  customer    Customer    @relation(fields: [customerId], references: [id])

  @@index([tenantId])
}
```

**Job:** `appointment.completed` → enfileirar `nps:send` com delay 1h → WhatsApp com link `/avaliar/[token]`
**Rota pública:** `/avaliar/[token]` — 5 estrelas + comentário + token marcado como usado após envio.

---

### E5. Integração Google Calendar

**Classificação: Fase 2 pós-launch** — requer Google Cloud Project, verificação de domínio, OAuth setup.

**Schema (preparação — pode ir já na migration):**
```prisma
// Adicionar em User:
googleCalendarToken  String?
googleCalendarId     String?
googleCalendarSyncAt DateTime?
```

Sync bidirecional por profissional (não por salão). Appointment criado → evento Google; evento deletado → cancela appointment.

---

## 7. Tabela Mestre de Prioridades

| # | Feature | Track | Prioridade | Pré-req | Complexidade |
|---|---|---|---|---|---|
| 1 | Página pública de agendamento (Caminho 1) | A1 | **P1 — Bloqueador** | — | Alta |
| 2 | Políticas de agendamento | A2 | **P1 — Bloqueador** | — | Baixa |
| 3 | Bloqueio de cliente | A3 | **P1** | — | Baixa |
| 4 | Stripe Billing Integration | B1 | **P1 — Bloqueador** | Conta Stripe | Alta |
| 5 | Página pública de planos | B2 | **P1** | — | Média |
| 6 | Onboarding com seleção de plano | B3 | **P1** | B1 | Baixa |
| 7 | Lembrete pré-agendamento (cron) | C1 | **P2** | — | Baixa |
| 8 | Config de automações WA (UI) | C2 | **P2** | C1 | Média |
| 9 | Chatbot com detecção de intenção | C3 | **P2** | C2 + webhook | Média |
| 10 | Parabéns de aniversário | C4 | **P2** | C2 | Baixa |
| 11 | Avisos de vencimento de trial | C6 | **P2** | B1 | Baixa |
| 12 | Status diário WhatsApp | C5 | **P3** | C2 + verificar Evolution | Baixa |
| 13 | Admin: tenant detail + ações | D1 | **P3** | — | Média |
| 14 | Admin: impersonação | D2 | **P3** | D1 | Média |
| 15 | Admin: métricas de consumo | D3 | **P3** | — | Média |
| 16 | Admin: MRR/ARR | D4 | **P3** | B1 | Baixa |
| 17 | Push Notifications PWA | E1 | **P3** | — | Média |
| 18 | Agendamentos recorrentes | E2 | **P3** | — | Média |
| 19 | Fiado | E3 | **P3** | — | Baixa |
| 20 | NPS pós-atendimento | E4 | **P3** | A1 | Média |
| 21 | Orçamentos (Caminho 2 booking) | A1-F2 | **Fase 2** | A1 | Alta |
| 22 | Google Calendar | E5 | **Fase 2** | OAuth setup | Alta |

---

## 8. Consolidado de Schema — Todas as Alterações

### Novos models

```
SchedulingPolicy      (A2)
WhatsAppAutoReplyLog  (C3)
GiftVoucher           (C4)
UsageSnapshot         (D3)
PushSubscription      (E1)
RecurringSchedule     (E2)
AppointmentReview     (E4)
PublicRateLimit       (A1)
```

**PublicRateLimit** — schema completo:
```prisma
model PublicRateLimit {
  id          String   @id @default(cuid())
  ip          String?
  phone       String?
  action      String   // 'appointment' | 'quote'
  count       Int      @default(1)
  windowStart DateTime @default(now())

  @@index([ip, action, windowStart])
  @@index([phone, action, windowStart])
}
```
Job pg-boss cron diário às 03:00 → `public-rate-limit:cleanup` — deleta registros com `windowStart < now() - 2 dias`.

### Models existentes — alterações aditivas

**Service:**
```prisma
priceType  PriceType @default(FIXED)   // A1
priceMin   Decimal?  @db.Decimal(10,2) // A1
priceMax   Decimal?  @db.Decimal(10,2) // A1
```

**Customer:**
```prisma
isBlocked     Boolean  @default(false) // A3
blockedReason String?                  // A3
blockedAt     DateTime?                // A3
```

**Tenant:**
```prisma
// Automações WhatsApp (C2)
autoReplyEnabled        Boolean @default(false)
autoReplyIntervalHours  Int     @default(6)
autoReplyMessage        String?
offHoursEnabled         Boolean @default(false)
offHoursMessage         String?
dailyStatusEnabled      Boolean @default(false)
dailyStatusHour         Int     @default(9)
birthdayEnabled         Boolean @default(false)
birthdayMessage         String?
birthdayGiftServiceId   String?
// Bloqueio admin (D1)
isBlocked               Boolean @default(false)
blockedReason           String?
```

**Subscription (já existe):**
```prisma
stripeCustomerId  String? @unique // B1
stripeSubId       String? @unique // B1
stripePriceId     String?         // B1
cancelAtPeriodEnd Boolean @default(false) // B1
```

**PaymentMethod enum:**
```prisma
DEBT // E3 — fiado
```

**User (preparação Fase 2):**
```prisma
googleCalendarToken  String?    // E5
googleCalendarId     String?    // E5
googleCalendarSyncAt DateTime?  // E5
```

### Novos enums

```prisma
enum PriceType {
  FIXED
  RANGE
  ON_CONSULTATION
}
```

---

## 9. Novas Variáveis de Ambiente

```env
# Track B — Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Track C — Webhook WhatsApp inbound
EVOLUTION_WEBHOOK_SECRET=...

# Track D — Impersonação admin
ADMIN_IMPERSONATE_SECRET=...

# Track E — Push Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:suporte@seuapp.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

---

## 10. Novas Dependências NPM

```json
{
  "stripe": "^14",
  "web-push": "^3",
  "@types/web-push": "^3"
}
```

---

## 11. Checklist de Infraestrutura Pré-Produção (Não-Código)

- [ ] Conta Stripe criada — 3 produtos (STARTER/PRO/ENTERPRISE) com preços mensais configurados
- [ ] `STRIPE_WEBHOOK_SECRET` configurado no Stripe Dashboard → URL: `{PROD_URL}/api/billing/stripe/webhook`
- [ ] Evolution API: instância de produção configurada e acessível
- [ ] `EVOLUTION_WEBHOOK_SECRET` configurado na instância Evolution para webhook inbound
- [ ] VAPID keys geradas: `npx web-push generate-vapid-keys`
- [ ] Bucket `logos` no Supabase Storage com política pública de leitura
- [ ] Todas as env vars acima configuradas na Vercel (produção + staging)
- [ ] DNS e SSL do domínio de produção ativo na Vercel
- [ ] Seeds de produção executados: `npm run seed:admin` + `npm run seed:plan-features`

---

## 12. Critérios de Aceite

### Track A
- [ ] `/agendar/[slug]` funcional em dispositivo mobile, agendamento completo em < 60s
- [ ] Branding do salão carregado sem flash (SSR)
- [ ] WhatsApp de confirmação enviado em < 10s após agendamento
- [ ] Cliente retornante reconhecido pelo telefone
- [ ] Cliente bloqueado recebe mensagem genérica (não revela motivo)
- [ ] `allowPublicBooking = false` retorna 403 na rota pública

### Track B
- [ ] Checkout Stripe funciona em test mode (cartão 4242)
- [ ] Webhook atualiza plano do tenant após `subscription.created`
- [ ] Downgrade para FREE após `subscription.deleted`
- [ ] Página de planos exibe preços e features corretos do banco (SSR)
- [ ] Onboarding cria Stripe Customer mesmo sem cobrança

### Track C
- [ ] Lembrete enviado no horário correto (startsAt - reminderLeadHours)
- [ ] Anti-spam: mesmo número não recebe 2 respostas em menos de `autoReplyIntervalHours`
- [ ] Cada intenção testada manualmente (BOOK, CANCEL, PRICE, HOURS, FALLBACK)
- [ ] Webhook rejeita requisições sem HMAC válido (401)
- [ ] Aniversariante recebe mensagem no dia correto

### Track D
- [ ] Admin muda plano e FeatureGuard reflete imediatamente
- [ ] Impersonação exibe banner visível; permissões são do tenant, não do admin
- [ ] Encerrar impersonação limpa sessionStorage

### Track E
- [ ] Push recebida com navegador fechado (Chrome/Android)
- [ ] Recorrência não cria duplicata no mesmo slot
- [ ] NPS: token não reutilizável após resposta

---

*Próximo passo: invocar `writing-plans` para criar o plano de implementação por track.*
