# Auth, Onboarding e Logout — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar botão de logout no AppShell, corrigir fluxo de cadastro para redirecionar ao `/onboarding` sem criar registros no Prisma antes do tempo, e adicionar guard de rota no AppHome para redirecionar ao `/login` em caso de erro de sessão.

**Architecture:** Três mudanças independentes em componentes de UI existentes. Nenhuma alteração de API, banco de dados ou middleware necessária — o middleware já está correto.

**Tech Stack:** Next.js App Router, TypeScript, @supabase/ssr, TanStack Query, Lucide React, Shadcn UI/Tailwind

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/components/app/app-shell.tsx` | Modificar | Adicionar handler `handleLogout` + botão no sidebar + ícone no header mobile |
| `src/app/(auth)/login/login-client.tsx` | Modificar | Simplificar `signupSchema` + remover campos + remover chamada a `/api/iam/register` + redirect para `/onboarding` |
| `src/app/(app)/page.tsx` | Modificar | Adicionar `isError` no hook + guard `isError → /login` no useEffect |

---

## Task 1: Logout no AppShell

**Arquivos:**
- Modificar: `src/components/app/app-shell.tsx`

**Contexto do arquivo atual:**
- Imports de lucide-react: `CalendarDays, CreditCard, Settings, Sparkles, Users, UserCog`
- Import de next/navigation: apenas `usePathname`
- Sem import de `createSupabaseBrowserClient`
- Sidebar footer está na div `mt-auto pt-8` — contém apenas o link Config.
- Mobile header está na tag `<header>` — div `flex items-center gap-3` com ícone, texto e nada à direita

- [ ] **Step 1: Adicionar imports**

Substituir o bloco de imports de lucide-react e next/navigation por:

```typescript
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  CreditCard,
  LogOut,
  Settings,
  Sparkles,
  Users,
  UserCog,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/hooks/use-permissions'
import { createSupabaseBrowserClient } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
```

- [ ] **Step 2: Adicionar `useRouter` e `handleLogout` dentro de `AppShell`**

Dentro da função `AppShell`, logo após a linha `const { can, user, isLoading } = usePermissions()`, adicionar:

```typescript
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }
```

- [ ] **Step 3: Adicionar botão de logout no sidebar desktop**

No sidebar, a div `mt-auto pt-8` contém apenas o bloco do link Config. Substituir essa div completa por:

```tsx
          {/* Config e logout no rodapé */}
          <div className="mt-auto space-y-1 pt-8">
            {(() => {
              const configItem = visibleItems.at(-1)
              if (!configItem) return null
              const Icon = configItem.icon
              const isActive = pathname.startsWith(configItem.href)
              return (
                <Link
                  href={configItem.href}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                    isActive
                      ? 'bg-rose-50 text-rose-700'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950',
                  )}
                >
                  <Icon className="size-4" />
                  {configItem.label}
                </Link>
              )
            })()}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <LogOut className="size-4" />
              Sair da conta
            </button>
          </div>
```

- [ ] **Step 4: Adicionar ícone de logout no header mobile**

No `<header>`, dentro da div `flex items-center gap-3`, após a div `min-w-0 flex-1` que contém o texto, adicionar o botão ícone:

```tsx
              <button
                onClick={handleLogout}
                className="inline-flex size-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 xl:hidden"
                aria-label="Sair da conta"
              >
                <LogOut className="size-4" />
              </button>
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 6: Verificar manualmente**

Com o servidor rodando (`npm run dev`), fazer login e verificar:
- Desktop (≥1280px): botão "Sair da conta" aparece no rodapé do sidebar com fundo rose-50, borda rose-200, texto rose-700
- Mobile (<1280px): ícone `LogOut` aparece à direita do header
- Clicar em qualquer um dos dois: redireciona para `/login` e limpa a sessão (F12 → Application → Cookies: cookie `sb-*-auth-token` removido)

