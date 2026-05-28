# Design — Automação WhatsApp via API Oficial Meta

**Data:** 2026-05-28  
**Status:** Aprovado — aguardando plano de implementação  
**Branch alvo:** `feat/whatsapp-meta-api`

---

## Contexto e motivação

O SaaS atualmente usa Z-API (serviço informal) para enviar notificações de agendamento via WhatsApp. Esta implementação substitui completamente o Z-API pela **Meta Cloud API oficial**, e adiciona um **motor de automação relacional** completo — campanhas de aniversário, reativação de clientes inativos, pós-atendimento, e qualquer regra baseada em evento ou tempo.

O objetivo é comunicação legítima, de baixa frequência, altamente personalizada — com toda a infraestrutura de consentimento, anti-spam, engajamento e histórico necessária para manter boa reputação junto à Meta.

---

## Decisões arquiteturais

| Decisão | Escolha | Motivo |
|---|---|---|
| Modelo WABA | Per-tenant (cada empresa tem conta Meta própria) | Simplicidade, sem necessidade de BSP |
| Billing de mensagens | Meta cobra o tenant diretamente | Zero risco financeiro para o SaaS |
| Provider | Migração completa — Meta API substitui Z-API | Uma plataforma só, sem manutenção dupla |
| Onboarding Meta | Caminho A — System User token manual | Adequado para MVP; Embedded Signup (Caminho C) reservado para escalar |
| Scheduler | pg-boss (já instalado) | Já na stack; sem infraestrutura adicional |
| Comunicação entre domínios | eventBus exclusivamente — sem imports diretos | Padrão da codebase |

---

## Arquitetura de domínios

### Estrutura de pastas

```
src/domains/
├── whatsapp/                           ← NOVO — plataforma WhatsApp
│   ├── meta-api/
│   │   ├── meta.client.ts             ← HTTP client Meta Cloud API v21
│   │   └── meta.webhooks.ts           ← parser + validação HMAC-SHA256
│   ├── templates/
│   │   ├── template.repository.ts
│   │   ├── template.service.ts
│   │   └── schemas.ts
│   ├── anti-spam/
│   │   └── antispam.service.ts
│   ├── engagement/
│   │   └── engagement.service.ts
│   ├── subscriptions.ts               ← escuta automation.action.requested
│   └── types.ts
│
├── automation/                         ← CONSTRUÍDO — motor de regras
│   ├── automation.repository.ts
│   ├── automation.service.ts          ← avalia triggers + condições
│   ├── automation.scheduler.ts        ← pg-boss cron diário
│   ├── subscriptions.ts              ← escuta eventos de domínio
│   └── types.ts                       ← expande stub existente
│
├── notifications/                      ← MANTIDO — thin dispatcher
│   └── providers/
│       └── whatsapp.provider.ts        ← delega para whatsapp domain
│
└── crm/                                ← ESTENDIDO — consentimento + birthDate
    └── customer.repository.ts
```

### Separação de responsabilidades

| Domínio | Responsabilidade | Não faz |
|---|---|---|
| `automation` | O quê, quando, para quem — avalia regras, encontra elegíveis, publica ações | Não sabe como enviar |
| `whatsapp` | Como enviar — Meta API, templates, anti-spam, entrega, engagement | Não decide quem recebe |
| `notifications` | Dispatcher fino para eventos transacionais | Sem lógica de negócio |
| `crm` | Dados do cliente: consent, birthDate, score | Não envia mensagens |

---

## Fluxos principais

### Fluxo 1 — Evento transacional (ex: agendamento criado)

```
scheduling.appointment.created
        ↓
automation/subscriptions.ts         ← busca regras ativas para este trigger
automation.service.ts               ← avalia condições + cooldown + janela horária
        ↓ publica
automation.action.requested {
  tenantId, ruleId, action: "send_whatsapp",
  templateId, customerId, variables
}
        ↓
whatsapp/subscriptions.ts
antispam.service.ts                 ← camadas de proteção
meta.client.ts                      ← POST /messages Meta Cloud API
WhatsAppMessage criado (status: QUEUED → SENT)
        ↓ webhook assíncrono Meta
meta.webhooks.ts                    ← delivered / read / failed
engagement.service.ts              ← atualiza score
```

### Fluxo 2 — Campanha temporal (ex: cliente inativo 60 dias)

```
pg-boss cron: "0 9 * * *"
        ↓
automation.scheduler.ts
  ├── busca tenants com WhatsApp ativo
  ├── para cada tenant → regras time-based ativas
  ├── para cada regra → busca clientes elegíveis (CustomerRepository)
  └── publica boss.send("process-automation-action") por cliente individual
        ↓
boss.work("process-automation-action")
        ↓
automation.service.evaluateTimeTrigger()
        ↓ (mesmo fluxo acima a partir de automation.action.requested)
```

