# Auth Screens — Especificação de implementação

> Este documento define exatamente o que precisa ser construído nas telas de autenticação.
> É lido pelo agente frontend para implementar as telas corretamente.

---

## Visão geral

O produto precisa de 5 telas/rotas de auth:

| Rota | Descrição | Prioridade |
|---|---|---|
| `/auth/login` | Login + cadastro (abas) | P0 |
| `/auth/callback` | Handler OAuth (server route) | P0 |
| `/auth/onboarding` | Coleta nome do negócio pós-Google | P0 |
| `/auth/forgot-password` | Solicitar reset de senha | P1 |
| `/auth/reset-password` | Definir nova senha via link do email | P1 |

---

## Tela principal: `/auth/login`

### Layout

```
┌─────────────────────────────────────────────────────┐
│  [Desktop: 50% visual] │ [Desktop/Mobile: formulário]│
│                        │                             │
│   logo + tagline       │  Logo (mobile only)         │
│   screenshot/visual    │                             │
│   do produto           │  [Tab: Entrar | Criar conta]│
│                        │                             │
│                        │  ... campos do formulário   │
└─────────────────────────────────────────────────────┘
```

Mobile: sem split — só o formulário com logo no topo.

### Aba "Entrar"

Campos:
1. **Email** — type="email", autocomplete="email"
2. **Senha** — type="password", com botão toggle eye (show/hide), autocomplete="current-password"

Links:
- "Esqueceu sua senha?" — alinhado à direita, abre `/auth/forgot-password`

Botões:
- **"Entrar"** — primário, loading state com spinner, texto muda para "Entrando..."
- **Divisor** "ou"
- **"Continuar com Google"** — outline/secondary, ícone SVG do Google à esquerda

Estados de erro:
- Email ou senha incorretos → toast.error("Email ou senha incorretos")
- Email não confirmado → toast.error("Confirme seu email antes de entrar")
- Erro genérico → toast.error("Erro ao fazer login. Tente novamente.")

### Aba "Criar conta"

Campos:
1. **Nome do negócio** — placeholder "Ex: Barbearia do João", min 2 chars
2. **Seu nome** — placeholder "Seu nome completo", min 2 chars
3. **Email** — type="email"
4. **Senha** — type="password", min 8 chars, com indicador de força (fraca/média/forte)
5. **Confirmar senha** — type="password", deve bater com senha

Botões:
- **"Criar conta"** — primário, loading state
- **Divisor** "ou"
- **"Continuar com Google"** — abre OAuth (vai pedir nome do negócio depois no /onboarding)

Texto legal:
- "Ao criar uma conta, você concorda com nossos [Termos de Uso] e [Política de Privacidade]"

Estados de erro:
- Email já cadastrado → toast.error("Este email já possui uma conta. Faça login.")
- Senhas não conferem → erro inline no campo
- Erro genérico → toast.error(message)

Estado de sucesso:
- toast.success("Conta criada! Verifique seu email para confirmar.")
- Redireciona para mensagem "Verifique seu email"

---

## Tela: `/auth/forgot-password`

Layout simples centralizado (sem split):

```
Logo
Título: "Esqueceu sua senha?"
Subtítulo: "Digite seu email e enviaremos as instruções."

[Campo: Email]
[Botão: Enviar instruções]

Link: ← Voltar para o login
```

Estado de sucesso (após submit):
```
Ícone de email ✉
Título: "Verifique seu email"
Texto: "Enviamos as instruções para [email]. Verifique sua caixa de entrada e spam."
Link: Reenviar email (após 60s de cooldown)
Link: ← Voltar para o login
```

---

## Tela: `/auth/reset-password`

Ativada quando usuário clica no link do email (URL contém token do Supabase):

```
Logo
Título: "Criar nova senha"

[Campo: Nova senha] — min 8 chars, indicador de força
[Campo: Confirmar nova senha]
[Botão: Redefinir senha]
```

Estado de sucesso:
```
Ícone ✓
Título: "Senha alterada com sucesso!"
[Botão: Ir para o login]
```

Estado de erro (token inválido/expirado):
```
Ícone de erro
Título: "Link inválido ou expirado"
[Botão: Solicitar novo link]
```

---

## Rota: `/auth/callback` (Server Route)

Não é uma página — é um `route.ts` que:
1. Troca o `code` pelo session via `supabase.auth.exchangeCodeForSession(code)`
2. Verifica se o user já tem `tenantId` no `user_metadata`
3. Se NÃO tem → redirect para `/auth/onboarding`
4. Se TEM → redirect para `/dashboard`

```typescript
// app/(auth)/callback/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createServerClient(...)
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code)

    if (session?.user?.user_metadata?.tenantId) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    return NextResponse.redirect(new URL('/auth/onboarding', request.url))
  }

  return NextResponse.redirect(new URL('/auth/login', request.url))
}
```

---

## Tela: `/auth/onboarding`

Usada após Google OAuth quando o tenant ainda não existe.

```
Logo
Título: "Quase lá! Como se chama seu negócio?"
Subtítulo: "Você poderá alterar isso depois nas configurações."

[Campo: Nome do negócio] — placeholder "Ex: Barbearia do João"
[Campo: Seu nome] — pré-preenchido do Google se disponível
[Botão: Começar →]
```

Ao submeter:
1. `POST /api/iam/register` com `{ businessName, userName }`
2. Backend cria Tenant + User (OWNER) + atualiza metadata Supabase
3. Redirect para `/dashboard`

---

## Proteção de rotas

### Middleware de rota (obrigatório)

```typescript
// middleware.ts (raiz do projeto)
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const supabase = createServerClient(...)
  const { data: { session } } = await supabase.auth.getSession()

  // Rotas protegidas — requer auth + tenant
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
    if (!session) return NextResponse.redirect(new URL('/auth/login', request.url))
    if (!session.user.user_metadata?.tenantId) {
      return NextResponse.redirect(new URL('/auth/onboarding', request.url))
    }
  }

  // Rotas de auth — se já logado, vai pro dashboard
  if (pathname.startsWith('/auth') && !pathname.includes('callback')) {
    if (session?.user?.user_metadata?.tenantId) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*', '/api/:path*']
}
```

---

## Identidade visual das telas de auth

- Fundo: `bg-background` (branco/off-white no tema Rose)
- Card do formulário: `bg-card` com sombra sutil, bordas arredondadas
- Botão primário: rose/pink do tema Shadcn
- Botão Google: outline, cor neutra, ícone oficial do Google
- Input com focus ring rose
- Indicador de força da senha: barra colorida (vermelho → amarelo → verde)
- Animação suave entre abas (sem layout shift brusco)

---

## Checklist de implementação

- [ ] `/auth/login` com abas Entrar / Criar conta
- [ ] Google OAuth button nas duas abas
- [ ] "Esqueceu sua senha?" funcional
- [ ] `/auth/callback/route.ts` com lógica de redirect
- [ ] `/auth/onboarding` para Google OAuth sem tenant
- [ ] `/auth/forgot-password` completa
- [ ] `/auth/reset-password` completa
- [ ] `middleware.ts` protegendo rotas `/dashboard/*`
- [ ] Loading states em todos os botões
- [ ] Toast de erro e sucesso em todas as ações
- [ ] Mobile responsivo (sem split no mobile)
- [ ] Indicador de força de senha no cadastro
