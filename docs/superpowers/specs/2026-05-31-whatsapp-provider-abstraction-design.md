# WhatsApp Provider Abstraction — Design Spec

**Data:** 2026-05-31  
**Status:** Aprovado para implementação  
**Contexto:** O sistema usa Twilio para envio de mensagens WhatsApp. Esta spec adiciona suporte à Evolution API como provedor primário (gratuito por mensagem, por instância tenant), com Twilio como fallback automático. Adiciona também importação de contatos via QR Code.

---

## Objetivo

Criar uma camada de abstração de provedor WhatsApp que permita:
1. **Evolution API** como provedor primário — gratuito por mensagem, um número próprio por tenant
2. **Twilio** como fallback automático — quando Evolution falha, está banido ou indisponível
3. **Importação de contatos** via WhatsApp conectado (sem precisar cadastrar clientes do zero)
4. **Troca de provedor sem deploy** — variável de ambiente ou config em banco

---

## Arquitetura Geral

```
                    ┌─────────────────────────────────┐
                    │        WhatsAppGateway           │
                    │  (orquestra: primary + fallback)  │
                    └──────────┬──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                                 ▼
  ┌───────────────────┐             ┌───────────────────┐
  │  EvolutionProvider│             │  TwilioProvider   │
  │  (primário)       │             │  (fallback)       │
  │  - send()         │             │  - send()         │
  │  - getContacts()  │             │  (já existe)      │
  │  - getQrCode()    │             └───────────────────┘
  │  - getStatus()    │
  └───────────────────┘
              │
              ▼
  ┌───────────────────┐
  │  Evolution API    │
  │  (Railway/VPS)    │
  │  self-hosted      │
  └───────────────────┘
```

### Regra de fallback

```
tenant.evolutionConnected == true && EVOLUTION_API_URL configurado
    → tenta Evolution API
    → se falhar (erro 5xx, timeout, instância desconectada)
        → loga WARNING no NotificationLog
        → tenta Twilio automaticamente
        → registra qual provedor entregou no campo `provider`

tenant.evolutionConnected == false || sem EVOLUTION_API_URL
    → vai direto para Twilio
```

---

## Provedor Primário: Evolution API

### O que é

Evolution API é uma API REST open-source que controla uma sessão WhatsApp via protocolo não-oficial (Baileys). Cada "instância" representa um número de WhatsApp conectado via QR Code.

### Deploy recomendado

Railway — one-click deploy com PostgreSQL + Redis incluídos.  
**Custo estimado:** R$ 50–150/mês total para todos os tenants.  
**URL:** https://railway.com/deploy/evolution-api-whatsapp

### Variáveis de ambiente necessárias

```env
EVOLUTION_API_URL=https://evolution.seudominio.com   # ou Railway URL
EVOLUTION_API_KEY=sua-chave-de-api-global
WHATSAPP_PROVIDER=evolution                          # evolution | twilio
```

### Estados de instância por tenant

```
DISCONNECTED  → tenant ainda não conectou
CONNECTING    → QR Code exibido, aguardando scan
CONNECTED     → ativo, enviando mensagens
BANNED        → número banido pela Meta — fallback automático para Twilio
ERROR         → erro técnico — fallback automático para Twilio
```

---

## Schema — Alterações no Prisma

### Tenant (adições)

```prisma
model Tenant {
  // ... campos existentes ...
  
  // Evolution API
  evolutionInstanceId  String?   // ID da instância na Evolution API
  evolutionConnected   Boolean   @default(false)
  evolutionStatus      String    @default("DISCONNECTED") // DISCONNECTED | CONNECTING | CONNECTED | BANNED | ERROR
  evolutionConnectedAt DateTime?
  evolutionPhone       String?   // número formatado E.164 quando conectado
}
```

Nenhum campo é obrigatório — tenants sem Evolution API funcionam normalmente com Twilio.

---

## Camada de Abstração — Interface e Gateway

### Interface `IWhatsAppProvider`

```typescript
// src/domains/notifications/providers/whatsapp-provider.interface.ts

export interface SendResult {
  success: boolean;
  externalId?: string;
  errorMessage?: string;
  provider: "evolution" | "twilio";
}

export interface IWhatsAppProvider {
  send(draft: NotificationDraft, tenant: TenantWhatsAppConfig): Promise<SendResult>;
}

export type TenantWhatsAppConfig = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  whatsappEnabled: boolean;
  whatsappTemplateConfig: unknown;
  evolutionInstanceId: string | null;
  evolutionConnected: boolean;
  evolutionStatus: string;
};
```

