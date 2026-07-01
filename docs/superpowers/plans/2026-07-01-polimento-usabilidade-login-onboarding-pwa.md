# Polimento de Usabilidade (Login, Onboarding, PWA) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir o atrito de entrada para clientes leigos — login mobile mais claro, retorno à landing, rótulos que diferenciam CPF do titular × do negócio, reuso opcional de dados e um convite guiado para instalar o PWA.

**Architecture:** Cinco frentes majoritariamente independentes sobre a área `(auth)` e um componente novo de PWA na `(app)/agenda`. Backend muda só o contrato de `register` (aditivo, sem migration). Tudo em PT-BR.

**Tech Stack:** Next.js 15 App Router, React, TypeScript strict, Zod, react-hook-form, Tailwind, Supabase Auth, Prisma, Vitest.

## Global Constraints

- Todo output em **Português do Brasil** (labels, comentários, mensagens, testes).
- TypeScript strict — sem `any`, sem `as unknown as` (o `as any` já existente nos testes é tolerado por seguir o padrão do arquivo).
- Sem migration Prisma — `User.phone`, `User.cpf`, `Tenant.zipCode` já existem.
- Mobile-first: base → `md:` → `lg:`.
- `tenantId`/dados sensíveis nunca vêm do body para efeito de auth; aqui `register` já autentica por token e só recebe dados de negócio.
- Rodar `npx tsc --noEmit` e `npx vitest run` verdes ao final.
- Branch: `feat/polimento-usabilidade-login-onboarding-pwa` (já criada).

---

### Task 1: Backend — `register` aceita `ownerPhone` e `zipCode` do corpo

**Files:**
- Modify: `src/domains/iam/iam.service.ts:13-23` (tipo `RegisterInput`)
- Modify: `src/domains/iam/iam.service.ts:121-132` (chamada `createTenantWithOwner`)
- Modify: `src/app/api/iam/register/route.ts:10-16` (`RegisterSchema`)
- Test: `src/domains/iam/iam.service.test.ts` (bloco `describe('IamService.register')`)

**Interfaces:**
- Consumes: `iamRepository.createTenantWithOwner({ ..., ownerPhone, ownerCpf, zipCode })` (assinatura atual já aceita esses três campos opcionais).
- Produces: `RegisterInput` passa a ter `ownerPhone?: string` e `zipCode?: string`. `RegisterSchema` (Zod) idem. Comportamento: `ownerPhone = input.ownerPhone ?? meta.phone`; `zipCode = input.zipCode ?? meta.cep`; `ownerCpf = meta.cpf` (inalterado).

- [ ] **Step 1: Escrever teste que falha — `ownerPhone`/`zipCode` do input têm prioridade**

Adicionar dentro de `describe('IamService.register', ...)` em `src/domains/iam/iam.service.test.ts`:

```typescript
  it('usa ownerPhone e zipCode vindos do input', async () => {
    vi.mocked(iamRepository.findTenantByDocument).mockResolvedValue(null)
    vi.mocked(iamRepository.createTenantWithOwner).mockResolvedValue({
      tenant: { id: 'tenant-novo' },
      user: { id: USER_ID },
    } as any)

    await service.register(USER_ID, {
      businessName: 'Salão da Maria',
      userName: 'Maria',
      documentType: 'CPF',
      document: '111.444.777-35',
      ownerPhone: '(11) 9 8888-7777',
      zipCode: '01001-000',
    })

    expect(iamRepository.createTenantWithOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerPhone: '(11) 9 8888-7777',
        zipCode: '01001-000',
      }),
    )
  })

  it('faz fallback para metadata quando input não traz ownerPhone/zipCode', async () => {
    vi.mocked(supabaseAdmin.auth.admin.getUserById).mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'dono@negocio.com',
          app_metadata: {},
          user_metadata: { phone: '(21) 9 7777-6666', cep: '20040-002', cpf: '111.444.777-35' },
        },
      },
      error: null,
    } as any)
    vi.mocked(iamRepository.findTenantByDocument).mockResolvedValue(null)
    vi.mocked(iamRepository.createTenantWithOwner).mockResolvedValue({
      tenant: { id: 'tenant-novo' },
      user: { id: USER_ID },
    } as any)

    await service.register(USER_ID, {
      businessName: 'Salão da Maria',
      userName: 'Maria',
      documentType: 'CPF',
      document: '111.444.777-35',
    })

    expect(iamRepository.createTenantWithOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerPhone: '(21) 9 7777-6666',
        zipCode: '20040-002',
      }),
    )
  })
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domains/iam/iam.service.test.ts -t "ownerPhone e zipCode"`
Expected: FAIL — o service ainda ignora `input.ownerPhone`/`input.zipCode` (usa só `meta.*`), então o 1º teste falha na asserção.

