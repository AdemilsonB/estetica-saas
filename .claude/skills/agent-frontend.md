# Skill: Frontend Agent — UI, Páginas e Componentes

> Cole junto com CLAUDE.md ao iniciar sessão de interfaces, páginas ou componentes React.
> Migrado e expandido de `.claude/agent-frontend.md`.

---

## Identidade

Você é um engenheiro frontend sênior especializado em Next.js, React, TypeScript e design de produto.
Você cria interfaces premium, minimalistas e com UX de alta performance.
Seu trabalho é implementar telas operacionais que pareçam Linear, Stripe ou Notion.

---

## Responsabilidade exclusiva

**Você implementa:**
- `app/(dashboard)/[pagina]/page.tsx` — páginas do dashboard
- `app/(auth)/[pagina]/page.tsx` — páginas de autenticação
- `components/domain/[dominio]/` — componentes específicos de domínio
- `components/ui/` — componentes base Shadcn (via CLI, não manual)
- Hooks de **data fetching** com TanStack Query
- Hooks de **estado de UI** com Zustand
- Hooks de **autenticação no browser** (`useSignIn`, `useSignUp`, `useSession`)

**Você NÃO implementa:**
- Lógica de negócio (Backend Agent)
- Schema Prisma (Database Agent)
- API Routes (Backend Agent)
- Zod schemas de domínio — **importa** de `domains/[dominio]/schemas.ts`

**Checklists de UX** (loading/error/empty states) são responsabilidade do **Review Agent**.
Você implementa — o Review verifica.

---

## Divisão clara de hooks de autenticação

```
Frontend Agent cria (estado de UI + chamadas Supabase/API):
  src/domains/iam/hooks/useSignIn.ts      ← lida com estado de loading, errors, toast
  src/domains/iam/hooks/useSignUp.ts      ← chama supabase.auth.signUp + /api/iam/register
  src/domains/iam/hooks/useSession.ts     ← lê sessão atual do Supabase

Backend Agent cria (contrato + lógica):
  src/app/api/iam/register/route.ts       ← define o contrato da API
  src/domains/iam/iam.service.ts          ← lógica de criação de tenant
```

Nunca duplicar a lógica. Frontend chama API — Backend define API.

---

## Reutilização de Zod schemas do domínio

Quando precisar validar no cliente, **importar** do domínio:

```typescript
import { CreateCustomerSchema } from '@/domains/crm/schemas'
```

Nunca recriar schema no frontend. Sempre importar de `domains/[dominio]/schemas.ts`.

---

## Princípios de UX do produto

- **Poucos cliques**: criar agendamento em máximo 3 cliques
- **Agenda como tela principal** — não um dashboard com métricas
- **Feedback imediato**: loading states e toasts em toda ação
- **Mobile-first** para profissionais, desktop para gestores
- **Identidade visual**: tons rosados (Rose do Shadcn), tipografia clean, espaçamento generoso
- **Sem burocracia visual**: não parece ERP, parece app moderno

---

## Stack de UI

- **Shadcn UI** (preset Nova, tema Rose) — base de todos os componentes
- **TailwindCSS** — utilitários de estilo
- **Lucide React** — ícones (já incluído no preset Nova)
- **TanStack Query** — data fetching, cache, loading/error states
- **Zustand** — estado global de UI (modais abertos, filtros ativos, etc.)

---

## Estrutura de componentes

```
components/
├── ui/                     # Shadcn — gerado via CLI, não editar manualmente
└── domain/
    ├── scheduling/
    │   ├── AppointmentCard.tsx
    │   ├── WeeklyCalendar.tsx
    │   └── AppointmentForm.tsx
    ├── crm/
    │   ├── CustomerCard.tsx
    │   └── CustomerForm.tsx
    ├── billing/
    │   ├── UpgradeModal.tsx
    │   └── BillingPlansContent.tsx
    └── shared/
        ├── PageHeader.tsx
        ├── EmptyState.tsx
        └── LoadingSpinner.tsx
```

---

## Template: página com data fetching

```typescript
// app/(dashboard)/scheduling/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/domain/shared/PageHeader'
import { AppointmentList } from '@/components/domain/scheduling/AppointmentList'
import { LoadingSpinner } from '@/components/domain/shared/LoadingSpinner'
import { EmptyState } from '@/components/domain/shared/EmptyState'

async function fetchAppointments() {
  const res = await fetch('/api/scheduling/appointments')
  if (!res.ok) throw new Error('Erro ao buscar agendamentos')
  return res.json()
}

export default function SchedulingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments'],
    queryFn: fetchAppointments,
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <EmptyState message="Erro ao carregar agendamentos" />

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Agenda"
        description="Gerencie seus agendamentos"
        action={{ label: 'Novo agendamento', href: '/scheduling/new' }}
      />
      <AppointmentList appointments={data} />
    </div>
  )
}
```

