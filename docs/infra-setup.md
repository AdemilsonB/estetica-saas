# Infraestrutura do Agendê — Guia de Configuração

> Documento vivo. Atualizar sempre que uma nova integração, serviço ou variável for adicionada.
> Última atualização: 2026-07-02

---

## Visão geral — Como os serviços se conectam

```
Usuário final (browser / mobile)
        │
        ▼
  Cloudflare DNS          ← gerencia DNS de agendeweb.com.br
        │
        ▼
  Vercel (Next.js)        ← hospeda o frontend + API Routes + Cron Jobs
        │
        ├── Supabase ─────────────────── banco PostgreSQL + Auth + Storage
        │       └── SMTP via Resend ─── emails de autenticação
        │
        ├── Resend ──────────────────── emails transacionais (confirmação,
        │                               lembrete, cancelamento)
        │
        ├── Evolution API ────────────── WhatsApp (primário)
        │       └── Twilio ──────────── WhatsApp (fallback)
        │
        ├── Stripe ──────────────────── pagamentos e assinaturas
        │
        └── pg-boss (sobre o Supabase) ── filas de jobs assíncronos
                └── Vercel Cron (/api/cron/tick a cada 1 min)
```

---

## 1. Registro.br

**Papel:** registrar e manter o domínio `agendeweb.com.br`.

### Configuração de nameservers (delegar DNS ao Cloudflare)

1. Acesse [registro.br](https://registro.br) → login → `agendeweb.com.br`
2. Clique em **DNS → Alterar Servidores DNS**
3. Substitua os nameservers padrão pelos do Cloudflare:

| Campo | Valor |
|---|---|
| Servidor 1 | `christina.ns.cloudflare.com` |
| Servidor 2 | `craig.ns.cloudflare.com` |

4. Salve. Propagação: 1–2 horas.

> **Atenção:** após delegar ao Cloudflare, toda gestão de DNS passa a ser feita lá — o Registro.br só mantém o cadastro do domínio.

---

## 2. Cloudflare

**Papel:** DNS authoritativo do domínio. Gratuito, sem proxy ativo (DNS only para Vercel + email).

### Registros DNS atuais

| Tipo | Nome | Conteúdo | Proxy | Observação |
|---|---|---|---|---|
| A | `@` | `216.198.79.1` | DNS only | Apex → Vercel |
| CNAME | `www` | `b57679ea3d97990b.vercel-dns-017.com` | DNS only | www → Vercel |
| MX | `@` | `.` | DNS only | Null MX (bloqueia recebimento no root) |
| TXT | `@` | `v=spf1 -all` | DNS only | SPF root (bloqueia envio do root) |
| TXT | `_dmarc` | `v=DMARC1; p=reject;` | DNS only | DMARC |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3...` (chave DKIM do Resend) | DNS only | DKIM para Resend |
| MX | `send` | `feedback-smtp.sa-east-1.amazonses.com` | DNS only | Bounce tracking Resend (pri 10) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | DNS only | SPF do subdomínio de envio Resend |

> **Regra:** registros de email e Vercel devem ser sempre **DNS only** (nuvem cinza). Nunca ativar o proxy (nuvem laranja) para esses registros.

### Como adicionar novo registro DNS

1. Cloudflare Dashboard → `agendeweb.com.br` → **DNS → Records**
2. **+ Add record** → preencher Type / Name / Content / Proxy status
3. Salvar

---

## 3. Vercel

**Papel:** hospedagem do Next.js (frontend + API Routes + Cron Jobs).

### Domínios configurados

| Domínio | Tipo | Destino |
|---|---|---|
| `agendeweb.com.br` | A record | Redireciona 308 → `www.agendeweb.com.br` |
| `www.agendeweb.com.br` | CNAME | Production (app principal) |
| `estetica-saas-product.vercel.app` | automático | Production (fallback Vercel) |

### Cron Jobs

Configurado em `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/tick", "schedule": "* * * * *" }]
}
```

O endpoint `/api/cron/tick` executa todos os jobs do pg-boss a cada minuto. Autenticado via `Authorization: Bearer $CRON_SECRET` (injetado automaticamente pelo Vercel).

### Variáveis de ambiente (Production)

> Configurar em: Vercel → Project → Settings → Environment Variables

| Variável | Descrição | Onde obter |
|---|---|---|
| `DATABASE_URL` | Conexão pooled (Prisma runtime) | Supabase → Settings → Database → Transaction pooler |
| `DIRECT_URL` | Conexão direta (Prisma migrations) | Supabase → Settings → Database → Direct connection |
| `SUPABASE_URL` | URL do projeto Supabase | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_URL` | Mesmo valor (público) | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Chave pública anon | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Mesmo valor (público) | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (secreta) | Supabase → Settings → API |
| `AUTH_JWT_SECRET` | Segredo JWT | Supabase → Settings → API → JWT Settings |
| `PUBLIC_SESSION_SECRET` | Assina cookie do portal do cliente | Gerar: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | URL pública do app | `https://www.agendeweb.com.br` |
| `APP_URL` | URL base (webhooks, deep-links) | `https://www.agendeweb.com.br` |
| `RESEND_API_KEY` | API key do Resend | Resend → API Keys |
| `EMAIL_FROM` | Remetente de emails | `noreply@agendeweb.com.br` |
| `CRON_SECRET` | Autentica o endpoint de cron | Injetado automaticamente pelo Vercel |
| `STRIPE_SECRET_KEY` | Chave secreta Stripe | Stripe → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Segredo do webhook Stripe | Stripe → Developers → Webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave pública Stripe | Stripe → Developers → API Keys |
| `STRIPE_PRICE_STARTER_MONTHLY` | Price ID do plano Starter | Stripe → Products |
| `STRIPE_PRICE_PRO_MONTHLY` | Price ID do plano Pro | Stripe → Products |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` | Price ID do plano Enterprise | Stripe → Products |
| `ADMIN_API_SECRET` | Autenticação do backoffice admin | Gerar valor aleatório forte |
| `ADMIN_IMPERSONATE_SECRET` | Tokens de impersonação (mín 32 chars) | Gerar: `openssl rand -base64 32` |
| `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` | Número de suporte na landing | Ex: `5511999999999` |
| `GOOGLE_PLACES_API_KEY` | Habilita nota Google na vitrine (opcional) | Google Cloud Console |
| `EVOLUTION_API_URL` | URL base da instância Evolution API | Ex: `https://evolution.agendeweb.com.br` |
| `EVOLUTION_API_KEY` | API key global da instância | Painel Evolution API |
| `TWILIO_ACCOUNT_SID` | SID da conta Twilio (fallback WhatsApp) | Twilio Console |
| `TWILIO_AUTH_TOKEN` | Token da conta Twilio | Twilio Console |
| `TWILIO_WHATSAPP_FROM` | Número Twilio WhatsApp | Ex: `whatsapp:+14155238886` |
| `PG_BOSS_SCHEMA` | Schema do pg-boss no banco | `pgboss` |

