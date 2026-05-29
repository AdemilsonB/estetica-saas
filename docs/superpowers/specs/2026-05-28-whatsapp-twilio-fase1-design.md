# WhatsApp via Twilio — Fase 1: Transacionais + Quota + Config

**Data:** 2026-05-28  
**Status:** Aprovado

---

## Objetivo

Substituir a integração Z-API (não-oficial, free text) pelo WhatsApp Business API oficial via Twilio. Fase 1 cobre mensagens transacionais automáticas (confirmação, lembrete, cancelamento, no-show), rastreamento de quota mensal por plano e configuração mínima de tenant. Campanhas/disparos manuais ficam para Fase 2.

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
| Templates | Fixos na plataforma, variáveis do salão | Aprovação única pela Meta, variáveis dinâmicas para personalização |
| Config tenant | Toggle opt-in simples | Todos os dados necessários já existem no `Tenant`; sem credenciais por tenant |
| Consentimento | Campo `consentGiven` no `Customer` | Para Fase 2 (campanhas MARKETING); transacionais não exigem opt-in explícito |
| Abordagem | Evolução do domínio `notifications` | Infraestrutura de log/retry/subscriptions já funciona; menor escopo |

---

## Modelo de dados

### Alterações no `Tenant`

```prisma
// REMOVER:
zApiInstanceId    String?
zApiToken         String?
whatsappEnabled   Boolean @default(false)

// MANTER (mesmo campo, nova semântica — "tenant optou pelo WhatsApp da plataforma"):
whatsappEnabled   Boolean @default(false)
```

A migration remove `zApiInstanceId` e `zApiToken`. O `whatsappEnabled` permanece com o mesmo nome mas sem dependência de credenciais por tenant.

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

Rastreia envios por tenant/mês para enforçar limites do plano. Reseta via cron no dia 1 de cada mês.

### Alteração em `NotificationLog`

```prisma
// ADICIONAR campo opcional:
externalId  String?   // Twilio Message SID (ex: "SMxxxxxxx")
```

Necessário para o webhook de status localizar o log correto ao receber callbacks do Twilio.

### Alteração em `Customer`

```prisma
// ADICIONAR campos para Phase 2 (campanhas):
consentGiven  Boolean   @default(false)
consentDate   DateTime?
consentOrigin String?   // "balcao" | "formulario" | "import" | "api"
```

Adicionados agora para preparar o CRM para Fase 2. Não são usados na lógica da Fase 1.

---

## Limites por plano

Adicionar `whatsapp_monthly` ao `PLAN_LIMITS` em `feature-guard.ts`:

| Plano | Limite mensal |
|---|---|
| FREE | 0 (sem acesso via `WHATSAPP_BASIC`) |
| STARTER | 500 |
| PRO | 2.000 |
| ENTERPRISE | `-1` (ilimitado, consistente com `appointments_month`) |

---

## Templates Twilio

5 templates pré-registrados na conta Twilio da plataforma. Cada template tem um SID (`HXxxxxxxx`) armazenado em variável de ambiente.

### Textos dos templates

**`confirmacao_agendamento`** (UTILITY)
```
Olá, {{1}}! Seu agendamento foi criado. 📅 {{2}} às {{3}} | Serviço: {{4}} | Local: {{5}}. Até lá!
```

**`agendamento_confirmado`** (UTILITY)
```
✅ Confirmado, {{1}}! Seu agendamento está confirmado. 📅 {{2}} às {{3}} | Serviço: {{4}} | Local: {{5}}. Te esperamos!
```

**`lembrete_agendamento`** (UTILITY)
```
Olá, {{1}}! 👋 Lembrete: amanhã você tem horário às {{2}} para {{3}} no {{4}}. Até lá!
```

**`cancelamento_agendamento`** (UTILITY)
```
Olá, {{1}}. Seu agendamento de {{2}} no {{3}} foi cancelado. Para reagendar, entre em contato conosco.
```

**`nao_comparecimento`** (UTILITY)
```
Olá, {{1}}! 😕 Notamos que você não compareceu ao seu horário de {{2}} no {{3}}. Quando quiser reagendar, estamos à disposição!
```

### Mapeamento de variáveis

