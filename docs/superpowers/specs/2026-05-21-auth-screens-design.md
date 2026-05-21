# Auth Screens — Design Spec

**Data:** 2026-05-21
**Status:** Aprovado
**Abordagem:** Forms customizados + Supabase Auth SDK

---

## Escopo

Implementação completa das telas de autenticação do SaaS, incluindo:
- Login com email/senha e Google OAuth
- Cadastro de novo tenant (onboarding)
- Esqueci/reset de senha
- Proteção de rotas via middleware
- Foundation para white-label por tenant

---

## Arquitetura

### Backend

| Endpoint | Método | Auth | Descrição |
|---|---|---|---|
| `/api/iam/register` | POST | Bearer token Supabase | Cria Tenant + User OWNER, atualiza user_metadata |
| `/api/iam/tenant-branding` | GET | Público | Retorna config de branding pelo slug do tenant |
| `/api/iam/me` | GET | Bearer token | Retorna usuário autenticado (já existe) |

**`POST /api/iam/register`**
- Input: `{ businessName: string, userName: string }`
- Extrai `userId` e `email` do Bearer token Supabase
- Gera `slug` a partir do `businessName` (slugify)
- Cria `Tenant` (name, slug, brandingConfig inicial com displayName)
- Cria `User` (role: OWNER, permissions: todas)
- Atualiza `user_metadata` do Supabase: `{ tenantId, role: 'OWNER' }`
- Retorna `{ tenantId, userId }`

**`GET /api/iam/tenant-branding?slug=...`**
- Busca Tenant pelo slug
- Retorna `{ name, brandingConfig: { primaryColor, logoUrl, displayName } }`
- Se slug não encontrado → retorna branding padrão (marca do produto)

### Banco de dados

Nova migration: adicionar `brandingConfig Json?` ao modelo `Tenant`.

```prisma
model Tenant {
  // campos existentes...
  brandingConfig Json?   // { primaryColor, logoUrl, displayName }
}
```

Estrutura do JSON:
```json
{
  "primaryColor": "#191919",
  "logoUrl": null,
  "displayName": "Barbearia do João"
}
```

### Frontend — Rotas

```
src/app/
└── (auth)/
    ├── layout.tsx              ← NÃO usa AppShell. Renderiza só fontes + fundo #f7f6f3.
    │                             O RootLayout continua aplicando <html>/<body>/fontes.
    ├── login/
    │   └── page.tsx            ← split + abas Entrar/Criar conta
    ├── callback/
    │   └── route.ts            ← handler OAuth (server route)
    ├── onboarding/
    │   └── page.tsx            ← coleta nome do negócio pós-Google
    ├── forgot-password/
    │   └── page.tsx            ← solicitar reset
    └── reset-password/
        └── page.tsx            ← definir nova senha
```

> **Atenção:** O `app/layout.tsx` atual envolve tudo com `<AppShell>`. Para as rotas de auth ficarem sem sidebar, o `(auth)/layout.tsx` precisa ser um layout independente que **não chama** `<AppShell>`. Isso exige mover o `<AppShell>` do `RootLayout` para um layout específico das rotas do app (`app/(app)/layout.tsx`), separando os dois contextos.

### Infra

- `src/integrations/supabase/client.ts` — `createBrowserClient` para uso no frontend
- `middleware.ts` na raiz do projeto
- Pacotes: `react-hook-form`, `@hookform/resolvers`, `sonner`

---

## Visual e UX

### Paleta (Notion-inspired)

| Token | Valor | Uso |
|---|---|---|
| Background body | `#f7f6f3` | Fundo geral + lado esquerdo do split |
| Surface | `#ffffff` | Cards, inputs, lado direito |
| Border | `#e5e5e5` | Bordas de inputs e divisores |
| Text primary | `#191919` | Títulos, labels |
| Text secondary | `#787774` | Subtítulos, placeholders |
| Button primary bg | `#191919` | Botão principal |
| Button primary text | `#ffffff` | Texto do botão principal |
| Focus ring | `#191919` | Focus nos inputs |

### Layout split (desktop ≥ 1024px)

- **Esquerda (45%)**: fundo `#f7f6f3`, logo + tagline + 3 benefícios em cards cinza
- **Direita (55%)**: fundo `#ffffff`, formulário centralizado

### Layout mobile (< 1024px)

- Coluna única: só o formulário, logo no topo

### Componentes de feedback

- Erros de campo: texto vermelho `#ef4444` inline abaixo do input
- Erros de auth (API): `sonner` toast no canto superior direito
- Loading: spinner `lucide-react` no botão, botão desabilitado durante request
- Sucesso: toast verde + redirect automático

---

## Fluxos de dados

### Fluxo 1 — Login email/senha
```
submit form
→ supabase.auth.signInWithPassword({ email, password })
→ router.push('/dashboard')
```
Erros tratados: `Invalid login credentials`, `Email not confirmed`

### Fluxo 2 — Cadastro email/senha
```
submit form (businessName, userName, email, password)
→ supabase.auth.signUp({ email, password })
→ POST /api/iam/register { businessName, userName }  ← com Bearer token
→ toast.success("Verifique seu email")
```
O backend cria Tenant + User + atualiza user_metadata com tenantId.

### Fluxo 3 — Google OAuth
```
clique em "Continuar com Google"
→ supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
→ /auth/callback/route.ts troca code por session
→ verifica user_metadata.tenantId:
    SEM → redirect /auth/onboarding
    COM → redirect /dashboard
```

### Fluxo 4 — Onboarding pós-Google
```
/auth/onboarding (nome do Google pré-preenchido em userName)
→ submit { businessName, userName }
→ POST /api/iam/register
→ redirect /dashboard
```