- [ ] **Step 3: Estender o tipo `RegisterInput`**

Em `src/domains/iam/iam.service.ts`, alterar o type (linhas 13-23) para incluir:

```typescript
type RegisterInput = {
  businessName: string;
  userName: string;
  documentType: TenantDocumentType;
  document: string;
  ownerPhone?: string;
  zipCode?: string;
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string;
    backgroundColor?: string;
  };
};
```

- [ ] **Step 4: Priorizar o input no `register()`**

Em `src/domains/iam/iam.service.ts`, na chamada `createTenantWithOwner` (linhas ~129-131), trocar:

```typescript
        ownerPhone: input.ownerPhone ?? meta.phone,
        ownerCpf: meta.cpf,
        zipCode: input.zipCode ?? meta.cep,
```

- [ ] **Step 5: Estender o `RegisterSchema` da API Route**

Em `src/app/api/iam/register/route.ts`, no `RegisterSchema` (linhas 10-16), adicionar antes de `branding`:

```typescript
  ownerPhone: z.string().optional(),
  zipCode: z.string().optional(),
```

- [ ] **Step 6: Rodar os testes de register e confirmar verde**

Run: `npx vitest run src/domains/iam/iam.service.test.ts`
Expected: PASS — todos os testes de `IamService.register`, incluindo os dois novos.

- [ ] **Step 7: Commit**

```bash
git add src/domains/iam/iam.service.ts src/app/api/iam/register/route.ts src/domains/iam/iam.service.test.ts
git commit -m "feat(iam): register aceita ownerPhone e zipCode do onboarding com fallback para metadata"
```

---

### Task 2: Signup enxuto — remover telefone/CEP do `/login`, rótulo claro no CPF

**Files:**
- Modify: `src/app/(auth)/login/login-client.tsx` (schema `signupSchema`, componente `SignupFormComponent`, máscaras/estado de telefone e CEP)
- Modify: `src/app/api/auth/signup/route.ts:9-16,27-34` (schema + `buildUserMetadata`)

**Interfaces:**
- Consumes: nada de novo.
- Produces: `signupSchema` passa a ter só `nomeCompleto`, `email`, `cpf`, `password`, `confirmPassword`. O signup POST envia apenas `{ email, password, nomeCompleto, cpf }`. `buildUserMetadata` grava `full_name` e `cpf`.

- [ ] **Step 1: Enxugar o `signupSchema`**

Em `src/app/(auth)/login/login-client.tsx`, substituir o `signupSchema` (linhas 70-86) por:

```typescript
const signupSchema = z
  .object({
    nomeCompleto: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    email: z.string().email("Email inválido"),
    cpf: z.string().refine((v) => validateCpf(v), { message: "CPF inválido" }),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
```

- [ ] **Step 2: Remover estado e máscaras de telefone/CEP do `SignupFormComponent`**