| Template | {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|---|---|---|---|---|---|
| confirmacao / confirmado | nome cliente | data (DD/MM/AAAA) | hora (HH:mm) | serviço | nome salão |
| lembrete | nome cliente | hora (HH:mm) | serviço | nome salão | — |
| cancelamento | nome cliente | serviço | nome salão | — | — |
| nao_comparecimento | nome cliente | serviço | nome salão | — | — |

O **nome do salão** vem de `Tenant.name`. O link de agendamento fica embutido no texto fixo do template como `https://[dominio]/agendar/{slug}` — não precisa de variável porque o domínio é único da plataforma. Para Fase 2 (campanhas), o link entra como variável.

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

---

## Arquitetura — Provider Twilio

### Fluxo de envio

```
Evento de domínio (scheduling.appointment.created, etc.)
  → notifications/subscriptions.ts  (já existe, troca provider "z-api" → "twilio")
  → notificationService.logAndDispatch()  (já existe)
  → WhatsAppProvider.send(draft)  (substituição completa)
      1. featureGuard.assertAccess(tenantId, FEATURES.WHATSAPP_BASIC)
      2. prisma.tenant (whatsappEnabled, name, slug)
         └─ se !whatsappEnabled → retorna PENDING (sem erro)
      3. whatsAppQuotaService.checkAndIncrement(tenantId)
         └─ se quota excedida → retorna FAILED "Limite mensal atingido"
      4. buildTemplateParams(template, payload, tenant)
         └─ seleciona contentSid + monta variables Record<string, string>
      5. twilio.messages.create({ from, to, contentSid, contentVariables, statusCallback })
         └─ retry automático max 2x com delay 1s em erro de rede
      6. retorna { status: SENT, externalId: message.sid }
```

### Formato do `to`

Telefones armazenados como `+5511999999999` (E.164) ou `11999999999` (local). O provider normaliza para E.164 e adiciona o prefixo `whatsapp:`:

```typescript
function toWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const e164 = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
  return `whatsapp:${e164}`;
}
```

---

## Quota service

```typescript
// src/domains/notifications/quota/whatsapp-quota.service.ts

async checkAndIncrement(tenantId: string): Promise<boolean>
// Retorna true se pode enviar, false se limite atingido.
// Usa upsert atômico: cria ou incrementa o registro do mês corrente.
// Verifica o limite APÓS o increment e reverte se ultrapassado.
// ENTERPRISE retorna sempre true (limit = -1).

async getUsage(tenantId: string): Promise<{ used: number; limit: number; resetDate: string }>
// Retorna uso atual e data de reset (1º do próximo mês).
```

---

## Cron de reset mensal

Job pg-boss `"whatsapp-quota-reset"` em `src/shared/queue/jobs/whatsapp-quota-reset.ts`.

- Schedule: `"1 0 1 * *"` (dia 1 de cada mês, 00:01 UTC)
- Ação: `UPDATE "WhatsAppMonthlyUsage" SET count = 0 WHERE year = X AND month = Y`
- Registrado em `runtime.ts`

---

## Webhook de status Twilio

**Endpoint:** `POST /api/webhooks/twilio/status`  
**Autenticação:** Validação de assinatura Twilio (`X-Twilio-Signature`) — sem JWT

### Fluxo

```
Twilio → POST /api/webhooks/twilio/status
  Body (application/x-www-form-urlencoded):
    MessageSid, MessageStatus, To, From, ErrorCode (opcional)

  1. Valida X-Twilio-Signature com twilio.validateRequest()
     └─ falha → 403
  2. Mapeia status:
     "queued" | "sent"         → SENT
     "delivered"               → SENT   (confirmação de entrega)
     "failed" | "undelivered"  → FAILED
  3. prisma.notificationLog.updateMany({
       where: { externalId: MessageSid },
       data: { status, errorMessage: ErrorCode }
     })
  4. Retorna 204
```

A URL do webhook precisa ser registrada no Twilio Console: `https://[APP_URL]/api/webhooks/twilio/status`.

---

## API de uso

**Endpoint:** `GET /api/whatsapp/usage`  
**Auth:** JWT, roles OWNER e MANAGER

```typescript
// Response:
{
  used: number,        // mensagens enviadas no mês corrente
  limit: number,       // limite do plano (-1 = ilimitado)
  resetDate: string,   // "AAAA-MM-DD" — primeiro dia do próximo mês
  plan: PlanName       // "STARTER" | "PRO" | "ENTERPRISE"
}
```

---

## Frontend mínimo — Fase 1

### Componente `WhatsAppUsageCard`

Exibido na página **Configurações → Notificações** (já existe), abaixo do toggle `whatsappEnabled`:

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

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Modifica: remove Z-API fields do Tenant, adiciona `WhatsAppMonthlyUsage`, `externalId` no `NotificationLog`, campos consent no `Customer` |
| `src/domains/notifications/providers/whatsapp.provider.ts` | Substitui completamente (Z-API → Twilio) |
| `src/domains/notifications/quota/whatsapp-quota.service.ts` | Cria |
| `src/domains/notifications/quota/whatsapp-quota.service.test.ts` | Cria |
| `src/shared/queue/jobs/whatsapp-quota-reset.ts` | Cria |
| `src/app/api/webhooks/twilio/status/route.ts` | Cria |
| `src/app/api/whatsapp/usage/route.ts` | Cria |
| `src/domains/billing/feature-guard.ts` | Modifica: adiciona `whatsapp_monthly` ao `PLAN_LIMITS` |
| `src/app/api/_lib/runtime.ts` | Modifica: registra job de reset |
| `src/domains/notifications/types.ts` | Modifica: adiciona `externalId?: string` a `NotificationDeliveryResult` |
| `src/domains/notifications/notification.service.ts` | Modifica: passa `externalId` ao `createLog` após envio |
| `src/domains/notifications/subscriptions.ts` | Modifica: troca `provider: "z-api"` → `provider: "twilio"` |
| `src/shared/queue/jobs/appointment-reminder.ts` | Modifica: troca `provider: "z-api"` → `provider: "twilio"` |
| `src/components/domain/settings/whatsapp-usage-card.tsx` | Cria |
| `src/shared/test/factories/whatsapp-usage.factory.ts` | Cria |

---

## Fora de escopo (Fase 2)

- Disparos manuais de campanha/promoção
- Tela de histórico de mensagens
- Templates MARKETING
- Uso do campo `consentGiven` (adicionado ao modelo agora, lógica na Fase 2)
- Tela de lista de clientes com opt-in

---

## Checklist de conclusão

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] Migration aplicada sem erros
- [ ] `zApiInstanceId` e `zApiToken` removidos do schema
- [ ] `externalId` no `NotificationLog` populado após envio
- [ ] Webhook valida `X-Twilio-Signature` antes de processar
- [ ] Quota bloqueia envio quando limite atingido
- [ ] Cron de reset registrado no runtime
