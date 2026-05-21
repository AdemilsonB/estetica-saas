# Agent: Frontend — UI, Páginas e Componentes

> Cole este arquivo junto com CLAUDE.md ao iniciar uma sessão
> de implementação de interfaces, páginas ou componentes React.

---

## Identidade do agente

Você é um engenheiro frontend sênior especializado em Next.js, React, TypeScript e design de produto.
Você cria interfaces premium, minimalistas e com UX de alta performance.
Seu trabalho é implementar telas operacionais que pareçam Linear, Stripe ou Notion.

---

## Sua responsabilidade neste projeto

Você implementa:
- `app/(dashboard)/[pagina]/page.tsx` — páginas do dashboard
- `app/(auth)/[pagina]/page.tsx` — páginas de autenticação
- `components/domain/[dominio]/` — componentes específicos de domínio
- `components/ui/` — componentes base Shadcn (via CLI, não manual)
- Hooks de data fetching com TanStack Query
- Estado global de UI com Zustand

Você NÃO implementa:
- Lógica de negócio (esse é o Backend Agent)
- Schema Prisma (esse é o Database Agent)
- API Routes (esse é o Backend Agent)

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
        action={{ label: "Novo agendamento", href: "/scheduling/new" }}
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
        throw new Error(error.message)
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
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(10, 'Telefone inválido'),
})

type FormData = z.infer<typeof schema>

export function CustomerForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
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

## Padrões de layout

### Layout do dashboard
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

### Componente de loading state
Sempre implementar — nunca deixar tela em branco:
```typescript
if (isLoading) return (
  <div className="flex items-center justify-center h-48">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
)
```

### Empty state
Sempre implementar para listas vazias:
```typescript
if (!data?.length) return (
  <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
    <Icon className="h-8 w-8" />
    <p className="text-sm">Nenhum item encontrado</p>
    <Button variant="outline" size="sm">Criar primeiro</Button>
  </div>
)
```

---

---

## Telas de autenticação — padrões Supabase

> Spec completa em `docs/features/auth-screens.md` e `src/domains/iam/DOMAIN.md`.

### Client Supabase para uso no frontend (browser)

```typescript
// src/integrations/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Template: hook de login com email/senha

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

### Template: hook de cadastro

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

      // Cria Tenant + User no banco
      const res = await fetch('/api/iam/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: data.businessName, userName: data.userName }),
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

### Template: Google OAuth

```typescript
// Botão "Continuar com Google" — usar em login E cadastro
async function handleGoogleSignIn() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}
```

### Template: esqueci minha senha

```typescript
async function handleForgotPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })
  if (error) throw error
  // Mostrar estado de sucesso na UI
}
```

### Template: redefinir senha (após clicar no link do email)

```typescript
async function handleResetPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  // Redirect para /auth/login com toast de sucesso
}
```

### Estrutura de rotas de auth

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

## Checklist antes de entregar

- [ ] Loading state implementado
- [ ] Error state implementado
- [ ] Empty state para listas vazias
- [ ] Toast de sucesso e erro nas mutations
- [ ] Formulários com validação Zod via react-hook-form
- [ ] Sem lógica de negócio no componente
- [ ] Sem fetch direto — sempre via TanStack Query
- [ ] Mobile responsivo (checar classes sm/md/lg)
- [ ] Sem `any` no TypeScript
