# WhatsApp via Twilio — Fase 1: Transacionais + Quota + Config

**Data:** 2026-05-28 (revisado: 2026-05-29, verificado: 2026-05-29)
**Status:** Aprovado — revisado por análise arquitetural + verificação de fluxo completo

---

## Objetivo

Substituir a integração Z-API (não-oficial, free text) pelo WhatsApp Business API oficial via Twilio. Fase 1 cobre mensagens transacionais automáticas (confirmação, lembrete, cancelamento, no-show), templates com variáveis customizáveis por tenant, rastreamento de quota mensal por plano e configuração de tenant. Campanhas/disparos manuais ficam para Fase 2.

---

## Contexto do sistema

- **Stack:** Next.js 15 App Router, Prisma, Supabase/PostgreSQL, pg-boss, Zod, TypeScript strict
- **Planos ativos:** STARTER, PRO, ENTERPRISE (FREE não tem WhatsApp)
- **Infraestrutura de notificações existente:** `NotificationLog`, `logAndDispatch`, subscriptions por evento, pg-boss para reminder 24h
- **Provider atual:** Z-API — credenciais por tenant (`zApiInstanceId`, `zApiToken`), free text, não-oficial
- **Feature gate existente:** `WHATSAPP_BASIC` (Starter+), `WHATSAPP_PREMIUM` (Pro+), `CAMPAIGNS` (Starter+)

---

## Decisões de design

| Decisão | Escolha | Motivo |
|---|---|---|
| Provider | Twilio (oficial) | API oficial Meta, templates pré-aprovados, SLA garantido |
| Conta Twilio | Plataforma (`.env`) | Uma conta SaaS, todos os tenants compartilham o número |
| Templates | Mais variáveis (Opção A) | Admin customiza partes do texto via tela; aprovação única pela Meta |
| Config tenant | Toggle opt-in + editor de templates | `whatsappEnabled` + `whatsappTemplateConfig` JSON no Tenant |
| Consentimento | Campo `consentGiven` no `Customer` | Para Fase 2 (campanhas MARKETING); transacionais não exigem opt-in explícito |
| Abordagem | Evolução do domínio `notifications` | Infraestrutura de log/retry/subscriptions já funciona; menor escopo |
| Timezone | Campo `timezone` no Tenant | Evita erro de fuso horário nas datas enviadas ao cliente |
| Status entrega | Enum com `DELIVERED` | Distingue "enviado à operadora" de "confirmado no dispositivo" para suporte |
| Quota | `maxWhatsAppPerMonth` em `billing/types.ts` | Fonte única de verdade; elimina duplicação com `maxNotificationsPerMonth` |

---

## Modelo de dados

### Alterações no `Tenant`

```prisma
// REMOVER:
zApiInstanceId    String?
zApiToken         String?

// MANTER (mesma semântica — tenant optou pelo WhatsApp da plataforma):
whatsappEnabled   Boolean @default(false)

// ADICIONAR:
timezone              String  @default("America/Sao_Paulo")
whatsappTemplateConfig Json?
// Estrutura de whatsappTemplateConfig:
// {
//   "confirmacao": { "mensagemPrincipal": "...", "mensagemFinal": "..." },
//   "confirmado":  { "mensagemPrincipal": "...", "mensagemFinal": "..." },
//   "lembrete":    { "mensagemPrincipal": "...", "mensagemFinal": "..." },
//   "cancelamento":{ "mensagemPrincipal": "...", "mensagemFinal": "..." },
//   "nao_comparecimento": { "mensagemPrincipal": "...", "mensagemFinal": "..." }
// }
```

A migration remove `zApiInstanceId` e `zApiToken`. `whatsappEnabled`, `timezone` e `whatsappTemplateConfig` permanecem/são adicionados. Tenants existentes herdam `timezone = "America/Sao_Paulo"` como default.

### Atualização no enum `NotificationStatus`

```prisma
enum NotificationStatus {
  PENDING
  SENT       // Aceito pela operadora
  DELIVERED  // NOVO — confirmado no dispositivo do destinatário
  FAILED
}
```

### Novo model: `WhatsAppMonthlyUsage`

