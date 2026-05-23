# Design: Auth, Onboarding e Logout

**Data:** 2026-05-23  
**Status:** Aprovado  
**Escopo:** Corrigir fluxo de autenticação, registro de novo usuário e adicionar botão de logout

---

## Contexto

Durante sessão de debugging, identificou-se que:

1. O fluxo de cadastro chama `/api/iam/register` diretamente no `SignupForm`, criando tenant e usuário no banco **antes** do onboarding ser concluído.
2. O `SignupForm` coleta `businessName` e `userName` — campos que o onboarding já coleta — forçando o usuário a preencher as mesmas informações duas vezes.
3. Não existe botão de logout na interface.
4. O `AppHome` (`(app)/page.tsx`) não redireciona para `/login` quando a sessão é inválida — deixa tela em branco.

---

## Fluxo Correto (pós-implementação)

### Usuário não autenticado
```
localhost:3000 (qualquer rota protegida)
  → Middleware: sem sessão → redirect /login
  → Se edge case escapa: AppHome isError → redirect /login
```

### Cadastro de novo usuário
```
/login (aba "Criar conta")
  Campos: email · senha · confirmar senha
  [DEV]  POST /api/dev/signup → cria conta Supabase Auth (sem email de confirmação)
  [PROD] supabase.auth.signUp() → envia email de confirmação → toast "Verifique seu email"
  [DEV]  signInWithPassword → sessão ativa
  [DEV]  router.push('/onboarding')

  Middleware detecta: sessão sem tenantId → força /onboarding

/onboarding
  Campos: nome do negócio · seu nome
  POST /api/iam/register → cria Tenant + User no Prisma → atualiza app_metadata
  supabase.auth.refreshSession() → JWT com tenantId + role: OWNER
  router.push('/dashboard')
```

**Invariante:** O usuário só existe no Prisma DB após concluir o onboarding. Se fechar o browser antes, o middleware garante retorno ao `/onboarding` no próximo login.

### Usuário existente (com tenant)
```
/login → Middleware: sessão com tenantId → redirect /dashboard
/      → Middleware: sessão com tenantId → passa → AppHome → redirect /dashboard ou /agenda
```

### Logout
```
Clica em "Sair" (sidebar desktop ou header mobile)
  supabase.auth.signOut() → limpa cookie
  router.push('/login')
  Middleware: sem sessão → /login (confirmado)
```

---

## Arquivos Modificados

### 1. `src/app/(auth)/login/login-client.tsx`

**Mudanças no `SignupForm`:**
- Remover campos `businessName` e `userName` do schema e do JSX
- Remover chamada ao `POST /api/iam/register`
- Remover `refreshSession()` do fluxo de signup
- Após login bem-sucedido (dev): `router.push('/onboarding')`
- Em produção: manter toast "Verifique seu email para confirmar" sem redirect

**Schema simplificado:**
```typescript
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
})
```

### 2. `src/components/app/app-shell.tsx`

**Logout no sidebar desktop:**
- Botão "Sair da conta" no rodapé do sidebar, abaixo de "Config."
- Estilo: background `rose-50`, texto `rose-700`, borda `rose-200`
- Ao clicar: `supabase.auth.signOut()` → `router.push('/login')`

**Logout no header mobile:**
- Ícone `LogOut` (Lucide) no lado direito do header
- Mesmo comportamento do botão desktop
- Tamanho: 40×40px, background `rose-50`, ícone `rose-600`

**Implementação do handler (compartilhado entre desktop e mobile):**
```typescript
async function handleLogout() {
  const supabase = createSupabaseBrowserClient()
  await supabase.auth.signOut()
  router.push('/login')
}
```

### 3. `src/app/(app)/page.tsx`

**Guard de rota:**
```typescript
const { data: user, isLoading, isError } = useCurrentUser()

useEffect(() => {
  if (isError) { router.replace('/login'); return }
  if (!user) return
  if (user.role === 'OWNER' || user.role === 'MANAGER') {
    router.replace('/dashboard')
  } else {
    router.replace('/agenda')
  }
}, [user, isLoading, isError, router])
```

---

## O que NÃO muda

- `middleware.ts` — lógica já correta
- `src/app/(auth)/onboarding/page.tsx` — já implementa o registro corretamente
- `src/app/api/iam/register/route.ts` — sem mudança
- `src/app/api/iam/me/route.ts` — sem mudança

---

## Camadas de proteção de rota

| Camada | Onde | Cobre |
|---|---|---|
| Middleware | Servidor | Toda navegação — redireciona sem sessão para `/login`, sem tenant para `/onboarding` |
| AppHome guard | Cliente | Edge cases de token expirado que escapam do middleware |
| Post-logout | Cliente | `signOut()` + `router.push('/login')` garante estado limpo |

---

## Critérios de aceitação

- [ ] `localhost:3000` sem sessão → redireciona para `/login`
- [ ] Cadastro com email+senha → redireciona para `/onboarding` (sem dados no Prisma ainda)
- [ ] Onboarding concluído → Tenant + User criados no Prisma → `/dashboard`
- [ ] Se fechar antes do onboarding → próximo login volta para `/onboarding`
- [ ] Botão "Sair" no sidebar desktop funciona
- [ ] Ícone de logout no header mobile funciona
- [ ] Usuário com tenant em `/login` → redirect automático para `/dashboard`