Em `SignupFormComponent`, remover as linhas de estado `telefone`, `cep`, `cepInfo`, `cepLoading` e a função `fetchCep` (linhas 438-472). Remover também a função `maskPhone` (21-28) e `maskCep` (38-42) do topo do arquivo se não usadas em outro lugar (verificar com busca; `maskCpf` permanece). Remover o import de `MapPin` se ficar órfão.

- [ ] **Step 3: Ajustar o corpo do submit do signup**

Em `onSubmit` do `SignupFormComponent` (linhas 474-486), trocar o body do fetch para:

```typescript
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        nomeCompleto: data.nomeCompleto,
        cpf: data.cpf,
      }),
```

- [ ] **Step 4: Reescrever o JSX do formulário (campos e rótulo do CPF)**

No `return` do `SignupFormComponent`, manter Nome completo e Email como estão; **remover** o bloco "Telefone e CPF lado a lado" (555-593) e o bloco "CEP" (595-627), e no lugar inserir o CPF do titular com rótulo claro:

```tsx
      {/* CPF do titular */}
      <div className="space-y-1.5">
        <Label className="text-foreground">Seu CPF</Label>
        <Input
          placeholder="000.000.000-00"
          inputMode="numeric"
          className="border-border bg-background focus-visible:ring-primary"
          value={cpf}
          {...register("cpf")}
          onChange={(e) => {
            const masked = maskCpf(e.target.value);
            setCpf(masked);
            setValue("cpf", masked, { shouldValidate: true });
          }}
        />
        <p className="text-xs text-muted-foreground">
          CPF de quem vai administrar a conta (você).
        </p>
        {errors.cpf && (
          <p className="text-xs text-red-500">{errors.cpf.message}</p>
        )}
      </div>
```

Manter o estado `const [cpf, setCpf] = useState("")` (só ele; telefone/cep saíram).

- [ ] **Step 5: Enxugar `buildUserMetadata` e o schema do signup**

Em `src/app/api/auth/signup/route.ts`: no `Schema` (linhas 9-16) remover `telefone` e `cep` (deixar `nomeCompleto` e `cpf` opcionais como já são). Em `buildUserMetadata` (27-34) remover as linhas de `telefone`/`cep`:

```typescript
function buildUserMetadata(input: z.infer<typeof Schema>) {
  const meta: Record<string, string> = {}
  if (input.nomeCompleto) meta.full_name = input.nomeCompleto
  if (input.cpf) meta.cpf = input.cpf
  return meta
}
```

- [ ] **Step 6: Verificação de tipos**

Run: `npx tsc --noEmit`
Expected: zero erros (garante que nenhuma referência a telefone/cep/fetchCep/MapPin ficou órfã).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)/login/login-client.tsx" src/app/api/auth/signup/route.ts
git commit -m "feat(auth): signup pede só titular (nome, email, CPF, senha) com rótulo claro; telefone/CEP saem daqui"
```

---

### Task 3: Onboarding coleta telefone + CEP, com reuso opcional do CPF

**Files:**
- Modify: `src/app/(auth)/onboarding/page.tsx` (estado, máscaras, JSX do modo `create`, corpo do `register`)

**Interfaces:**
- Consumes: `POST /api/iam/register` agora aceita `ownerPhone` e `zipCode` (Task 1). `meta.cpf` disponível via `supabase.auth.getUser()` (já lido no `useEffect`).
- Produces: nenhum contrato para tasks seguintes.

- [ ] **Step 1: Adicionar máscara de telefone e utilidades de CEP no arquivo**

No topo de `src/app/(auth)/onboarding/page.tsx`, junto de `applyCpfMask`/`applyCnpjMask`, adicionar:

```typescript
function applyPhoneMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function applyCepMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}
```

- [ ] **Step 2: Adicionar estado dos novos campos e do CPF do titular**

Em `OnboardingContent`, junto dos demais `useState`, adicionar:

```typescript
  const [phone, setPhone] = useState('')
  const [cep, setCep] = useState('')
  const [ownerCpf, setOwnerCpf] = useState('')
  const [reuseOwnerCpf, setReuseOwnerCpf] = useState(false)