```prisma
model WhatsAppMonthlyUsage {
  id        String   @id @default(cuid())
  tenantId  String
  year      Int
  month     Int      // 1-12
  count     Int      @default(0)
  updatedAt DateTime @updatedAt

  @@unique([tenantId, year, month])
  @@index([tenantId])
}
```

Rastreia envios por tenant/mês. O upsert por `(tenantId, year, month)` isola automaticamente cada mês — registros novos começam em 0 sem necessidade de reset. O cron faz apenas limpeza de histórico antigo.

### Alteração em `NotificationLog`

```prisma
// ADICIONAR campo opcional:
externalId  String?   // Twilio Message SID (ex: "SMxxxxxxx")
```

Necessário para o webhook de status localizar o log correto ao receber callbacks do Twilio.

### Alteração em `Customer`

```prisma
// ADICIONAR campos para Fase 2 (campanhas):
consentGiven  Boolean   @default(false)
consentDate   DateTime?
consentOrigin String?   // "balcao" | "formulario" | "import" | "api"
```

Adicionados agora para preparar o CRM para Fase 2. Não são usados na lógica da Fase 1.

### Atualização em `billing/types.ts`

Renomear `maxNotificationsPerMonth` para `maxWhatsAppPerMonth` e atualizar os limites:

| Plano | `maxWhatsAppPerMonth` |
|---|---|
| FREE | 0 |
| STARTER | 500 |
| PRO | 2.000 |
| ENTERPRISE | 5.000 |

Fonte única de verdade para quota de WhatsApp. `feature-guard.ts` lê de `billing/types.ts`.

---

## Templates Twilio

5 templates pré-registrados na conta Twilio da plataforma. Cada template tem um SID (`HXxxxxxxx`) armazenado em variável de ambiente. Templates usam mais variáveis para permitir customização por tenant via tela administrativa.

### Textos dos templates (estrutura aprovada pela Meta)

**`confirmacao_agendamento`** (UTILITY)
```
Olá, {{1}}! {{2}} 📅 {{3}} às {{4}} | {{5}} | {{6}}. {{7}} {{8}}
```

**`agendamento_confirmado`** (UTILITY)
```
✅ {{1}}, {{2}}! 📅 {{3}} às {{4}} | {{5}} | {{6}}. {{7}} {{8}}
```

**`lembrete_agendamento`** (UTILITY)
```
Olá, {{1}}! 👋 {{2}} Amanhã às {{3}} para {{4}} no {{5}}. {{6}}
```

**`cancelamento_agendamento`** (UTILITY)
```
Olá, {{1}}. {{2}} {{3}} | {{4}}. {{5}}
```

**`nao_comparecimento`** (UTILITY)
```
Olá, {{1}}! 😕 {{2}} {{3}} | {{4}}. {{5}}
```

### Mapeamento de variáveis

| Variável | confirmacao / confirmado | lembrete | cancelamento | nao_comparecimento |
|---|---|---|---|---|
| {{1}} | nome cliente | nome cliente | nome cliente | nome cliente |
| {{2}} | mensagemPrincipal* | mensagemPrincipal* | mensagemPrincipal* | mensagemPrincipal* |
| {{3}} | data DD/MM/AAAA | hora HH:mm | serviço | serviço |
| {{4}} | hora HH:mm | serviço | nome salão | nome salão |
| {{5}} | serviço | nome salão | mensagemFinal* | mensagemFinal* |
| {{6}} | nome salão | mensagemFinal* | — | — |
| {{7}} | mensagemFinal* | — | — | — |
| {{8}} | link de agendamento | — | — | — |

`*` = variável customizável pelo admin tenant via `whatsappTemplateConfig`

**Valores padrão** (usados quando o tenant não customizou):

| Template | mensagemPrincipal padrão | mensagemFinal padrão |
|---|---|---|
| confirmacao | "Seu agendamento foi criado." | "Até lá!" |
| confirmado | "Seu agendamento está confirmado." | "Te esperamos!" |
| lembrete | "Lembrete:" | "Até lá!" |
| cancelamento | "Seu agendamento foi cancelado." | "Para reagendar, entre em contato conosco." |
| nao_comparecimento | "Notamos que você não compareceu ao seu horário." | "Quando quiser reagendar, estamos à disposição!" |