### `WhatsAppGateway` — orquestra fallback

```typescript
// src/domains/notifications/providers/whatsapp.gateway.ts

export class WhatsAppGateway {
  async send(draft: NotificationDraft): Promise<SendResult> {
    const tenant = await this.fetchTenantConfig(draft.tenantId);
    
    const useEvolution =
      process.env.WHATSAPP_PROVIDER === "evolution" &&
      !!process.env.EVOLUTION_API_URL &&
      tenant.evolutionConnected &&
      tenant.evolutionStatus === "CONNECTED";

    if (useEvolution) {
      const result = await evolutionProvider.send(draft, tenant);
      if (result.success) return result;
      // falhou → tenta Twilio
      logger.warn(`Evolution fallback para Twilio: tenant ${draft.tenantId}`);
    }

    return twilioProvider.send(draft, tenant);
  }
}
```

---

## Evolution API Provider — Envio de Mensagens

### Diferença crítica do Twilio

Twilio usa `contentSid` (templates pré-aprovados).  
Evolution API envia texto livre, sem templates.

A Evolution monta a mensagem completa a partir do mesmo `whatsappTemplateConfig` do tenant, mas concatenando os campos em texto livre:

```typescript
// Exemplo: appointment-created via Evolution
"Olá, João! Seu agendamento foi criado. 📅 28/05 às 14h | Corte | Barbearia X. Até lá! 🔗 link"
```

O `buildEvolutionMessage(template, payload, tenant)` formata o texto usando os mesmos `mensagemPrincipal` e `mensagemFinal` configurados pelo tenant na UI.

### Endpoint da Evolution API usado para envio

```
POST {EVOLUTION_API_URL}/message/sendText/{instanceId}
Headers: { apikey: EVOLUTION_API_KEY }
Body: { number: "5511999999999", text: "mensagem formatada" }
```

---

## Evolution API — Gerenciamento de Instâncias

### API Routes (backend)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/whatsapp/evolution/status` | Status da instância do tenant |
| POST | `/api/whatsapp/evolution/connect` | Cria instância e retorna QR Code |
| DELETE | `/api/whatsapp/evolution/disconnect` | Desconecta e remove instância |
| GET | `/api/whatsapp/evolution/qrcode` | Recarrega QR Code (se expirado) |

### Fluxo de conexão

```
Usuário clica "Conectar WhatsApp" (Settings)
    → POST /api/whatsapp/evolution/connect
        → cria instância na Evolution: POST {EVOLUTION_URL}/instance/create
        → salva evolutionInstanceId no Tenant
        → retorna { qrCode: "base64..." }
    → Frontend exibe QR Code como <img src="data:image/png;base64,...">
    → Usuário escaneia com WhatsApp do celular
    → Evolution chama webhook: POST /api/webhooks/evolution/connection
        → atualiza Tenant.evolutionConnected = true, evolutionStatus = "CONNECTED"
    → Frontend polling GET /api/whatsapp/evolution/status a cada 3s
        → exibe "✅ Conectado como +55 11 99999-9999" quando status = CONNECTED
```

### Webhook da Evolution API

```
POST /api/webhooks/evolution/connection
Body: {
  instance: "tenant-abc123",
  event: "connection.update",
  data: { state: "open" | "close" | "connecting" }
}
```

Mapeia:
- `open` → `CONNECTED`
- `close` → `DISCONNECTED`
- `connecting` → `CONNECTING`

---

## Importação de Contatos

### Como funciona

Com a instância Evolution conectada, é possível buscar os contatos do WhatsApp do tenant via:

```
GET {EVOLUTION_API_URL}/chat/findContacts/{instanceId}
Headers: { apikey: EVOLUTION_API_KEY }
Response: [{ id: "5511999999999@s.whatsapp.net", name: "João Silva", pushName: "João" }]
```

### API Route de importação

```
GET /api/whatsapp/evolution/contacts
  → lista contatos paginados da instância conectada
  → filtra: apenas contatos com número brasileiro válido
  → indica quais já existem no CRM (por phone)

POST /api/crm/contacts/import
Body: { phoneNumbers: ["5511999999999", ...] }
  → para cada número não existente: cria Customer
  → para números já existentes: retorna sem duplicar
  → retorna { created: N, skipped: N, errors: [] }
```