```

- [ ] **Step 3: Capturar o CPF do titular do metadata no `useEffect`**

No `useEffect` que lê `supabase.auth.getUser()` (bloco `meta?.pendingTenantId` / else), na ramificação de `create` (o `else` final, ~linha 126-130), adicionar após `setUserName(...)`:

```typescript
        if (typeof meta?.cpf === 'string') setOwnerCpf(meta.cpf)
        if (typeof meta?.phone === 'string') setPhone(applyPhoneMask(meta.phone))
        if (typeof meta?.cep === 'string') setCep(applyCepMask(meta.cep))
```

(pré-preenche telefone/CEP se por acaso vierem de conta legada; para novas contas virão vazios e o usuário digita.)

- [ ] **Step 4: Enviar `ownerPhone`/`zipCode` no `handleCreate`**

No `handleCreate`, no body do `fetch('/api/iam/register', ...)` (linhas 169-179), acrescentar após `document: documentDigits,`:

```typescript
          ownerPhone: phone.replace(/\D/g, '').length >= 10 ? phone : undefined,
          zipCode: cep.replace(/\D/g, '').length === 8 ? cep : undefined,
```

- [ ] **Step 5: Reuso opcional — sincronizar o documento com o CPF do titular**

No `handleCreate`, logo no início (antes de calcular `documentDigits`), garantir o efeito do checkbox já está no `document`. O checkbox controla o valor via handler no JSX (Step 6), então nenhuma lógica extra aqui além do que já existe.

- [ ] **Step 6: Inserir os campos no JSX do modo `create`**

No `return` do modo `create`, dentro do `<form onSubmit={handleCreate}>`, **depois** do bloco "Seu nome" (linhas 445-454) e **antes** do bloco de documento, inserir Telefone:

```tsx
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  className="h-11"
                  inputMode="numeric"
                  placeholder="(00) 0 0000-0000"
                  value={phone}
                  onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
                />
              </div>
```

No bloco do documento do negócio (linhas 411-444), trocar o rótulo/ajuda e inserir o checkbox de reuso. Substituir o conteúdo do bloco por:

```tsx
              <div className="space-y-1.5">
                <Label>CPF ou CNPJ do negócio</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={documentType === 'CPF' ? 'default' : 'outline'}
                    className={`h-11 px-4 ${documentType === 'CPF' ? 'bg-[#191919] hover:bg-[#2d2d2d]' : ''}`}
                    onClick={() => { setDocumentType('CPF'); setDocument(reuseOwnerCpf ? applyCpfMask(ownerCpf) : '') }}
                  >
                    CPF
                  </Button>
                  <Button
                    type="button"
                    variant={documentType === 'CNPJ' ? 'default' : 'outline'}
                    className={`h-11 px-4 ${documentType === 'CNPJ' ? 'bg-[#191919] hover:bg-[#2d2d2d]' : ''}`}
                    onClick={() => { setDocumentType('CNPJ'); setDocument(''); setReuseOwnerCpf(false) }}
                  >
                    CNPJ
                  </Button>
                </div>

                {documentType === 'CPF' && ownerCpf && (
                  <label className="flex items-center gap-2 text-sm text-[#191919]">
                    <input
                      type="checkbox"
                      checked={reuseOwnerCpf}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setReuseOwnerCpf(checked)
                        setDocument(checked ? applyCpfMask(ownerCpf) : '')
                      }}
                    />
                    Usar o meu CPF (mesmo do cadastro)
                  </label>
                )}

                <Input
                  className="h-11"
                  inputMode="numeric"
                  placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  value={document}
                  disabled={documentType === 'CPF' && reuseOwnerCpf}
                  onChange={(e) => setDocument(
                    documentType === 'CPF' ? applyCpfMask(e.target.value) : applyCnpjMask(e.target.value),
                  )}
                  required
                />
                <p className="text-xs text-[#787774]">
                  Documento do seu negócio. Autônomo/MEI? Costuma ser o seu próprio CPF.
                </p>
              </div>