**Link de agendamento** (`{{8}}` em confirmacao/confirmado):
```typescript
`${process.env.APP_URL}/agendar/${tenant.slug}`
```

### Variáveis de ambiente

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+5511XXXXXXXXX
APP_URL=https://seu-dominio.com

# Template SIDs (obtidos após aprovação no Twilio Console)
TWILIO_TPL_CONFIRMATION=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TPL_CONFIRMED=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TPL_REMINDER=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TPL_CANCELLATION=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TPL_NO_SHOW=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Ambiente de desenvolvimento — Twilio Sandbox:**
```env
# .env.development — sem necessidade de templates aprovados pela Meta
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```
Para ativar o sandbox: enviar "join [palavra-chave]" para o número `+14155238886` via WhatsApp antes de testar.

---

## Arquitetura — Provider Twilio

### `buildTemplateParams`

**Estrutura real do payload** (flat — como efetivamente chega via `NotificationDraft.payload`):

```typescript
type AppointmentNotificationPayload = {
  appointmentId: string;
  customerName: string;   // customer.name — campo plano, não aninhado
  serviceName: string;    // service.name — campo plano, não aninhado
  startsAt?: string;      // ISO string — presente em confirmacao/confirmado/lembrete
                          // AUSENTE em cancelamento e nao_comparecimento
  status?: string;        // presente em cancelamento/nao_comparecimento
};

type WhatsAppTemplateConfig = {
  mensagemPrincipal?: string;
  mensagemFinal?: string;
};

function buildTemplateParams(
  template: WhatsAppTemplate,
  payload: AppointmentNotificationPayload,
  tenant: { name: string; slug: string; timezone: string; whatsappTemplateConfig: unknown }
): { contentSid: string; contentVariables: Record<string, string> }
```

> **Atenção:** O payload é flat (`customerName`, `serviceName`), não aninhado. Isso é diferente do formato do evento de domínio — o `logAndDispatch` recebe os campos já extraídos.

**Formatação de datas com timezone do tenant:**
```typescript
const formatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: tenant.timezone,  // ex: "America/Sao_Paulo", "America/Manaus"
  day: "2-digit", month: "2-digit", year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: tenant.timezone,
  hour: "2-digit", minute: "2-digit",
});
// startsAt é string ISO — converter com new Date(payload.startsAt)
// Somente para templates: confirmacao, confirmado, lembrete
// Nunca acessar startsAt para cancelamento/nao_comparecimento (campo ausente)
```

**Mapeamento de payload para variáveis por template:**

| Variável | confirmacao/confirmado | lembrete | cancelamento/nao_comparecimento |
|---|---|---|---|
| `{{1}}` | `payload.customerName` | `payload.customerName` | `payload.customerName` |
| `{{2}}` | `templateConfig.mensagemPrincipal` | `templateConfig.mensagemPrincipal` | `templateConfig.mensagemPrincipal` |
| `{{3}}` | `formatDate(startsAt, tz)` | `formatTime(startsAt, tz)` | `payload.serviceName` |
| `{{4}}` | `formatTime(startsAt, tz)` | `payload.serviceName` | `tenant.name` |
| `{{5}}` | `payload.serviceName` | `tenant.name` | `templateConfig.mensagemFinal` |
| `{{6}}` | `tenant.name` | `templateConfig.mensagemFinal` | — |
| `{{7}}` | `templateConfig.mensagemFinal` | — | — |
| `{{8}}` | `` `${APP_URL}/agendar/${tenant.slug}` `` | — | — |

**Validação de SIDs na inicialização:**
```typescript
// Chamado uma vez ao importar o provider — falha rápido se env vars faltam
const REQUIRED_SIDS = [
  "TWILIO_TPL_CONFIRMATION", "TWILIO_TPL_CONFIRMED",
  "TWILIO_TPL_REMINDER", "TWILIO_TPL_CANCELLATION", "TWILIO_TPL_NO_SHOW",
] as const;

REQUIRED_SIDS.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`[WhatsAppProvider] Env var ${key} não configurada`);
  }
});
```
Isso previne que o sistema vá ao ar com template SIDs faltando — o erro aparece no startup, não silenciosamente no primeiro envio.