### Modelo de importação

- `Customer.name`: usa `pushName` do WhatsApp (nome de exibição)
- `Customer.phone`: número E.164 (+5511999999999)
- `Customer.consentGiven`: `false` por padrão (LGPD — importação não é consentimento)
- `Customer.consentOrigin`: `"whatsapp_import"`
- Deduplicação: por `phone` dentro do `tenantId` — sem duplicar

---

## Frontend — Settings → Aba WhatsApp

### Estado DISCONNECTED (antes de conectar)

```
┌─────────────────────────────────────────────────────┐
│  📱 Conectar WhatsApp próprio                        │
│  Conecte o número do seu negócio para enviar         │
│  mensagens diretamente do seu WhatsApp.              │
│                                                      │
│  ⚠️ Nota: conexão via QR Code. Mantenha o           │
│  WhatsApp no celular conectado à internet.           │
│                                    [Conectar]        │
└─────────────────────────────────────────────────────┘
```

### Estado CONNECTING (QR Code exibido)

```
┌─────────────────────────────────────────────────────┐
│  📱 Escaneie o QR Code                               │
│                                                      │
│          [ QR CODE IMAGE 200x200 ]                   │
│                                                      │
│  Abra o WhatsApp → Configurações → Aparelhos         │
│  conectados → Conectar aparelho                      │
│                                                      │
│  ⏳ Aguardando conexão...     [Cancelar]             │
└─────────────────────────────────────────────────────┘
```

### Estado CONNECTED

```
┌─────────────────────────────────────────────────────┐
│  ✅ WhatsApp conectado                               │
│  +55 11 99999-9999 · Conectado desde 28/05/2026      │
│                                                      │
│  [Importar contatos]           [Desconectar]         │
└─────────────────────────────────────────────────────┘
```

### Estado BANNED

```
┌─────────────────────────────────────────────────────┐
│  🚫 Número banido pela Meta                          │
│  Mensagens sendo enviadas via Twilio (backup).       │
│  Conecte um novo número para retomar.                │
│                                    [Reconectar]      │
└─────────────────────────────────────────────────────┘
```

### Modal de importação de contatos

```
┌─────────────────────────────────────────────────────┐
│  Importar contatos do WhatsApp                       │
│                                                      │
│  🔍 [buscar por nome ou número...]                   │
│                                                      │
│  ✅ João Silva      +55 11 99999-0001  [no CRM]      │
│  ☐  Maria Souza    +55 11 99999-0002                 │
│  ☐  Carlos Lima    +55 11 99999-0003                 │
│  ☐  Ana Paula      +55 11 99999-0004                 │
│  ...                                                 │
│                                                      │
│  Selecionados: 3    [Importar selecionados]          │
└─────────────────────────────────────────────────────┘
```

---

## Estrutura de Arquivos

```
src/
├── domains/
│   └── notifications/
│       └── providers/
│           ├── whatsapp-provider.interface.ts  ← NOVO: interface IWhatsAppProvider
│           ├── whatsapp.gateway.ts             ← NOVO: orquestra fallback
│           ├── evolution.provider.ts           ← NOVO: implementação Evolution
│           └── whatsapp.provider.ts            ← EXISTENTE: refatorar para implementar interface
│
├── app/
│   └── api/
│       ├── whatsapp/
│       │   └── evolution/
│       │       ├── connect/route.ts            ← NOVO: POST cria instância + retorna QR
│       │       ├── status/route.ts             ← NOVO: GET status da instância
│       │       ├── disconnect/route.ts         ← NOVO: DELETE remove instância
│       │       └── contacts/route.ts           ← NOVO: GET lista contatos do WhatsApp
│       ├── webhooks/
│       │   └── evolution/
│       │       └── connection/route.ts         ← NOVO: webhook de status de conexão
│       └── crm/
│           └── contacts/
│               └── import/route.ts             ← NOVO: POST importa contatos em lote
│
└── components/
    └── domain/
        └── settings/
            ├── evolution-connection.tsx        ← NOVO: QR Code + status de conexão
            └── evolution-contacts-import.tsx   ← NOVO: modal de importação
```

---

## Alterações em Arquivos Existentes