**Por que job individual:** falha de um cliente não afeta os demais; retry automático; rastreabilidade granular no `AutomationExecution`.

---

## Modelos de banco de dados

### Modificações em modelos existentes

**`Tenant`** — remoção de campos Z-API:
```prisma
// REMOVER:
zApiInstanceId    String?
zApiToken         String?
whatsappEnabled   Boolean @default(false)
// ADICIONAR relação:
whatsappConfig    WhatsAppConfig?
```

**`Customer`** — extensão para automações:
```prisma
birthDate         DateTime?
lastAppointmentAt DateTime?          // atualizado via evento appointment.completed
whatsappOptOut    Boolean   @default(false)
consentGiven      Boolean   @default(false)
consentDate       DateTime?
consentOrigin     String?             // "import" | "formulario" | "balcao" | "api"
// relações:
whatsappMessages  WhatsAppMessage[]
engagementScore   WhatsAppEngagement?
```

### Novos modelos

**`WhatsAppConfig`** — credenciais Meta por tenant:
```prisma
model WhatsAppConfig {
  id               String   @id @default(cuid())
  tenantId         String   @unique
  phoneNumberId    String
  wabaId           String
  accessToken      String
  displayPhone     String
  verifyToken      String
  connectionMethod String   @default("manual")  // "manual" | "embedded_signup" (futuro)
  active           Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId])
}
```

**`WhatsAppTemplate`** — templates com status de aprovação Meta:
```prisma
model WhatsAppTemplate {
  id              String                   @id @default(cuid())
  tenantId        String
  metaTemplateId  String?
  name            String
  category        WhatsAppTemplateCategory
  language        String                   @default("pt_BR")
  headerText      String?
  bodyText        String
  footerText      String?
  buttons         Json?
  variables       Json                     // [{ index, description }]
  status          WhatsAppTemplateStatus   @default(DRAFT)
  rejectionReason String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, name])
  @@index([tenantId])
  @@index([tenantId, status])
}

enum WhatsAppTemplateCategory { MARKETING  UTILITY  AUTHENTICATION }
enum WhatsAppTemplateStatus   { DRAFT  PENDING_APPROVAL  APPROVED  REJECTED  PAUSED }
```

**`AutomationRule`** — concretiza stub existente com campos de controle:
```prisma
model AutomationRule {
  id            String   @id @default(cuid())
  tenantId      String
  name          String
  trigger       String   // "appointment.created" | "customer.inactive" | "customer.birthday" | ...
  conditions    Json     // [{ field, operator, value }]
  templateId    String?
  variables     Json     // [{ templateVar, source, value? }]
  active        Boolean  @default(true)
  cooldownDays  Int      @default(30)
  maxPerMonth   Int      @default(2)
  sendHourStart Int      @default(8)
  sendHourEnd   Int      @default(20)
  inactiveDays  Int?     // para trigger customer.inactive
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  executions    AutomationExecution[]
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId])
  @@index([tenantId, trigger, active])
}
```

**`AutomationExecution`** — histórico granular por regra + cliente:
```prisma
model AutomationExecution {
  id            String                   @id @default(cuid())
  tenantId      String
  ruleId        String
  customerId    String
  messageId     String?
  status        AutomationExecutionStatus
  skippedReason String?                  // "cooldown" | "optout" | "blacklist" | "fora_janela" | "frequency_limit"
  executedAt    DateTime @default(now())
  rule          AutomationRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  @@index([tenantId])
  @@index([ruleId, customerId])
  @@index([tenantId, executedAt])
}

enum AutomationExecutionStatus { SUCCESS  FAILED  SKIPPED }
```

**`WhatsAppMessage`** — histórico completo de mensagens:
```prisma
model WhatsAppMessage {
  id             String               @id @default(cuid())
  tenantId       String
  customerId     String?
  templateId     String?
  metaMessageId  String?              @unique
  recipient      String
  templateName   String
  variables      Json
  status         WhatsAppMessageStatus @default(QUEUED)
  sentAt         DateTime?
  deliveredAt    DateTime?
  readAt         DateTime?
  failedAt       DateTime?
  failureReason  String?
  origin         String               // "automation" | "transactional" | "manual"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  customer       Customer? @relation(fields: [customerId], references: [id])
  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId])
  @@index([tenantId, status])
  @@index([metaMessageId])
  @@index([tenantId, customerId])
}

enum WhatsAppMessageStatus { QUEUED  SENT  DELIVERED  READ  FAILED }
```