### Validação de telefone

```typescript
function toWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Brasil: DDI(2) + DDD(2) + número(8 ou 9) = 12 ou 13 dígitos
  if (digits.length < 10 || digits.length > 13) {
    throw new InvalidPhoneError(raw);
  }
  const e164 = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
  return `whatsapp:${e164}`;
}
```

`InvalidPhoneError` em `src/shared/errors/invalid-phone.error.ts` — erro tipado, não falha silenciosa.

### Fluxo de envio

```
Evento de domínio (scheduling.appointment.created, etc.)
  → notifications/subscriptions.ts  (troca provider "z-api" → "twilio")
  → notificationService.logAndDispatch()
  → WhatsAppProvider.send(draft)
      1. featureGuard.assertAccess(tenantId, FEATURES.WHATSAPP_BASIC)
      2. prisma.tenant (whatsappEnabled, name, slug, timezone, whatsappTemplateConfig)
         └─ se !whatsappEnabled → retorna PENDING (sem erro)
      3. toWhatsAppNumber(draft.recipient)
         └─ lança InvalidPhoneError se número inválido → retorna FAILED
      4. whatsAppQuotaService.checkAndIncrement(tenantId)
         └─ se quota excedida → retorna FAILED "Limite mensal atingido"
      5. buildTemplateParams(template, payload, tenant)
         └─ seleciona contentSid + monta variables com timezone correto
      6. twilio.messages.create({ from, to, contentSid, contentVariables, statusCallback })
         └─ retry automático max 2x com delay 1s em erro de rede
         └─ se todos os retries falham: whatsAppQuotaService.decrement(tenantId)
      7. retorna { status: SENT, externalId: message.sid }
```

**Rollback de quota:** `decrement(tenantId)` é chamado apenas em falha de rede (exceção ao criar mensagem no Twilio). Se o Twilio aceita a mensagem mas ela falha na entrega (webhook com `failed/undelivered`), a quota permanece consumida — falha da operadora, não da plataforma.

---

## Quota service

```typescript
// src/domains/notifications/quota/whatsapp-quota.service.ts

async checkAndIncrement(tenantId: string): Promise<boolean>
// Retorna true se pode enviar, false se limite atingido.
// Usa upsert atômico: cria ou incrementa o registro do mês corrente.
// Verifica o limite APÓS o increment e reverte se ultrapassado.
// Lê maxWhatsAppPerMonth de billing/types.ts para o plano do tenant.

async decrement(tenantId: string): Promise<void>
// NOVO — rollback de quota em caso de falha de rede do provider.
// Decrementa count do mês corrente (mínimo 0).

async getUsage(tenantId: string): Promise<{ used: number; limit: number; resetDate: string }>
// Retorna uso atual e data de reset (1º do próximo mês).
```

---

## Cron de limpeza de histórico

Job pg-boss `"whatsapp-quota-cleanup"` em `src/shared/queue/jobs/whatsapp-quota-reset.ts`.

- Schedule: `"0 2 1 * *"` (dia 1 de cada mês, 02:00 UTC)
- Ação: deletar registros com mais de 12 meses de histórico
```sql
DELETE FROM "WhatsAppMonthlyUsage"
WHERE (year * 12 + month) < ((current_year * 12 + current_month) - 12)
```
- Justificativa: o upsert por `(tenantId, year, month)` já isola cada mês automaticamente — não é necessário zerar registros existentes. O cron serve apenas para controle de crescimento da tabela.
- Registrado em `runtime.ts`

---

## Webhook de status Twilio

**Endpoint:** `POST /api/webhooks/twilio/status`
**Autenticação:** Validação de assinatura Twilio (`X-Twilio-Signature`) — sem JWT
**Rate limiting:** 100 req/min por IP (middleware antes da validação de assinatura)

### Mapeamento de status