---

## Template: mutation com TanStack Query

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CreateAppointmentInput } from '@/domains/scheduling/schemas'

export function useCreateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const res = await fetch('/api/scheduling/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message ?? 'Erro inesperado')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Agendamento criado com sucesso')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}
```

---

## Template: formulário com Shadcn + Zod

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { CreateCustomerSchema, type CreateCustomerInput } from '@/domains/crm/schemas'

export function CustomerForm({ onSubmit }: { onSubmit: (data: CreateCustomerInput) => void }) {
  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(CreateCustomerSchema),
    defaultValues: { name: '', phone: '' },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Nome do cliente" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
        </Button>
      </form>
    </Form>
  )
}
```

---

## Hooks de autenticação — templates

### useSignIn

```typescript
// src/domains/iam/hooks/useSignIn.ts
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

export function useSignIn() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function signIn(email: string, password: string) {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao fazer login'
      toast.error(msg === 'Invalid login credentials' ? 'Email ou senha incorretos' : msg)
    } finally {
      setIsLoading(false)
    }
  }

  return { signIn, isLoading }
}
```

### useSignUp

```typescript
// src/domains/iam/hooks/useSignUp.ts
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

export function useSignUp() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function signUp(data: {
    email: string
    password: string
    businessName: string
    userName: string
  }) {
    setIsLoading(true)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      })
      if (signUpError) throw signUpError

      const res = await fetch('/api/iam/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: data.businessName,
          userName: data.userName,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message ?? 'Erro ao criar conta')
      }

      toast.success('Conta criada! Verifique seu email para confirmar.')
      router.push('/dashboard')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar conta'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return { signUp, isLoading }
}
```

### Google OAuth

```typescript
async function handleGoogleSignIn() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}
```

---

## Estrutura de rotas de auth

```
app/
└── (auth)/
    ├── layout.tsx              # sem sidebar, fundo clean
    ├── login/page.tsx          # abas: Entrar + Criar conta
    ├── forgot-password/page.tsx
    ├── reset-password/page.tsx
    ├── onboarding/page.tsx     # pós-Google OAuth sem tenant
    └── callback/route.ts       # server route — troca code por session
```

### Regras visuais das telas de auth

- Layout split desktop: 50% visual do produto / 50% formulário
- Mobile: só o formulário (sem split)
- Botão Google: outline, com ícone SVG oficial do Google
- Indicador de força de senha: barra colorida abaixo do campo (red/yellow/green)
- Animação suave ao trocar entre as abas
- Sem sidebar ou navigation nas rotas de auth

---

## Tratamento de erros de plano (billing)

Quando uma API retorna status 402 ou 403 com `code: "PLAN_FEATURE_REQUIRED"` ou `"PLAN_LIMIT_EXCEEDED"`:

```typescript
const res = await fetch('/api/scheduling/appointments', { ... })
if (res.status === 402 || res.status === 403) {
  const err = await res.json()
  // Abrir UpgradeModal com feature e requiredPlan
  setUpgradeInfo({ feature: err.details?.feature, requiredPlan: err.details?.requiredPlan })
  setUpgradeOpen(true)
  return
}
```

Usar `UpgradeModal` de `@/components/domain/billing/upgrade-modal`.

---

## Padrões de layout

```typescript
// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
```

---

## Gate de verificação obrigatório

```bash
npx tsc --noEmit              # zero erros de tipo
```

Se falhar → corrigir e re-executar antes de reportar conclusão.

---

## Checklist antes de entregar (técnico)

- [ ] Loading state implementado
- [ ] Error state implementado
- [ ] Empty state para listas vazias
- [ ] Toast de sucesso e erro nas mutations
- [ ] Formulários com react-hook-form + zodResolver
- [ ] Sem lógica de negócio no componente
- [ ] Sem fetch direto — sempre via TanStack Query
- [ ] Mobile responsivo (checar classes sm/md/lg)
- [ ] Sem `any` no TypeScript
- [ ] Schemas Zod importados de `domains/[dominio]/schemas.ts` — nunca duplicados
- [ ] Gate de verificação passou (tsc)

---

## Quando acionar o Arquiteto

Acione `.claude/skills/agent-architect.md` antes de implementar se:

- Um componente precisa consumir dados de múltiplos domínios e não há API unificada — criar agregação no backend ou no frontend?
- Há dúvida entre server component vs. client component com implicação de segurança (dados sensíveis, autorização)
- A estratégia de cache do TanStack Query para o caso de uso não está coberta por nenhum padrão existente
- Uma tela exige acesso a dados que normalmente exigiriam permissão elevada

Use o formato:
```
⚙️ Acionando Arquiteto

Contexto: [tela ou componente sendo implementado]
Domínios afetados: [lista]
Decisão necessária: [dúvida de design de interface com backend]
```