| Arquivo | O que muda |
|---------|-----------|
| `prisma/schema.prisma` | Adicionar 5 campos ao Tenant (evolutionInstanceId, evolutionConnected, evolutionStatus, evolutionConnectedAt, evolutionPhone) |
| `notification.service.ts` | Substituir chamada direta ao `whatsAppProvider` pelo novo `whatsAppGateway` |
| `whatsapp.provider.ts` | Implementar `IWhatsAppProvider`, extrair lógica compartilhada |
| `whatsapp-settings-form.tsx` | Adicionar seção de conexão Evolution (importar `EvolutionConnection`) |
| `configuracoes/page.tsx` | Sem alteração estrutural — a nova UI entra dentro do WhatsAppSettingsForm |

---

## Tratamento de Erros e Monitoramento

### Logs no NotificationLog

O campo `provider` já existente registra qual provedor entregou:
- `"evolution"` — entregue via Evolution
- `"twilio"` — entregue via Twilio (seja primário ou fallback)
- `"evolution→twilio"` — fallback aconteceu (texto útil para monitoramento)

### Erros tratados silenciosamente (sem travar o sistema)

- Evolution API indisponível → fallback Twilio
- QR Code expirado → usuário reconecta
- Contato sem número válido → skip na importação
- Número já existe no CRM → skip silencioso (não é erro)

### Erros que geram alerta na UI

- Número banido (webhook `connection.update` com `state: close` após estava CONNECTED)
- Importação com erro parcial → exibe `{ created: N, skipped: M, errors: K }`

---

## Regras de Negócio

1. **Multi-tenancy:** cada tenant tem sua própria instância Evolution. `evolutionInstanceId` é único por tenant. A Evolution API é compartilhada (um servidor, N instâncias).
2. **Fallback transparente:** o tenant nunca sabe que houve fallback. A UI não muda.
3. **LGPD:** contatos importados têm `consentGiven: false`. O sistema não envia notificações automáticas para clientes sem consentimento (validação já existe em `bulk-reminder`).
4. **Feature gating:** conexão Evolution e importação de contatos requerem plano STARTER ou superior (mesma regra do WhatsApp Básico).
5. **Número banido:** quando a Evolution detecta ban, `evolutionStatus = "BANNED"`, fallback Twilio ativo, UI exibe alerta.

---

## Fora do Escopo desta Spec

- Sincronização contínua de contatos (apenas importação manual)
- Histórico de conversas do WhatsApp
- Chatbot / respostas automáticas via Evolution
- Múltiplos números por tenant
- Suporte a Instagram/Facebook (Evolution API suporta, mas não nesta fase)

---

## Resumo de Implementação (para prompt de novo chat)

**Contexto do projeto:**
- estetica-saas em `c:\dev\estetica-saas`
- Next.js 15 App Router + TypeScript strict + Prisma + Supabase + pg-boss
- WhatsApp atual: Twilio (provider existente em `src/domains/notifications/providers/whatsapp.provider.ts`)
- Evolution API env vars já existem em `src/shared/config/env.ts` (opcionais)
- Spec completa em `docs/superpowers/specs/2026-05-31-whatsapp-provider-abstraction-design.md`

**O que implementar (em ordem):**
1. Schema migration (5 campos no Tenant)
2. Interface `IWhatsAppProvider` + refatorar `TwilioProvider` para implementá-la
3. `EvolutionProvider` (send + getContacts + getQrCode + getStatus)
4. `WhatsAppGateway` com lógica de fallback
5. Substituir `whatsAppProvider` por `whatsAppGateway` no `notification.service.ts`
6. API routes: connect, status, disconnect, contacts (QR Code flow)
7. Webhook `/api/webhooks/evolution/connection`
8. API route de importação de contatos em lote
9. Frontend: `EvolutionConnection` component (QR Code + estados)
10. Frontend: `EvolutionContactsImport` modal
11. Integrar na aba WhatsApp de Configurações

**Padrões obrigatórios:**
- `tenantId` sempre do JWT, nunca do body
- Todo model de negócio tem `@@index([tenantId])`
- Erros tipados de `src/shared/errors/`
- API Routes: `initializeDomainRuntime()` + `getSessionContext()` + `handleApiError()`
- Commits em PT-BR seguindo Conventional Commits
- Branch `feat/whatsapp-evolution-provider`
- PR para `main` ao concluir