| Status Twilio | `NotificationStatus` |
|---|---|
| `queued` | `SENT` |
| `sent` | `SENT` |
| `delivered` | `DELIVERED` |
| `failed` | `FAILED` |
| `undelivered` | `FAILED` |

### Fluxo

```
Twilio → POST /api/webhooks/twilio/status
  Body (application/x-www-form-urlencoded):
    MessageSid, MessageStatus, To, From, ErrorCode (opcional)

  1. Rate limiting por IP → 429 se excedido
  2. Valida X-Twilio-Signature com twilio.validateRequest()
     └─ falha → 403
  3. Mapeia status (tabela acima)
  4. prisma.notificationLog.updateMany({
       where: { externalId: MessageSid },
       data: { status, errorMessage: ErrorCode ?? null }
     })
  5. Retorna 204
```

A URL do webhook precisa ser registrada no Twilio Console: `https://[APP_URL]/api/webhooks/twilio/status`.

---

## API de uso

**Endpoint:** `GET /api/whatsapp/usage`
**Auth:** JWT, roles OWNER e MANAGER
**Feature gate:** `featureGuard.assertAccess(tenantId, FEATURES.WHATSAPP_BASIC)` antes de retornar dados

```typescript
// Response:
{
  used: number,        // mensagens enviadas no mês corrente
  limit: number,       // limite do plano (maxWhatsAppPerMonth)
  resetDate: string,   // "AAAA-MM-DD" — primeiro dia do próximo mês
  plan: PlanName       // "STARTER" | "PRO" | "ENTERPRISE"
}
```

---

## API de templates

**Endpoint:** `GET /api/whatsapp/templates` — retorna config atual + defaults
**Endpoint:** `PUT /api/whatsapp/templates` — salva config no `Tenant.whatsappTemplateConfig`
**Auth:** JWT, role OWNER

```typescript
// PUT body (Zod schema):
{
  template: "confirmacao" | "confirmado" | "lembrete" | "cancelamento" | "nao_comparecimento",
  mensagemPrincipal: string,  // máx. 120 chars
  mensagemFinal: string,      // máx. 80 chars
}
```

---

## Frontend — Fase 1

### Componente `WhatsAppUsageCard`

Exibido na página **Configurações → Notificações**, abaixo do toggle `whatsappEnabled`:

```
┌─────────────────────────────────────────┐
│ 📊 Mensagens WhatsApp este mês          │
│                                         │
│  ████████░░░░  347 / 500                │
│                                         │
│  Renova em 01/06/2026                   │
│  Plano: Starter                         │
└─────────────────────────────────────────┘
```

- Visível apenas se `whatsappEnabled = true`
- Consome `GET /api/whatsapp/usage`
- Barra de progresso muda para vermelho acima de 90% do limite

### Componente `WhatsAppTemplateEditor`

Exibido abaixo do `WhatsAppUsageCard`, visível apenas se `whatsappEnabled = true`:

```
┌─────────────────────────────────────────────────────┐
│ ✏️ Personalizar mensagens WhatsApp                   │
│                                                      │
│ [Confirmação de agendamento ▾]                       │
│                                                      │
│ Mensagem principal:                                  │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Seu agendamento foi criado com sucesso.          │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ Mensagem de encerramento:                            │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Até lá!                                          │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ Prévia:                                              │
│ "Olá, João! Seu agendamento foi criado com sucesso.  │
│  📅 28/05/2026 às 14:00 | Corte | Barbearia Silva.   │
│  Até lá! https://app.com/agendar/barbearia-silva"    │
│                                                      │
│              [Salvar personalização]                  │
└─────────────────────────────────────────────────────┘
```

- Dropdown para selecionar qual template editar
- Preview em tempo real com dados fictícios
- Consome `GET /api/whatsapp/templates` e salva via `PUT /api/whatsapp/templates`
- Campos com limite de caracteres (mensagemPrincipal: 120, mensagemFinal: 80)

---

## Mapa de arquivos