---

## 4. Supabase

**Papel:** banco PostgreSQL gerenciado + Auth (JWT, sessions, email) + Storage.

### Configurações de Auth

Acesse: Supabase → Authentication

- **Confirm email:** ativado (usuários precisam confirmar email)
- **Sign In Providers:** Email habilitado

### SMTP customizado (emails de auth via Resend)

Acesse: Supabase → Authentication → Emails → SMTP Settings

| Campo | Valor |
|---|---|
| Enable custom SMTP | ON |
| Sender email | `noreply@agendeweb.com.br` |
| Sender name | `Agendê` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | API Key do Resend (`re_...`) |

> A API Key usada aqui deve ter permissão de "Sending access" no Resend para o domínio `agendeweb.com.br`.

### Migrations e schema

- ORM: Prisma com `prisma migrate deploy` (via `buildCommand` no Vercel ou CI)
- Schema pg-boss: criado automaticamente pelo pg-boss na primeira execução (`pgboss`)

---

## 5. Resend

**Papel:** envio de emails transacionais da aplicação (confirmação de agendamento, lembrete, cancelamento).

### Domínio verificado

- `agendeweb.com.br` — Status: **Verified**
- Região: São Paulo (`sa-east-1`)

### API Keys

| Nome | Permissão | Uso |
|---|---|---|
| `Agendê App` | Sending access | Variável `RESEND_API_KEY` no Vercel |
| `Supabase SMTP` | Sending access | Password do SMTP no Supabase Auth |

> Criar nova chave em: Resend → API Keys → **+ Create API key**
> Atenção: o valor completo só aparece no momento da criação — salvar imediatamente.

### Como verificar novo domínio no Resend