```

**Depois** do bloco de documento e **antes** de "Identidade visual", inserir CEP com ViaCEP:

```tsx
              <div className="space-y-1.5">
                <Label>CEP do negócio</Label>
                <Input
                  className="h-11"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(applyCepMask(e.target.value))}
                />
                <p className="text-xs text-[#787774]">
                  Endereço do seu negócio. Você pode ajustar depois em Configurações.
                </p>
              </div>
```

(YAGNI: sem lookup ViaCEP no onboarding — mantemos só o CEP cru, coerente com "fora de escopo" do spec. A cidade/UF derivada não era persistida.)

- [ ] **Step 7: Verificação de tipos e build local da tela**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(auth)/onboarding/page.tsx"
git commit -m "feat(onboarding): coleta telefone e CEP do negócio + reuso opcional do CPF do titular"
```

---

### Task 4: Login mobile — layout sem "card flutuando" + voltar à landing + botões renomeados

**Files:**
- Modify: `src/app/(auth)/login/login-client.tsx` (`LeftPanel`, `RightPanel`, botões de submit em `LoginForm` e `SignupFormComponent`)

**Interfaces:**
- Consumes: `next/link`.
- Produces: nenhum.

- [ ] **Step 1: Importar `Link`**

No topo de `src/app/(auth)/login/login-client.tsx`, adicionar:

```typescript
import Link from "next/link";
```

- [ ] **Step 2: Logo do desktop clicável + "Voltar ao site" no `LeftPanel`**

Em `LeftPanel`, envolver o bloco do logo (linhas 160-178) tornando-o link e adicionar o texto de retorno. Substituir a `<div className="relative flex items-center gap-2">` que contém o logo por:

```tsx
      <div className="relative flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2" aria-label="Voltar ao site">
          {isCustomBranding && branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.displayName} className="h-8 w-auto" />
          ) : (
            <Image
              src="/brand/logo-horizontal.png"
              alt="Agendê"
              width={550}
              height={136}
              priority
              className="h-9 w-auto"
            />
          )}
        </Link>
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
          ← Voltar ao site
        </Link>
      </div>
```

- [ ] **Step 3: Header mobile full-bleed + logo clicável + voltar**

Em `RightPanel`, o header mobile hoje está dentro de `<div className="w-full max-w-sm">` (linha 249) e é `md:hidden ... px-6 pt-6 pb-5` (251). Para full-bleed e melhor uso do espaço:

1. Trocar o contêiner externo de conteúdo (linha 249) de `max-w-sm` para `max-w-md`:

```tsx
      <div className="w-full max-w-md">
```

2. No header mobile (linha 251), tornar edge-to-edge com cantos inferiores arredondados e o logo/voltar em linha. Substituir a abertura da `div` e o bloco do logo por:

```tsx
        <div className="md:hidden relative overflow-hidden rounded-b-3xl bg-gradient-to-br from-violet-50 to-pink-50 px-6 pt-6 pb-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-200/40 blur-2xl" />

          <div className="relative flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2" aria-label="Voltar ao site">
              <Image
                src="/brand/logo-horizontal.png"
                alt="Agendê"
                width={550}
                height={136}
                priority
                className="h-7 w-auto"
              />
            </Link>
            <Link href="/" className="text-xs font-medium text-slate-500 hover:text-slate-800">
              ← Site
            </Link>
          </div>
```

- [ ] **Step 4: Renomear os botões de submit (fim do eco com as abas)**

No `LoginForm`, o botão de submit (linhas 411-421) — trocar o texto de fallback `"Entrar"` por `"Acessar minha conta"`:

```tsx
        {isSubmitting ? (
          <><Loader2 className="mr-2 size-4 animate-spin" />Entrando...</>
        ) : (
          "Acessar minha conta"
        )}
```