**`WhatsAppEngagement`** — score de engajamento por cliente (0-100):
```prisma
model WhatsAppEngagement {
  id           String    @id @default(cuid())
  tenantId     String
  customerId   String    @unique
  score        Int       @default(50)
  totalSent    Int       @default(0)
  totalRead    Int       @default(0)
  totalReplied Int       @default(0)
  blockedAt    DateTime?
  lastSentAt   DateTime?
  updatedAt    DateTime  @updatedAt
  customer     Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  @@index([tenantId])
  @@index([tenantId, score])
}
```

---

## Meta Cloud API — operações implementadas

### `meta.client.ts`

```typescript
// 5 operações:
sendTemplate(config, to, { name, language, components })   → { messageId }
submitTemplate(config, payload)                            → { metaTemplateId, status }
getTemplateStatus(config, metaTemplateId)                  → { status, rejectionReason? }
checkPhone(config, phone)                                  → { valid, waId? }
deleteTemplate(config, templateName)                       → void
```

Todas as chamadas usam `Authorization: Bearer {accessToken}` e endpoint base `https://graph.facebook.com/v21.0`.

### `meta.webhooks.ts`

**GET** `/api/webhooks/whatsapp` — verificação Meta (hub.challenge)  
**POST** `/api/webhooks/whatsapp` — eventos de status (valida `X-Hub-Signature-256`)

Eventos processados:
- `message_status: sent | delivered | read | failed` → atualiza `WhatsAppMessage`
- `incoming_message` → detecta opt-out keywords; atualiza `Customer.whatsappOptOut`
- `message_failed` → atualiza status + `failureReason` + score de engagement

### Onboarding do tenant (Caminho A — MVP)

```
1. Tenant acessa Configurações → WhatsApp
2. Segue guia para gerar System User token no Meta Business Manager
3. Preenche: Phone Number ID / WABA ID / Access Token
4. Sistema salva em WhatsAppConfig (active: false) + gera verifyToken único
5. Tenant configura webhook na Meta: URL + verifyToken
6. Meta faz GET de verificação → sistema valida → active: true
```

`connectionMethod: "manual"` gravado. Migração futura para `"embedded_signup"` sem reescrita do modelo.

---

## Motor de automação

### Triggers disponíveis

**Event-based** (avaliados em tempo real via eventBus):
- `appointment.created` — confirmação de agendamento
- `appointment.completed` — pós-atendimento
- `appointment.cancelled` — reagendamento
- `appointment.no_show` — recuperação
- `customer.created` — boas-vindas

**Time-based** (avaliados pelo scheduler pg-boss, cron `0 9 * * *`):
- `customer.inactive` — `lastAppointmentAt < hoje - N dias`
- `customer.birthday` — `birthDate.month == hoje.month AND birthDate.day == hoje.day`
- `customer.return_window` — `lastAppointmentAt == hoje - N dias` (janela de retorno)

### Mapeamento de variáveis

```typescript
// Configuração na AutomationRule.variables:
[
  { templateVar: "1", source: "customer.name" },
  { templateVar: "2", source: "rule.inactiveDays", transform: "toString" },
  { templateVar: "3", source: "static", value: "15%" }
]
// resolveVariables() produz: { "1": "João", "2": "60", "3": "15%" }
```

### Scheduler pg-boss

```typescript
// Job diário: identifica elegíveis e enfileira individualmente
boss.schedule("automation-daily-scan", "0 9 * * *", handler)

// Worker por ação individual (falha isolada, retry automático)
boss.work("process-automation-action", handler)
```

---

## Anti-spam — três camadas de proteção

Avaliado em `antispam.service.ts` antes de qualquer envio:

| Camada | Verificação | Motivo de bloqueio |
|---|---|---|
| 1 — Bloqueio imediato | `whatsappOptOut`, `blockedAt`, `score ≤ 10`, `consentGiven = false` | `optout` / `blacklist` / `low_score` / `no_consent` |
| 2 — Frequência | Campanhas enviadas no mês atual ≥ `rule.maxPerMonth` | `frequency_limit` |
| 3 — Cooldown | `AutomationExecution` recente para o par ruleId + customerId | `cooldown` |

Cooldown da automação é verificado em `automation.service.ts` antes mesmo do anti-spam (redundância intencional).

### Opt-out por palavra-chave

Palavras detectadas no `incoming_message`: `SAIR`, `PARAR`, `STOP`, `CANCELAR`, `DESCADASTRAR` (case-insensitive).  
Resultado: `Customer.whatsappOptOut = true`, registrado com motivo `opt_out_keyword`.

---

## Engagement scoring

Score inicial: **50** (neutro). Range: 0-100.

| Evento | Delta |
|---|---|
| Mensagem entregue (`delivered`) | +1 |
| Mensagem lida (`read`) | +5 |
| Cliente respondeu | +10 |
| 3 mensagens consecutivas ignoradas | -5 |
| Cliente bloqueou | -50 (mínimo 0) |
| Cliente reportou spam | -100 → score = 0 + `blockedAt` |