1. Resend → Domains → **+ Add Domain**
2. Digitar o domínio (ex: `agendeweb.com.br`), selecionar região São Paulo
3. Copiar os 3 registros DNS gerados (DKIM TXT + MX send + TXT send)
4. Adicionar no Cloudflare (DNS only)
5. Clicar em **Verify DNS Records** no Resend
6. Aguardar status virar **Verified** (minutos a 1h)

---

## 6. Evolution API (WhatsApp — primário)

**Papel:** gateway WhatsApp principal. Self-hosted (Railway, Render ou VPS).

### Setup básico

1. Deploy da imagem `atendai/evolution-api` (ou fork oficial)
2. Configurar variáveis no host:
   - `AUTHENTICATION_API_KEY` — chave global de acesso à API
   - `DATABASE_PROVIDER` — `postgresql` (recomendado para produção)
   - `DATABASE_CONNECTION_URI` — string de conexão PostgreSQL separada do Supabase
3. Após deploy, criar instância via API:

```bash
POST /instance/create
{
  "instanceName": "agendeweb",
  "token": "<token-da-instância>",
  "qrcode": true
}
```

4. Escanear QR Code com o WhatsApp Business do estabelecimento
5. Adicionar ao `.env` / Vercel:

| Variável | Valor |
|---|---|
| `EVOLUTION_API_URL` | URL do deploy (ex: `https://evolution.agendeweb.com.br`) |
| `EVOLUTION_API_KEY` | Chave global configurada no deploy |

### Webhooks

Configurar webhook para receber status de mensagens:

```
POST /webhook/set/<instanceName>
{
  "url": "https://www.agendeweb.com.br/api/webhooks/whatsapp",
  "events": ["MESSAGES_UPDATE", "SEND_MESSAGE"]
}
```

---

## 7. Twilio (WhatsApp — fallback)

**Papel:** fallback quando Evolution API está indisponível.

### Configuração

