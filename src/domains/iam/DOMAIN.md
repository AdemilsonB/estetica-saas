# IAM — Identity & Access Management

## Responsabilidade

Autenticação, autorização, gestão de tenants e controle de acesso.

---

## Entidades

- **Tenant** — empresa/negócio cliente do SaaS
- **User** — usuário dentro de um tenant com role e permissões

---

## Roles disponíveis

| Role | Descrição | Permissões |
|---|---|---|
| OWNER | Dono do negócio | Todas |
| MANAGER | Gerente | Operacional completo (sem billing/usuários) |
| PROFESSIONAL | Profissional | Própria agenda + clientes |
| RECEPTIONIST | Recepcionista | Agenda + clientes (sem financeiro) |

## Permissões granulares

```
appointments:view | appointments:create | appointments:edit | appointments:delete
customers:view | customers:create | customers:edit
financial:view | financial:manage
users:view | users:invite | users:manage
services:view | services:manage
```

---

## Fluxos de autenticação

### Fluxo 1 — Cadastro de novo tenant (onboarding)

```
Tela de cadastro
    ↓ Preenche: nome do negócio, nome completo, email, senha
    ↓ OU clica "Continuar com Google"
Supabase Auth → cria auth.users
    ↓ Frontend recebe session token
POST /api/iam/register { businessName, userName }
    ↓ Backend cria Tenant no banco (name, slug gerado do businessName)
    ↓ Backend cria User (role: OWNER, permissions: todas)
    ↓ Backend atualiza metadata do Supabase com tenantId
Redirect para /dashboard (onboarding completo)
```

**Endpoint necessário:** `POST /api/iam/register`
- Input: `{ businessName: string, userName: string }`
- Auth: token Supabase obrigatório (extrai userId)
- Cria: `Tenant` + `User` (OWNER)
- Atualiza: user_metadata do Supabase com `{ tenantId, role: 'OWNER' }`
- Retorna: `{ tenantId, userId }`

### Fluxo 2 — Login

```
Tela de login
    ↓ Email + senha → supabase.auth.signInWithPassword()
    ↓ OU "Entrar com Google" → supabase.auth.signInWithOAuth({ provider: 'google' })
Supabase retorna JWT com tenantId no user_metadata
    ↓ Frontend armazena session
Redirect para /dashboard
```

### Fluxo 3 — Esqueci minha senha

```
Tela de login → link "Esqueceu sua senha?"
    ↓ Usuário informa email
supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/reset-password' })
    ↓ Supabase envia email com link
Usuário clica no link → abre /auth/reset-password com token na URL
    ↓ supabase.auth.updateUser({ password: novaSenha })
Redirect para /login com mensagem de sucesso
```

### Fluxo 4 — Google OAuth

```
Botão "Continuar com Google"
    ↓ supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
Google OAuth consent screen
    ↓ Supabase recebe callback
/auth/callback → verifica se usuário já tem tenantId no metadata
    ↓ Se NÃO tem → redirect para /auth/onboarding (coletar nome do negócio)
    ↓ Se TEM → redirect para /dashboard
```

### Fluxo 5 — Callback OAuth (rota obrigatória)

```typescript
// app/auth/callback/route.ts
// Troca code pelo session após OAuth redirect
// Verifica se tenant existe → redireciona para onboarding ou dashboard
```

---

## Tela de Auth — Requisitos de UI

### Estrutura da página `/auth/login`

Layout dividido:
- **Esquerda (desktop)**: imagem/visual do produto, logo, tagline
- **Direita**: formulário de auth
- **Mobile**: apenas o formulário, logo no topo

Abas ou toggle entre "Entrar" e "Criar conta":

**Aba Entrar:**
- Campo: Email
- Campo: Senha (com toggle show/hide)
- Link: "Esqueceu sua senha?" → abre modal ou redirect para `/auth/forgot-password`
- Botão: "Entrar" (loading state)
- Divisor: "ou"
- Botão: "Continuar com Google" (ícone Google + texto)

**Aba Criar conta:**
- Campo: Nome do negócio (ex: "Barbearia do João")
- Campo: Seu nome completo
- Campo: Email
- Campo: Senha (min 8 caracteres, com indicador de força)
- Campo: Confirmar senha
- Botão: "Criar conta" (loading state)
- Divisor: "ou"
- Botão: "Continuar com Google"
- Texto: "Ao criar conta você concorda com os Termos de Uso"

### Página `/auth/forgot-password`
- Campo: Email
- Botão: "Enviar instruções"
- Link: "Voltar para o login"
- Estado de sucesso: "Verifique seu email"

### Página `/auth/reset-password`
- Campo: Nova senha
- Campo: Confirmar nova senha
- Botão: "Redefinir senha"

### Página `/auth/onboarding`
Usada após Google OAuth quando o tenant ainda não existe:
- Título: "Quase lá! Como se chama seu negócio?"
- Campo: Nome do negócio
- Campo: Seu nome (pré-preenchido do Google se disponível)
- Botão: "Começar" → chama `POST /api/iam/register`

---

## Componentes Supabase necessários

```typescript
// src/integrations/supabase/client.ts — para uso no frontend (browser)
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Métodos utilizados

```typescript
// Login email/senha
await supabase.auth.signInWithPassword({ email, password })

// Cadastro email/senha
await supabase.auth.signUp({ email, password })

// Google OAuth
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback` }
})

// Esqueci senha
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/reset-password`
})

// Redefinir senha (após clicar no link do email)
await supabase.auth.updateUser({ password: novaSenha })

// Logout
await supabase.auth.signOut()

// Sessão atual
const { data: { session } } = await supabase.auth.getSession()
```

---

## Rotas necessárias

```
app/
├── (auth)/
│   ├── layout.tsx              # layout sem sidebar
│   ├── login/page.tsx          # login + cadastro (abas)
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── onboarding/page.tsx     # pós-Google OAuth
│   └── callback/route.ts       # handler OAuth (Server Route)
```

---

## API Routes necessárias

```
POST /api/iam/register          # cria Tenant + User OWNER após Supabase signUp
GET  /api/iam/me                # retorna usuário autenticado atual ← já existe
POST /api/iam/users/invite      # convida usuário para o tenant
```

---

## Configurações Supabase necessárias

No painel do Supabase → Authentication → Providers:
- **Email**: habilitado (com "Confirm email" ativado)
- **Google**: habilitado (requer OAuth app no Google Cloud Console)
  - Client ID + Client Secret do Google
  - Redirect URL: `https://[seu-projeto].supabase.co/auth/v1/callback`

No painel → Authentication → URL Configuration:
- Site URL: `https://[seu-dominio].vercel.app`
- Redirect URLs: `https://[seu-dominio].vercel.app/auth/callback`

---

## Status

🟡 Backend parcial — session, RBAC e permissões implementados.
❌ Frontend — telas de auth não implementadas.
❌ `POST /api/iam/register` — endpoint de criação de tenant não implementado.
❌ Google OAuth — não configurado no Supabase.