- [ ] **Step 7: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(auth): adiciona botao de logout no sidebar desktop e header mobile"
```

---

## Task 2: Simplificar SignupForm

**Arquivos:**
- Modificar: `src/app/(auth)/login/login-client.tsx`

**Contexto do arquivo atual:**
- `signupSchema` tem 5 campos: `businessName`, `userName`, `email`, `password`, `confirmPassword`
- `onSubmit` em dev: cria usuário via `/api/dev/signup`, faz `signInWithPassword`, chama `/api/iam/register`, chama `refreshSession()`, redireciona para `/`
- `onSubmit` em prod: chama `supabase.auth.signUp()`, toast "Verifique seu email", return (correto — não precisa mudar)
- JSX tem campos `businessName` e `userName` antes do campo email
- `watch("password")` ainda é necessário para o componente `<PasswordStrength />`

- [ ] **Step 1: Substituir `signupSchema` e o tipo `SignupForm`**

Substituir as linhas 27–43 (schema + tipo) por:

```typescript
const signupSchema = z
  .object({
    email: z.string().email("Email invalido"),
    password: z.string().min(8, "Minimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas nao conferem",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;
```

- [ ] **Step 2: Substituir a função `onSubmit` dentro de `SignupForm`**

Substituir a função `onSubmit` completa (linhas 303–385) por:

```typescript
  async function onSubmit(data: SignupForm) {
    const supabase = createSupabaseBrowserClient();

    if (process.env.NODE_ENV === "development") {
      const devRes = await fetch("/api/dev/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      if (!devRes.ok) {
        const body = await devRes.json();
        const msg = body.error ?? "";
        if (msg.includes("already been registered") || msg.includes("already exists")) {
          toast.error("Este email ja possui uma conta. Faca login.");
        } else {
          toast.error(msg || "Erro ao criar conta.");
        }
        return;
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast.error("Este email ja possui uma conta. Faca login.");
        } else {
          toast.error(signUpError.message);
        }
        return;
      }

      toast.success("Conta criada! Verifique seu email para confirmar.");
      return;
    }

    const { data: signed, error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (signInError || !signed.session) {
      toast.error("Erro ao iniciar sessao. Tente fazer login.");
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }
```

- [ ] **Step 3: Remover campos `businessName` e `userName` do JSX**

No JSX do `return` de `SignupForm`, remover os dois blocos abaixo (aparecem antes do campo email):

```tsx
      <div className="space-y-1.5">
        <Label className="text-[#37352f]">Nome do negocio</Label>
        <Input
          placeholder="Ex: Barbearia do Joao"
          className="border-[#e5e5e5] bg-[#f7f6f3] focus-visible:ring-[#191919]"
          {...register("businessName")}
        />
        {errors.businessName && (
          <p className="text-xs text-red-500">{errors.businessName.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#37352f]">Seu nome</Label>
        <Input
          placeholder="Nome completo"
          className="border-[#e5e5e5] bg-[#f7f6f3] focus-visible:ring-[#191919]"
          {...register("userName")}
        />
        {errors.userName && (
          <p className="text-xs text-red-500">{errors.userName.message}</p>
        )}
      </div>
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros. Se aparecerem erros relacionados a `businessName` ou `userName`, verificar se alguma referência foi esquecida no JSX ou no `onSubmit`.

- [ ] **Step 5: Verificar manualmente**

Com o servidor rodando, acessar `/login` → aba "Criar conta":
- Formulário exibe apenas: Email, Senha (com indicador de força), Confirmar senha
- Em dev: preencher dados de um email novo → clicar "Criar conta" → deve redirecionar para `/onboarding`
- O banco Prisma NÃO deve ter novo registro (verificar via `npx prisma studio` → tabela `User`)

- [ ] **Step 6: Commit**

```bash
git add src/app/(auth)/login/login-client.tsx
git commit -m "feat(auth): simplifica SignupForm — remove campos redundantes e redireciona para onboarding"
```

---

## Task 3: Guard de rota no AppHome

**Arquivos:**
- Modificar: `src/app/(app)/page.tsx`

**Contexto do arquivo atual:**
- `useCurrentUser()` desestrutura apenas `{ data: user, isLoading }`
- `useEffect` verifica `if (!user) return` sem tratar erro de sessão
- Dependency array: `[user, router]`

- [ ] **Step 1: Substituir o arquivo completo**

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/use-current-user'

export default function AppHome() {
  const router = useRouter()
  const { data: user, isLoading, isError } = useCurrentUser()

  useEffect(() => {
    if (isError) {
      router.replace('/login')
      return
    }
    if (!user) return
    if (user.role === 'OWNER' || user.role === 'MANAGER') {
      router.replace('/dashboard')
    } else {
      router.replace('/agenda')
    }
  }, [user, isLoading, isError, router])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    )
  }

  return null
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Verificar manualmente**

Cenário A — sem sessão:
1. Limpar cookies do browser (F12 → Application → Clear site data)
2. Acessar `localhost:3000`
3. Esperado: redirect para `/login` (middleware cobre primeiro, AppHome cobre o edge case)

Cenário B — sessão válida com tenant:
1. Fazer login com `ademilsonbertolin2002@gmail.com` / `Teste@123`
2. Acessar `localhost:3000`
3. Esperado: redirect automático para `/dashboard`

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/page.tsx
git commit -m "fix(auth): adiciona guard isError no AppHome para redirecionar ao /login"
```

---

## Task 4: PR para main

- [ ] **Step 1: Verificar estado do branch**

```bash
git log main..HEAD --oneline
git status
```

Esperado: 3 commits listados, working tree limpa.

- [ ] **Step 2: Abrir Pull Request**

```bash
gh pr create \
  --title "feat(auth): logout, correcao do signup e guard de rota no AppHome" \
  --body "$(cat <<'EOF'
## O que muda

- **Logout:** botão 'Sair da conta' no rodapé do sidebar desktop e ícone LogOut no header mobile — chama signOut() e redireciona para /login
- **Signup simplificado:** remove campos businessName/userName do formulário; após criar conta em dev, redireciona para /onboarding em vez de criar Tenant+User imediatamente
- **AppHome guard:** adiciona isError ao hook useCurrentUser e redireciona para /login quando a sessão é inválida

## Critérios de aceitação

- [ ] localhost:3000 sem sessão → redirect para /login
- [ ] Cadastro com email+senha → redirect para /onboarding (sem dados no Prisma)
- [ ] Onboarding concluído → Tenant+User criados no Prisma → /dashboard
- [ ] Botão 'Sair' no sidebar desktop funciona
- [ ] Ícone de logout no header mobile funciona
- [ ] Usuário com tenant em /login → redirect automático para /dashboard

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Mergear após revisão**

```bash
gh pr merge --squash --delete-branch
```

---

## Revisão: spec vs. plano

| Requisito (spec) | Task |
|---|---|
| Botão "Sair da conta" sidebar desktop — rose-50/700/200 | Task 1 Step 3 |
| Ícone LogOut header mobile — 40×40, rose-50/600 | Task 1 Step 4 |
| `handleLogout`: signOut() + router.push('/login') | Task 1 Step 2 |
| Remove businessName/userName do signupSchema | Task 2 Step 1 |
| Remove chamada a /api/iam/register | Task 2 Step 2 |
| Remove refreshSession() do signup | Task 2 Step 2 |
| Dev: após login → router.push('/onboarding') | Task 2 Step 2 |
| Prod: toast "Verifique seu email" + return (sem mudança) | Task 2 Step 2 |
| isError → router.replace('/login') no AppHome | Task 3 Step 1 |
| Middleware, onboarding/page.tsx, /api/iam/register — sem mudança | Não incluídos ✅ |