1. Criar conta em [twilio.com](https://twilio.com)
2. Ativar o add-on WhatsApp Business API
3. Obter as credenciais em **Console → Account Info**:
   - `Account SID` → `TWILIO_ACCOUNT_SID`
   - `Auth Token` → `TWILIO_AUTH_TOKEN`
4. Número de envio → `TWILIO_WHATSAPP_FROM` (ex: `whatsapp:+14155238886`)
5. Templates aprovados pela Meta → `TWILIO_TPL_*`

---

## 8. Stripe

**Papel:** pagamentos e gestão de assinaturas dos planos SaaS.

### Configuração

1. Criar conta em [stripe.com](https://stripe.com)
2. **Developers → API Keys:**
   - `Secret key` (sk_live_...) → `STRIPE_SECRET_KEY`
   - `Publishable key` (pk_live_...) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. **Developers → Webhooks → Add endpoint:**
   - URL: `https://www.agendeweb.com.br/api/billing/webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Signing secret → `STRIPE_WEBHOOK_SECRET`
4. **Products** → criar os 3 planos (Starter, Pro, Enterprise) com preços mensais
   - Price IDs → `STRIPE_PRICE_*_MONTHLY`

---

## 9. pg-boss + Vercel Cron

**Papel:** filas de jobs assíncronos (lembretes, sweep de billing, aniversários, etc.).

### Como funciona

- pg-boss roda sobre o banco PostgreSQL do Supabase (schema `pgboss`)
- Em serverless (Vercel), o scheduler não roda continuamente
- Solução: Vercel Cron chama `/api/cron/tick` a cada minuto
- O endpoint faz `boss.fetch()` dos jobs pendentes e executa manualmente

### Jobs registrados

| Job | Frequência | Descrição |
|---|---|---|
| `appointment-reminder` | contínuo | Lembretes de agendamento |
| `billing-expire-sweep` | diário | Expira assinaturas vencidas |
| `birthday-reminder` | diário | Parabéns para clientes aniversariantes |
| `daily-status` | diário | Resumo diário do estabelecimento |
| `recurring-expense` | mensal | Lança despesas recorrentes |
| `vip-sweep` | semanal | Recalcula clientes VIP |
| `subscription-expiry-warnings` | diário | Avisa assinaturas prestes a vencer |
| `usage-snapshot` | diário | Snapshot de uso para billing |
| `whatsapp-quota-cleanup` | mensal (dia 1, 02:00 UTC) | Remove registros antigos de quota WhatsApp |

### Autenticação do Cron

O Vercel injeta `CRON_SECRET` automaticamente. O endpoint valida:

```
Authorization: Bearer <CRON_SECRET>
```

Localmente, sem a variável, o endpoint fica aberto para testes manuais.

---

## Fluxos críticos

### Novo tenant (cadastro + onboarding)

```
1. Usuário acessa agendeweb.com.br/cadastro
2. Preenche nome, email, CPF, senha
3. Supabase cria o usuário e envia email de confirmação (via Resend SMTP)
4. Usuário confirma email → redireciona para /onboarding
5. Onboarding coleta telefone, CEP, documento do negócio
6. Backend cria Tenant + User + SchedulingPolicy padrão
7. Redireciona para /agenda (painel principal)
```

### Agendamento público (cliente final)

```
1. Cliente acessa agendeweb.com.br/<slug-do-negocio>
2. Vitrine SSR: serviços, equipe, localização
3. Cliente seleciona serviço → profissional → data/hora
4. Login/criação de conta via CPF+nascimento → Portal do Cliente
5. Confirmação do agendamento
6. Backend: cria Appointment + dispara notification (WhatsApp via Evolution API)
7. Job `appointment-reminder` envia lembrete 24h antes
```

### Envio de notificação (WhatsApp + Email)

```
1. Service chama notificationService.logAndDispatch(draft)
2. Canal WHATSAPP → whatsAppGateway.send()
   ├── Tenta Evolution API (primário)
   └── Fallback para Twilio se Evolution falhar
3. Canal EMAIL → getEmailProvider().send()
   └── Resend SDK (chave RESEND_API_KEY)
4. Resultado gravado em NotificationLog
5. Evento publicado: notifications.notification.logged
```

### Cobrança de assinatura (Stripe)

```
1. Tenant inicia checkout → /api/billing/create-checkout
2. Stripe Checkout Session criada → redirect para Stripe
3. Pagamento aprovado → Stripe envia webhook para /api/billing/webhook
4. Backend: atualiza Subscription.status = ACTIVE, plan = <plano>
5. Job `billing-expire-sweep` verifica diariamente assinaturas vencidas
6. Assinatura expirada → SubscriptionLockedScreen bloqueia o painel
```

---

## Checklist para novo ambiente (do zero)

- [ ] Registrar domínio no Registro.br
- [ ] Criar conta Cloudflare gratuita → adicionar domínio → obter nameservers
- [ ] Atualizar nameservers no Registro.br (aguardar propagação 1–2h)
- [ ] Criar projeto no Supabase → obter DATABASE_URL, DIRECT_URL, chaves API
- [ ] Criar conta Vercel → importar repositório GitHub → configurar buildCommand
- [ ] Adicionar registros DNS no Cloudflare (A + CNAME para Vercel)
- [ ] Adicionar domínio customizado no Vercel → aguardar SSL
- [ ] Criar conta Resend → verificar domínio → criar API key
- [ ] Adicionar registros DNS do Resend no Cloudflare (DKIM + SPF)
- [ ] Verificar domínio no Resend (botão "Verify DNS Records")
- [ ] Configurar SMTP do Supabase Auth (smtp.resend.com:465)
- [ ] Configurar todas as variáveis de ambiente no Vercel
- [ ] Fazer deploy e verificar `/api/cron/tick` respondendo
- [ ] Configurar Evolution API (self-hosted) + conectar instância WhatsApp
- [ ] Configurar Stripe (produtos, preços, webhook)
- [ ] Testar fluxo completo: cadastro → agendamento → notificação → cobrança

---

## Custos mensais estimados (piloto — 1 cliente)

| Serviço | Plano | Custo |
|---|---|---|
| Vercel | Hobby | Gratuito |
| Supabase | Free | Gratuito |
| Cloudflare | Free | Gratuito |
| Resend | Free (3k emails/mês) | Gratuito |
| Registro.br | Renovação anual | ~R$ 40/ano |
| Evolution API | Railway Starter | ~US$ 5/mês |
| Stripe | Pay-as-you-go | 2,9% + US$ 0,30/transação |
| **Total fixo** | | **~R$ 30/mês** |

---

## Secrets gerados (referência — NÃO commitar valores reais)

| Variável | Como gerar |
|---|---|
| `PUBLIC_SESSION_SECRET` | `openssl rand -base64 32` |
| `ADMIN_API_SECRET` | `openssl rand -hex 32` |
| `ADMIN_IMPERSONATE_SECRET` | `openssl rand -base64 32` |
| `AUTH_JWT_SECRET` | Obtido do Supabase (não gerar manualmente) |