> Arquivos marcados com ⚠️ são **existentes** que precisam ser modificados mas estavam ausentes em versões anteriores da spec.

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Modifica: remove Z-API fields do Tenant; adiciona `timezone`, `whatsappTemplateConfig`; adiciona `WhatsAppMonthlyUsage`; adiciona `externalId` no `NotificationLog`; adiciona `DELIVERED` ao enum `NotificationStatus`; adiciona campos consent no `Customer` |
| `src/domains/billing/types.ts` | Modifica: renomeia `maxNotificationsPerMonth` → `maxWhatsAppPerMonth`; atualiza limites (STARTER=500, PRO=2000, ENTERPRISE=5000) |
| `src/domains/billing/feature-guard.ts` | Modifica: lê `maxWhatsAppPerMonth` de `billing/types.ts` para quota |
| `src/domains/notifications/providers/whatsapp.provider.ts` | Substitui completamente (Z-API → Twilio; `buildTemplateParams` com payload flat, timezone, phone validation, quota rollback, validação de SIDs na inicialização) |
| `src/domains/notifications/providers/whatsapp.provider.test.ts` | Cria (mock Twilio SDK, featureGuard, quota) |
| `src/domains/notifications/quota/whatsapp-quota.service.ts` | Cria (`checkAndIncrement`, `decrement`, `getUsage`) |
| `src/domains/notifications/quota/whatsapp-quota.service.test.ts` | Cria |
| `src/shared/queue/jobs/whatsapp-quota-reset.ts` | Cria (cron de limpeza de histórico > 12 meses, não reset de quota) |
| `src/app/api/webhooks/twilio/status/route.ts` | Cria (rate limiting + validação assinatura + mapeamento DELIVERED) |
| `src/app/api/webhooks/twilio/status/route.test.ts` | Cria |
| `src/app/api/whatsapp/usage/route.ts` | Cria (com feature gate WHATSAPP_BASIC) |
| `src/app/api/whatsapp/usage/route.test.ts` | Cria |
| `src/app/api/whatsapp/templates/route.ts` | Cria (`GET` + `PUT` para config de templates) |
| `src/domains/notifications/types.ts` | Modifica: adiciona `externalId?: string` a `NotificationDeliveryResult` |
| `src/domains/notifications/notification.service.ts` | Modifica: passa `externalId` ao `createLog` após envio |
| `src/domains/notifications/subscriptions.ts` | Modifica: troca `provider: "z-api"` → `provider: "twilio"` |
| `src/shared/queue/jobs/appointment-reminder.ts` | Modifica: troca `provider: "z-api"` → `provider: "twilio"` |
| `src/shared/errors/invalid-phone.error.ts` | Cria (`InvalidPhoneError` tipado) |
| `src/components/domain/settings/whatsapp-usage-card.tsx` | Cria |
| `src/components/domain/settings/whatsapp-template-editor.tsx` | Cria (dropdown de templates + campos editáveis + preview em tempo real) |
| `src/shared/test/factories/whatsapp-usage.factory.ts` | Cria |
| `src/app/api/_lib/runtime.ts` | Modifica: registra job de limpeza de histórico |
| ⚠️ `src/app/api/notifications/settings/route.ts` | Modifica (ARQUIVO EXISTENTE): reescreve schema Zod — remove `zApiInstanceId`/`zApiToken`, adiciona `timezone` ao GET e PATCH; valida que apenas tenants STARTER+ podem ativar `whatsappEnabled` |
| ⚠️ `src/components/domain/settings/whatsapp-settings-form.tsx` | Modifica (ARQUIVO EXISTENTE): remove campos Instance ID e Token; adiciona seletor de `timezone`; adiciona guard de plano — exibe mensagem de upgrade para tenants FREE ao invés do toggle |

---

## Comportamentos conhecidos e documentados

### Reminders de agendamentos existentes ao ativar WhatsApp

Quando um tenant ativa `whatsappEnabled = true`, os agendamentos já criados **não recebem lembrete automático**. O `scheduleAppointmentReminder` é chamado apenas no momento da criação do agendamento e somente se `whatsappEnabled = true` naquele momento — tanto para agendamentos criados pelo profissional no sistema quanto para agendamentos criados pelo cliente via portal público (quando construído).