No `SignupFormComponent`, o botão de submit (linhas 668-678) — trocar `"Criar conta"` por `"Criar minha conta grátis"`:

```tsx
        {isSubmitting ? (
          <><Loader2 className="mr-2 size-4 animate-spin" />Criando conta...</>
        ) : (
          "Criar minha conta grátis"
        )}
```

- [ ] **Step 5: Verificação de tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Conferência visual manual (mobile)**

Rodar `npm run dev`, abrir `/login` em viewport ~390px e ~540px. Confirmar: header gradiente encosta nas bordas, sem coluna estreita boiando; "← Site" visível; logo clica e volta para `/`; botões dizem "Acessar minha conta" / "Criar minha conta grátis".

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)/login/login-client.tsx"
git commit -m "feat(auth): login mobile full-bleed, retorno à landing e botões de ação renomeados"
```

---

### Task 5: Componente de detecção de instalação PWA (hook + utilidades)

**Files:**
- Create: `src/components/domain/pwa/use-pwa-install.ts`

**Interfaces:**
- Produces: hook `usePwaInstall()` retornando `{ isStandalone: boolean, platform: 'android' | 'ios' | 'other', deferredPrompt: BeforeInstallPromptEvent | null, promptInstall: () => Promise<void> }`. Tipo `BeforeInstallPromptEvent` exportado.

- [ ] **Step 1: Criar o hook com detecção de plataforma e captura do prompt**

Criar `src/components/domain/pwa/use-pwa-install.ts`:

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'android' | 'ios' | 'other'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'other'
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mm = window.matchMedia?.('(display-mode: standalone)').matches
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone
  return Boolean(mm || iosStandalone)
}

export function usePwaInstall() {
  const [isStandalone, setIsStandalone] = useState(false)
  const [platform, setPlatform] = useState<Platform>('other')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setIsStandalone(detectStandalone())
    setPlatform(detectPlatform())

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }, [deferredPrompt])

  return { isStandalone, platform, deferredPrompt, promptInstall }
}
```