Score ≤ 10: envios suspensos automaticamente (camada 1 do anti-spam).

---

## API Routes

```
# Configuração WhatsApp
GET    /api/iam/whatsapp/config
POST   /api/iam/whatsapp/config

# Templates
GET    /api/whatsapp/templates
POST   /api/whatsapp/templates
POST   /api/whatsapp/templates/:id/submit
GET    /api/whatsapp/templates/:id/status
DELETE /api/whatsapp/templates/:id

# Webhook Meta (público, sem auth de tenant)
GET    /api/webhooks/whatsapp
POST   /api/webhooks/whatsapp

# Automações
GET    /api/automation/rules
POST   /api/automation/rules
PATCH  /api/automation/rules/:id
DELETE /api/automation/rules/:id

# Histórico
GET    /api/whatsapp/messages
```

---

## Frontend — telas e componentes

### Páginas

| Rota | Descrição |
|---|---|
| `/configuracoes/whatsapp` | Setup wizard com guia passo a passo para conectar conta Meta |
| `/whatsapp/templates` | Listagem + criação + status de aprovação de templates |
| `/whatsapp/automacoes` | Listagem + criação/edição de regras de automação |
| `/whatsapp/historico` | Histórico de mensagens com filtros + métricas de entrega |

### Extensões em telas existentes

| Tela | Adição |
|---|---|
| Cadastro/importação de clientes (CRM) | `ConsentCheckbox` com declaração de autorização + origem |
| Perfil do cliente | `birthDate`, status WhatsApp, `EngagementScore`, botão opt-out |

### Componentes novos

| Componente | Localização |
|---|---|
| `WhatsAppSetupWizard` | `components/domain/whatsapp/setup-wizard.tsx` |
| `TemplateEditor` | `components/domain/whatsapp/template-editor.tsx` |
| `TemplateStatusBadge` | `components/domain/whatsapp/template-status-badge.tsx` |
| `AutomationRuleForm` | `components/domain/whatsapp/automation-rule-form.tsx` |
| `MessageHistoryTable` | `components/domain/whatsapp/message-history-table.tsx` |
| `WhatsAppMetrics` | `components/domain/whatsapp/whatsapp-metrics.tsx` |
| `ConsentCheckbox` | `components/domain/crm/consent-checkbox.tsx` |
| `EngagementScore` | `components/domain/crm/engagement-score.tsx` |

---

## Fases de implementação sugeridas

### Fase 1 — Fundação (banco + Meta API + templates)
- Migration Prisma: novos modelos + modificações em Tenant e Customer
- `meta.client.ts` + `meta.webhooks.ts`
- `WhatsAppConfig` repository + service + API routes
- `WhatsAppTemplate` repository + service + API routes
- Webhook handler (`/api/webhooks/whatsapp`)
- Tela de configuração + tela de templates (frontend)

### Fase 2 — Motor de automação
- `automation.repository.ts` + `automation.service.ts`
- `automation.scheduler.ts` (pg-boss setup + jobs)
- `automation/subscriptions.ts`
- `whatsapp/subscriptions.ts` (escuta `automation.action.requested`)
- API routes de automações
- Tela de automações (frontend)

### Fase 3 — Anti-spam, engagement e histórico
- `antispam.service.ts`
- `engagement.service.ts`
- Processamento de opt-out por webhook
- `WhatsAppMessage` repository + service
- Tela de histórico + métricas (frontend)

### Fase 4 — CRM + consentimento
- Campos de consentimento + birthDate no Customer
- `ConsentCheckbox` no cadastro/importação
- `EngagementScore` no perfil do cliente
- `lastAppointmentAt` atualizado via evento `appointment.completed`

---

## O que este design NÃO cobre (fora de escopo)

- **Embedded Signup (Caminho C)** — reservado para escalar; arquitetura preparada via `connectionMethod`
- **Envio manual avulso de mensagem** — pode ser adicionado como extensão da Fase 3
- **Respostas bidirecionais (chatbot)** — fora de escopo; `incoming_message` só é usado para opt-out
- **Templates de autenticação (OTP)** — fora de escopo do MVP
- **Email como canal** — estrutura do `automation` suporta `send_email` como ação futura

---

## Checklist de entrega (por fase)

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] Security Agent — nenhum item 🔴 CRÍTICO
- [ ] Webhook valida `X-Hub-Signature-256` antes de processar
- [ ] `tenantId` em todos os novos modelos
- [ ] Nenhuma query sem filtro de `tenantId`
- [ ] `accessToken` não retornado em nenhuma API response (campo sensível)
- [ ] Opt-out respeitado em todas as camadas
- [ ] PR aberta para `main` ao final de cada fase