**Impacto:** Agendamentos criados antes da ativação do WhatsApp não enviam lembrete 24h. Somente novos agendamentos criados após a ativação recebem o reminder.

**Comportamento esperado e aceito para Fase 1.** Não há erro — apenas ausência de reminder para agendamentos pré-existentes.

### Link de agendamento no template (`{{8}}`)

O link `APP_URL/agendar/{slug}` aponta para o **portal de agendamento público** — feature da Fase 2. O template inclui a variável `{{8}}` já preparada. Enquanto o portal não existir, o link leva a uma página 404.

**Dependência:** Antes do go-live em produção com templates aprovados pela Meta, o portal precisa existir ou a variável `{{8}}` deve ser omitida dos templates de confirmação. Em desenvolvimento (sandbox Twilio), o comportamento é aceitável.

---

## Fora de escopo (Fase 2)

- Disparos manuais de campanha/promoção
- Tela de histórico de mensagens por tenant
- Templates MARKETING
- Uso do campo `consentGiven` (adicionado ao modelo agora, lógica na Fase 2)
- Tela de lista de clientes com opt-in
- Per-tenant template registration (sub-accounts Twilio)

---

## Checklist de conclusão

**Schema e migration:**
- [ ] Migration aplicada sem erros
- [ ] `zApiInstanceId` e `zApiToken` removidos do schema
- [ ] `timezone` adicionado ao Tenant com default `"America/Sao_Paulo"`
- [ ] `DELIVERED` adicionado ao enum `NotificationStatus`
- [ ] `whatsappTemplateConfig` adicionado ao Tenant
- [ ] `externalId` no `NotificationLog` populado após envio

**Provider e envio:**
- [ ] `buildTemplateParams` usa payload flat (`customerName`, `serviceName`, `startsAt?`) — não aninhado
- [ ] `buildTemplateParams` formata datas com `tenant.timezone` via `Intl.DateTimeFormat`
- [ ] `buildTemplateParams` não acessa `startsAt` para templates `cancelamento`/`nao_comparecimento`
- [ ] Provider valida SIDs na inicialização — erro explícito se env vars faltam
- [ ] `toWhatsAppNumber` lança `InvalidPhoneError` para números inválidos
- [ ] Valores padrão de templates aplicados quando tenant não customizou
- [ ] Templates `confirmacao`/`confirmado` com variável `{{8}}` para link de agendamento

**Quota e infra:**
- [ ] Quota bloqueia envio quando limite atingido
- [ ] Quota reverte (`decrement`) em caso de falha de rede do provider
- [ ] Cron de limpeza registrado no runtime (histórico > 12 meses)
- [ ] `billing/types.ts` atualizado com `maxWhatsAppPerMonth` e limites corretos

**Webhook:**
- [ ] Webhook valida `X-Twilio-Signature` antes de processar
- [ ] Webhook atualiza `DELIVERED` corretamente
- [ ] Webhook tem rate limiting (100 req/min por IP)

**APIs:**
- [ ] `GET /api/whatsapp/usage` tem feature gate `WHATSAPP_BASIC`
- [ ] `GET /api/whatsapp/templates` e `PUT /api/whatsapp/templates` implementados
- [ ] `/api/notifications/settings` (EXISTENTE) reescrito — remove Z-API, adiciona `timezone`; bloqueia `whatsappEnabled = true` para plano FREE

**Frontend:**
- [ ] `whatsapp-settings-form.tsx` (EXISTENTE) reescrito — remove campos Z-API, adiciona seletor de timezone, guard de plano para FREE
- [ ] `WhatsAppUsageCard` exibe uso correto
- [ ] Template editor salva e carrega via `/api/whatsapp/templates`

**Testes:**
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando (provider + webhook + usage + quota)

**Entrega:**
- [ ] Tenants existentes com `whatsappEnabled = true` comunicados sobre migração Z-API → Twilio
- [ ] `.env.development` documentado com Twilio Sandbox (`whatsapp:+14155238886`)
- [ ] Link `{{8}}` nos templates documentado como dependência do portal público (Fase 2)
- [ ] Security Agent executado — nenhum item 🔴 CRÍTICO
- [ ] Pull Request aberta para `main`