### Fluxo 5 — Esqueci senha
```
/auth/forgot-password
→ supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/reset-password' })
→ estado de sucesso: "Verifique seu email" + cooldown de reenvio (60s)
```

### Fluxo 6 — Reset de senha
```
/auth/reset-password (Supabase troca token da URL por session)
→ exibe 3 campos:
    - Email (pré-preenchido via supabase.auth.getUser(), somente leitura)
    - Nova senha (mín. 8 chars, barra de força)
    - Confirmar nova senha
→ supabase.auth.updateUser({ password: novaSenha })
→ redirect /auth/login + toast.success("Senha alterada com sucesso")
```

Erros: token inválido/expirado → tela de erro com botão "Solicitar novo link"

### Fluxo 7 — White-label foundation
```
/auth/login?tenant=barbearia-do-joao
→ GET /api/iam/tenant-branding?slug=barbearia-do-joao
→ aplica CSS custom property --color-primary no lado esquerdo
→ exibe nome e logo do tenant (se logoUrl definido)
→ sem ?tenant= → usa marca padrão do produto
```

---

## Proteção de rotas (middleware.ts)

| Rota | Condição | Ação |
|---|---|---|
| `/dashboard/*` | sem session | redirect `/auth/login` |
| `/dashboard/*` | session sem tenantId | redirect `/auth/onboarding` |
| `/api/*` | sem session | 401 (via `withTenant()`, já implementado) |
| `/auth/*` (exceto callback e reset-password) | session + tenantId | redirect `/dashboard` |
| `/auth/callback` | qualquer | passa sempre |
| `/auth/reset-password` | qualquer | passa sempre |

---

## Telas — Especificação detalhada

### `/auth/login` — Aba Entrar
- Campo: Email (`type="email"`, `autocomplete="email"`)
- Campo: Senha (`type="password"`, toggle show/hide, `autocomplete="current-password"`)
- Link: "Esqueceu sua senha?" → `/auth/forgot-password`
- Botão: "Entrar" (loading state: "Entrando...")
- Divisor "ou"
- Botão: "Continuar com Google" (ícone SVG oficial)

### `/auth/login` — Aba Criar conta
- Campo: Nome do negócio (placeholder: "Ex: Barbearia do João", mín. 2 chars)
- Campo: Seu nome completo (mín. 2 chars)
- Campo: Email
- Campo: Senha (mín. 8 chars, barra de força fraca/média/forte)
- Campo: Confirmar senha
- Botão: "Criar conta" (loading state)
- Divisor "ou"
- Botão: "Continuar com Google"
- Texto: "Ao criar uma conta, você concorda com nossos Termos de Uso e Política de Privacidade"

### `/auth/forgot-password`
- Layout centralizado (sem split)
- Campo: Email
- Botão: "Enviar instruções"
- Link: "← Voltar para o login"
- Estado de sucesso: ícone ✉ + "Verifique seu email" + reenviar (cooldown 60s)

### `/auth/reset-password`
- Layout centralizado (sem split)
- Campo: Email (pré-preenchido, `readOnly`)
- Campo: Nova senha (mín. 8 chars, barra de força)
- Campo: Confirmar nova senha
- Botão: "Redefinir senha"
- Estado de sucesso: ícone ✓ + "Senha alterada" + botão "Ir para o login"
- Estado de erro: token expirado → botão "Solicitar novo link"

### `/auth/onboarding`
- Layout centralizado (sem split)
- Título: "Quase lá! Como se chama seu negócio?"
- Campo: Nome do negócio
- Campo: Seu nome (pré-preenchido do Google se disponível)
- Botão: "Começar →"

---

## Dependências

### Novos pacotes
```bash
npm install react-hook-form @hookform/resolvers sonner
```

### Pacotes existentes utilizados
- `@supabase/ssr` v0.10.3 — browser client + server client
- `@supabase/supabase-js` v2 — métodos de auth
- `zod` v4 — schemas de validação dos forms
- `lucide-react` — ícones (Eye, EyeOff, Loader2, Mail, CheckCircle)
- `shadcn` + `radix-ui` — componentes base (Input, Button, Label, Tabs)

### Configuração Supabase (manual)
- Email Auth habilitado com confirmação de email
- Google OAuth: Client ID + Client Secret do Google Cloud Console
- Site URL: URL do Vercel
- Redirect URLs: `[url]/auth/callback`

---

## Checklist de implementação

- [ ] Mover `<AppShell>` do `RootLayout` para `app/(app)/layout.tsx` (novo route group)
- [ ] Instalar `react-hook-form`, `@hookform/resolvers`, `sonner`
- [ ] Criar `src/integrations/supabase/client.ts` (browser client)
- [ ] Migration Prisma: `brandingConfig Json?` no Tenant
- [ ] Aplicar migration no Supabase (`prisma migrate deploy`)
- [ ] `POST /api/iam/register` — criar Tenant + User OWNER
- [ ] `GET /api/iam/tenant-branding` — rota pública de branding
- [ ] `middleware.ts` — proteção de rotas
- [ ] `app/(auth)/layout.tsx` — layout sem sidebar
- [ ] `app/(auth)/login/page.tsx` — split + abas
- [ ] `app/(auth)/callback/route.ts` — handler OAuth
- [ ] `app/(auth)/onboarding/page.tsx` — coleta nome pós-Google
- [ ] `app/(auth)/forgot-password/page.tsx`
- [ ] `app/(auth)/reset-password/page.tsx`
- [ ] Configurar Google OAuth no painel Supabase
- [ ] Loading states em todos os botões
- [ ] Toast de erro e sucesso em todas as ações
- [ ] Mobile responsivo
- [ ] Barra de força da senha no cadastro e reset