- [ ] **Step 2: Verificação de tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/pwa/use-pwa-install.ts
git commit -m "feat(pwa): hook de detecção de instalação (plataforma, standalone, beforeinstallprompt)"
```

---

### Task 6: Modal de instruções de instalação (Android/iOS)

**Files:**
- Create: `src/components/domain/pwa/install-instructions-modal.tsx`

**Interfaces:**
- Consumes: `usePwaInstall()` (Task 5), `@/components/ui/dialog` (Shadcn Dialog — confirmar que existe; se não, usar o padrão de modal já usado no projeto).
- Produces: `<InstallInstructionsModal open onOpenChange />`.

- [ ] **Step 1: Confirmar o componente de Dialog disponível**

Run: `ls src/components/ui/dialog.tsx`
Expected: arquivo existe. (Se não existir, usar `sheet.tsx` ou o modal já usado em `onboarding` — ajustar imports conforme o encontrado.)

- [ ] **Step 2: Criar o modal com passos por plataforma**

Criar `src/components/domain/pwa/install-instructions-modal.tsx`:

```tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from './use-pwa-install'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallInstructionsModal({ open, onOpenChange }: Props) {
  const { platform, deferredPrompt, promptInstall } = usePwaInstall()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Instalar o Agendê</DialogTitle>
          <DialogDescription>
            Tenha o app na tela inicial: abre rápido e sem a barra do navegador.
          </DialogDescription>
        </DialogHeader>

        {platform === 'ios' ? (
          <ol className="space-y-3 text-sm text-slate-700">
            <li>1. Toque no botão <strong>Compartilhar</strong> ⬆️ (base do Safari).</li>
            <li>2. Escolha <strong>Adicionar à Tela de Início</strong>.</li>
            <li>3. Toque em <strong>Adicionar</strong>. Pronto! 🎉</li>
          </ol>
        ) : deferredPrompt ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              É rápido: toque no botão abaixo e confirme a instalação.
            </p>
            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 text-white"
              onClick={() => { void promptInstall(); onOpenChange(false) }}
            >
              Instalar agora
            </Button>
          </div>
        ) : (
          <ol className="space-y-3 text-sm text-slate-700">
            <li>1. Abra o menu <strong>⋮</strong> (canto superior direito).</li>
            <li>2. Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
            <li>3. Confirme. Pronto! 🎉</li>
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Verificação de tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/pwa/install-instructions-modal.tsx
git commit -m "feat(pwa): modal de instruções de instalação por plataforma (Android/iOS)"
```

---

### Task 7: Banner de instalação na `/agenda` (gating por 2º acesso + dispensa)

**Files:**
- Create: `src/components/domain/pwa/install-app-banner.tsx`
- Create: `src/components/domain/pwa/install-app-banner.test.tsx`
- Modify: `src/app/(app)/agenda/page.tsx` (montar o banner)

**Interfaces:**
- Consumes: `usePwaInstall()` (Task 5), `InstallInstructionsModal` (Task 6).
- Produces: `<InstallAppBanner />`. Chaves em localStorage: `agende:agenda-visits` (contador) e `agende:install-banner-dismissed` (flag).

- [ ] **Step 1: Escrever teste da lógica de gating (visitas + standalone + dismiss)**

Criar `src/components/domain/pwa/install-app-banner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InstallAppBanner } from './install-app-banner'

vi.mock('./use-pwa-install', () => ({
  usePwaInstall: vi.fn(() => ({
    isStandalone: false,
    platform: 'android',
    deferredPrompt: null,
    promptInstall: vi.fn(),
  })),
}))

import { usePwaInstall } from './use-pwa-install'

describe('InstallAppBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(usePwaInstall).mockReturnValue({
      isStandalone: false,
      platform: 'android',
      deferredPrompt: null,
      promptInstall: vi.fn(),
    } as any)
  })

  it('não aparece no 1º acesso', () => {
    render(<InstallAppBanner />)
    expect(screen.queryByText(/tela inicial/i)).toBeNull()
    expect(localStorage.getItem('agende:agenda-visits')).toBe('1')
  })

  it('aparece a partir do 2º acesso', () => {
    localStorage.setItem('agende:agenda-visits', '1')
    render(<InstallAppBanner />)
    expect(screen.getByText(/tela inicial/i)).toBeInTheDocument()
  })

  it('não aparece se já instalado (standalone)', () => {
    localStorage.setItem('agende:agenda-visits', '5')
    vi.mocked(usePwaInstall).mockReturnValue({
      isStandalone: true, platform: 'android', deferredPrompt: null, promptInstall: vi.fn(),
    } as any)
    render(<InstallAppBanner />)
    expect(screen.queryByText(/tela inicial/i)).toBeNull()
  })

  it('não aparece se já foi dispensado', () => {
    localStorage.setItem('agende:agenda-visits', '5')
    localStorage.setItem('agende:install-banner-dismissed', '1')
    render(<InstallAppBanner />)
    expect(screen.queryByText(/tela inicial/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/domain/pwa/install-app-banner.test.tsx`
Expected: FAIL — módulo `./install-app-banner` ainda não existe.

- [ ] **Step 3: Implementar o banner**

Criar `src/components/domain/pwa/install-app-banner.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { usePwaInstall } from './use-pwa-install'
import { InstallInstructionsModal } from './install-instructions-modal'

const VISITS_KEY = 'agende:agenda-visits'
const DISMISSED_KEY = 'agende:install-banner-dismissed'
const MIN_VISITS = 2

export function InstallAppBanner() {
  const { isStandalone } = usePwaInstall()
  const [visible, setVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (isStandalone) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    const visits = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1
    localStorage.setItem(VISITS_KEY, String(visits))
    if (visits >= MIN_VISITS) setVisible(true)
  }, [isStandalone])

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  return (
    <>
      <div className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-pink-50 p-4">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-violet-600" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-slate-800">
            Tenha o Agendê na tela inicial
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Abre rápido, sem o navegador.
          </p>
          <button
            className="mt-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
            onClick={() => setModalOpen(true)}
          >
            Ver como instalar
          </button>
        </div>
        <button aria-label="Dispensar" onClick={dismiss} className="text-slate-400 hover:text-slate-600">
          <X className="size-4" />
        </button>
      </div>

      <InstallInstructionsModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar verde**

Run: `npx vitest run src/components/domain/pwa/install-app-banner.test.tsx`
Expected: PASS — os 4 casos.

- [ ] **Step 5: Montar o banner na página da agenda**

Em `src/app/(app)/agenda/page.tsx`, importar e renderizar no topo do container. Adicionar o import:

```typescript
import { InstallAppBanner } from '@/components/domain/pwa/install-app-banner'
```

E dentro do `<div className="mx-auto max-w-2xl space-y-6">`, como primeiro filho (antes do bloco do título):

```tsx
      <InstallAppBanner />
```

- [ ] **Step 6: Verificação de tipos e suíte completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: zero erros de tipo; todos os testes passando.

- [ ] **Step 7: Commit**

```bash
git add src/components/domain/pwa/install-app-banner.tsx src/components/domain/pwa/install-app-banner.test.tsx "src/app/(app)/agenda/page.tsx"
git commit -m "feat(pwa): banner de instalação na agenda a partir do 2º acesso, dispensável"
```

---

### Task 8: Verificação final e ajuste de docs

**Files:**
- Modify: `CLAUDE.md` (linha da tabela de domínios PWA/Auth, se couber) — opcional, só se agregar clareza.

- [ ] **Step 1: Rodar a verificação completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: zero erros; suíte verde. Copiar o resumo de contagem de testes para a descrição do PR.

- [ ] **Step 2: Conferência manual de fluxo**

Rodar `npm run dev` e validar o caminho inteiro: `/login` (mobile) → Criar conta (só nome/email/CPF/senha) → onboarding (telefone, doc do negócio com reuso opcional, CEP) → seleção de plano. Confirmar que o banner de instalação aparece na `/agenda` no 2º carregamento.

- [ ] **Step 3: Atualizar `CLAUDE.md` se necessário**

Se algo do fluxo de Auth/Onboarding descrito na tabela ficou desatualizado, ajustar a linha correspondente em uma frase. Caso contrário, pular.

- [ ] **Step 4: Commit final e abertura de PR**

```bash
git add -A
git commit -m "chore: verificação final do polimento de usabilidade" --allow-empty
git push -u origin feat/polimento-usabilidade-login-onboarding-pwa
```

Abrir PR para `main` com resumo das 5 frentes e o resultado do `tsc`/`vitest`.

---

## Self-Review (resultado)

- **Cobertura do spec:** Frente 1 → Task 4; Frente 2 → Task 4; Frente 3 → Task 4; Frente 4 → Tasks 1+2; Frente 5 → Tasks 1+3; Frente 6 → Tasks 5+6+7. Testes → Tasks 1, 7 + verificação Task 8. Todas cobertas.
- **Placeholders:** nenhum passo com TODO/TBD; todo passo de código traz o código.
- **Consistência de tipos:** `ownerPhone`/`zipCode` (opcionais) idênticos em `RegisterInput`, `RegisterSchema` e no body do onboarding. `usePwaInstall()` retorna o mesmo shape consumido pelo banner e pelo modal. `BeforeInstallPromptEvent` definido na Task 5 e reutilizado na 6.
- **Desvio consciente do spec:** o spec citava ViaCEP no onboarding, mas a seção "Fora de escopo" veda autopreenchimento de endereço e a cidade/UF não era persistida — então o CEP entra como campo simples (Step 6 da Task 3), coerente com YAGNI.
